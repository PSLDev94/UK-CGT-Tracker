import { sourceIdentity } from "../domain/imports/source-identity";
import { recordJourney } from "./journey";
import { authenticate, type SessionReader } from "./identity";
import { AppError } from "./errors";
import {
  assertSameOrigin,
  errorResponse,
  jsonInput,
  privateResponse,
  stringField,
} from "./http";
import type { Workspace } from "./workspace";
import type { SupportingDetails } from "../domain/imports/supporting-details";
import type { ImportReview } from "../domain/imports/review";
import { MAX_CSV_BYTES } from "../domain/imports/review";
import { importTradeDetail } from "../domain/imports/trade-detail";

// JSON.stringify escapes quotes, backslashes and allowed CSV whitespace. The
// decoded file still has its own 10 MiB cap; allow its bounded wire expansion.
export const WORKSPACE_BODY_BYTES = 2 * MAX_CSV_BYTES + 64 * 1024;

const pageSize = 100;
export function pageForReviewIndex(index: number) {
  return Math.floor(Math.max(0, index) / pageSize) + 1;
}

export function reviewPage(review: ImportReview, page: number) {
  let sourceBlockerCount = 0;
  let firstBlocker = -1;
  let firstRepair = -1;
  for (const [position, record] of review.records.entries()) {
    if (record.status !== "needs_review") continue;
    if (record.canSupplyDetails) {
      if (firstRepair === -1) firstRepair = position;
    } else {
      sourceBlockerCount++;
      if (firstBlocker === -1) firstBlocker = position;
    }
  }
  const firstIncluded = review.records.find((row) => row.status === "accepted" && row.trade);
  const index = firstBlocker === -1 ? firstRepair : firstBlocker;
  const next = review.records[index];
  return {
    ...review,
    firstIncluded: firstIncluded?.trade ? {
      record: firstIncluded.record,
      name: sourceIdentity(firstIncluded.source).description,
      trade: importTradeDetail(firstIncluded.trade, firstIncluded.provenance, firstIncluded.executionReference),
    } : null,
    records: review.records.slice((page - 1) * pageSize, page * pageSize).map((record) =>
      record.trade
        ? { ...record, tradeDetail: importTradeDetail(record.trade, record.provenance, record.executionReference) }
        : record,
    ),
    issues: review.issues.slice(0, 100),
    issueCount: review.issues.length,
    page,
    pageSize,
    sourceBlockerCount,
    nextUnresolved: next
      ? { record: next.record, page: pageForReviewIndex(index), canSupplyDetails: !!next.canSupplyDetails, reason: next.reason }
      : null,
  };
}

export function createWorkspaceHandler(
  workspace: Workspace,
  readSession: SessionReader,
  origin: string,
) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== "POST")
        return privateResponse(
          { error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } },
          405,
        );
      assertSameOrigin(request, origin);
      const identity = await authenticate(request.headers, readSession);
      const input = await jsonInput(request, WORKSPACE_BODY_BYTES);
      await workspace.consumeRequest(identity, "general");
      if (
        input.action === "supply-import-details" ||
        input.action === "prepare-import" ||
        input.action === "review-import" ||
        input.action === "commit-import"
      )
        await workspace.consumeRequest(identity, "upload");
      if (input.action === "calculate")
        await workspace.consumeRequest(identity, "calculate");
      const text = (name: string) => stringField(input, name);
      switch (input.action) {
        case "disposal-sources": {
          const keys = input.keys;
          if (!Array.isArray(keys) || keys.length > 25 || keys.some((k) => typeof k !== "string" || !k.length || k.length > 128))
            throw new AppError(400, "INVALID_SOURCE_KEYS", "Choose up to 25 valid source trades.");
          return privateResponse(await workspace.reportSources(identity, keys));
        }
        case "import-detail":
          return privateResponse(
            await workspace.importDetail(identity, text("importId"), Number(input.page ?? 1),
              input.record === undefined ? undefined : Number(input.record)),
          );
        case "import-history":
          return privateResponse(
            await workspace.importHistory(identity, Number(input.page ?? 1)),
          );
        case "overview": {
          const overview = await workspace.overview(
            identity, input.surface === "accounts",
            input.surface === "reports" || input.surface === "calculations",
            input.surface === "imports" && input.receiptId ? text("receiptId") : undefined,
            input.surface === "reports" ? "statement-sales" :
              input.surface === "calculations" ? "calculation-sales" : input.surface === "scenarios",
          );
          if (input.surface === "reports") recordJourney("reports_opened");
          return privateResponse(overview);
        }
        case "add-account":
          return privateResponse(
            await workspace.addAccount(identity, {
              portfolioId: text("portfolioId"),
              broker: text("broker"),
              label: text("label"),
              accountType: text("accountType"),
            }),
            201,
          );
        case "prepare-import": {
          const format = text("format");
          if (format !== "native" && format !== "canonical-v1")
            throw new AppError(
              400,
              "INVALID_FORMAT",
              "Choose the file format.",
            );
          if (
            input.ordinarySharesConfirmed !== undefined &&
            typeof input.ordinarySharesConfirmed !== "boolean"
          )
            throw new AppError(
              400,
              "INVALID_CONFIRMATION",
              "Use the ordinary-share confirmation checkbox.",
            );
          const result = await workspace.prepareImport(identity, {
            fileName: input.fileName === undefined ? undefined : text("fileName"),
            accountId: text("accountId"),
            csv: text("csv"),
            format,
            ordinarySharesConfirmed: input.ordinarySharesConfirmed as
              boolean | undefined,
          });
          recordJourney(result.review.status === "ready" ? "preview_ready" : "preview_blocked", result.broker);
          return privateResponse(
            { ...result, review: reviewPage(result.review, 1) },
            201,
          );
        }
        case "review-import": {
          const page = Number(input.page ?? 1);
          if (!Number.isSafeInteger(page) || page < 1 || page > 1000)
            throw new AppError(
              400,
              "INVALID_PAGE",
              "Choose a valid review page.",
            );
          const result = await workspace.reviewImport(
            identity,
            text("draftId"),
          );
          return privateResponse({
            ...result,
            review: reviewPage(result.review, page),
          });
        }
        case "supply-import-details": {
          if (
            !Number.isSafeInteger(input.record) ||
            !Number.isSafeInteger(input.reviewVersion)
          )
            throw new AppError(
              400,
              "INVALID_RECORD",
              "Reopen the preview before supplying details.",
            );
          const result = await workspace.supplyImportDetails(
            identity,
            text("draftId"),
            input.record as number,
            input.details as SupportingDetails,
            input.reviewVersion as number,
          );
          recordJourney(result.review.status === "ready" ? "repair_ready" : "repair_saved", result.broker);
          return privateResponse({
            ...result,
            review: reviewPage(
              result.review,
              pageForReviewIndex(result.review.records.findIndex((row) => row.record === input.record)),
            ),
          });
        }
        case "discard-draft": {
          const version = input.reviewVersion ?? 0;
          if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0)
            throw new AppError(400, "INVALID_VERSION", "Reopen the preview before discarding it.");
          await workspace.discardDraft(identity, text("draftId"), version);
          return privateResponse({ discarded: true });
        }
        case "commit-import": {
          if (typeof input.revision !== "number")
            throw new AppError(
              400,
              "INVALID_REVISION",
              "Review this file again before importing.",
            );
          const result = await workspace.commitImport(
            identity,
            text("draftId"),
            input.revision,
            input.reviewVersion === undefined ? 0 : Number(input.reviewVersion),
          );
          if (
            result.outcome === "review_changed" ||
            result.outcome === "needs_review"
          )
            return privateResponse(
              { ...result, review: reviewPage(result.review, 1) },
              409,
            );
          if (result.outcome === "committed") recordJourney("import_saved");
          return privateResponse(result);
        }
        case "reverse-import":
          return privateResponse(
            await workspace.reverseImport(
              identity,
              text("importId"),
              text("reason"),
            ),
          );
        case "calculate": {
          if (
            !Array.isArray(input.confirmedAccountIds) ||
            !input.confirmedAccountIds.every((id) => typeof id === "string")
          ) {
            throw new AppError(
              400,
              "INVALID_COVERAGE",
              "Confirm the accounts whose history is complete.",
            );
          }
          const calculation = await workspace.calculate(identity, {
              portfolioId: text("portfolioId"),
              portfolioRevision: input.portfolioRevision === undefined ? undefined : Number(input.portfolioRevision),
              taxYear: text("taxYear"),
              historyThrough: text("historyThrough"),
              confirmedAccountIds: input.confirmedAccountIds,
              personalScopeConfirmed: input.personalScopeConfirmed === true,
              scopeDeclaration: typeof input.scopeDeclaration === "string" ? input.scopeDeclaration : undefined,
            });
          recordJourney(calculation.result.status === "complete" && calculation.coverageConfirmed ? "calculation_complete" : "calculation_incomplete");
          // The PDF and CSV readers load the full pool ledger from the stored run.
          delete calculation.result.poolMovements;
          return privateResponse(calculation);
        }
        default:
          throw new AppError(
            400,
            "INVALID_ACTION",
            "Choose an available action.",
          );
      }
    } catch (error) {
      return errorResponse(error);
    }
  };
}

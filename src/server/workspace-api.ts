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

// JSON.stringify escapes quotes, backslashes and allowed CSV whitespace. The
// decoded file still has its own 10 MiB cap; allow its bounded wire expansion.
export const WORKSPACE_BODY_BYTES = 2 * MAX_CSV_BYTES + 64 * 1024;

const pageSize = 100;
export function pageForReviewIndex(index: number) {
  return Math.floor(Math.max(0, index) / pageSize) + 1;
}

export function reviewPage(review: ImportReview, page: number) {
  // Prioritise records the investor can repair here. Once those are resolved,
  // take them straight to the first blocker that requires a corrected export.
  let index = review.records.findIndex((record) => record.status === "needs_review" && record.canSupplyDetails);
  if (index === -1) index = review.records.findIndex((record) => record.status === "needs_review");
  const next = review.records[index];
  return {
    ...review,
    records: review.records.slice((page - 1) * pageSize, page * pageSize),
    issues: review.issues.slice(0, 100),
    issueCount: review.issues.length,
    page,
    pageSize,
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
        case "import-detail":
          return privateResponse(
            await workspace.importDetail(identity, text("importId"), Number(input.page ?? 1)),
          );
        case "import-history":
          return privateResponse(
            await workspace.importHistory(identity, Number(input.page ?? 1)),
          );
        case "overview": {
          const overview = await workspace.overview(identity, input.surface === "accounts");
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
        case "discard-draft":
          await workspace.discardDraft(identity, text("draftId"));
          return privateResponse({ discarded: true });
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
              taxYear: text("taxYear"),
              historyThrough: text("historyThrough"),
              confirmedAccountIds: input.confirmedAccountIds,
            });
          recordJourney(calculation.result.status === "complete" && calculation.coverageConfirmed ? "calculation_complete" : "calculation_incomplete");
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

import { evidenceIssue } from "../domain/reports/eligibility";
import { recordJourney } from "./journey";
import { authenticate, type Identity, type SessionReader } from "./identity";
import { AppError } from "./errors";
import {
  assertSameOrigin,
  errorResponse,
  jsonInput,
  stringField,
} from "./http";
import {
  reportCsv,
  type ReportSnapshot,
  type ReportSource,
} from "../domain/reports/report";
import { reportPdf } from "../domain/reports/pdf";

export function createReportHandler(deps: {
  readSession: SessionReader;
  origin: string;
  snapshot: (identity: Identity, id: string) => Promise<ReportSnapshot>;
  sources?: (identity: Identity, keys: string[]) => Promise<ReportSource[]>;
  entitled: (identity: Identity) => Promise<boolean>;
  consume: (identity: Identity) => Promise<void>;
}) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== "POST")
        throw new AppError(405, "METHOD_NOT_ALLOWED", "Use POST.");
      assertSameOrigin(request, deps.origin);
      const identity = await authenticate(request.headers, deps.readSession);
      await deps.consume(identity);
      const input = await jsonInput(request),
        kind = stringField(input, "kind");
      if (!["csv", "summary", "evidence"].includes(kind))
        throw new AppError(400, "INVALID_REPORT", "Choose a report format.");
      const snapshot = await deps.snapshot(
        identity,
        stringField(input, "runId"),
      );
      const issue = kind === "evidence" ? evidenceIssue(snapshot.result) : null;
      if (issue) throw new AppError(400, issue.code, issue.message);
      if (kind !== "csv" && !(await deps.entitled(identity)))
        throw new AppError(
          402,
          "SUBSCRIPTION_REQUIRED",
          "An active subscription is required for PDF reports. Your CSV evidence remains available.",
        );
      if (kind !== "summary" && deps.sources) {
        const keys = new Set(
          snapshot.result.disposals.flatMap((d) => [
            ...d.sourceIds,
            ...d.matches.flatMap((match) => match.acquisitionIds ?? []),
          ]),
        );
        for (const movement of snapshot.result.poolMovements ?? [])
          for (const key of movement.sourceIds) keys.add(key);
        snapshot.sources = await deps.sources(identity, [...keys]);
      }
      const csv = kind === "csv";
      const body = csv
        ? reportCsv(snapshot)
        : Buffer.from(await reportPdf(snapshot, kind === "evidence"));
      recordJourney(csv ? "csv_served" : "pdf_served");
      return new Response(body, {
        headers: {
          "content-type": csv ? "text/csv; charset=utf-8" : "application/pdf",
          "content-disposition": `attachment; filename="CGT-${kind}-${snapshot.result.taxYear}.${csv ? "csv" : "pdf"}"`,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

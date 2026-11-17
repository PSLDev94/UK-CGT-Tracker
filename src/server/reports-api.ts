import { authenticate, type Identity, type SessionReader } from "./identity";
import { AppError } from "./errors";
import {
  assertSameOrigin,
  errorResponse,
  jsonInput,
  stringField,
} from "./http";
import { reportCsv, type ReportSnapshot } from "../domain/reports/report";
import { reportPdf } from "../domain/reports/pdf";

export function createReportHandler(deps: {
  readSession: SessionReader;
  origin: string;
  snapshot: (identity: Identity, id: string) => Promise<ReportSnapshot>;
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
      if (kind !== "csv" && !(await deps.entitled(identity)))
        throw new AppError(
          402,
          "SUBSCRIPTION_REQUIRED",
          "An active subscription is required for PDF reports. Your CSV evidence remains available.",
        );
      if (
        kind === "evidence" &&
        (snapshot.result.disposals.length > 5000 ||
          snapshot.result.disposals.reduce(
            (count, d) =>
              count +
              d.sourceIds.length +
              d.matches.reduce(
                (n, m) => n + 1 + (m.acquisitionIds?.length ?? 0),
                0,
              ),
            0,
          ) > 50000)
      )
        throw new AppError(
          400,
          "REPORT_TOO_LARGE",
          "For more than 5,000 disposal groups or 50,000 matching references, download the full CSV evidence and the summary PDF.",
        );
      const csv = kind === "csv";
      const body = csv
        ? reportCsv(snapshot)
        : Buffer.from(await reportPdf(snapshot, kind === "evidence"));
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

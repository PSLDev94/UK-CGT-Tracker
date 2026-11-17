import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { calculateGains } from "../src/domain/cgt/calculate";
import {
  reportCsv,
  reportStatus,
  type ReportSnapshot,
} from "../src/domain/reports/report";
import { reportPdf } from "../src/domain/reports/pdf";
import { createReportHandler } from "../src/server/reports-api";
import { AppError } from "../src/server/errors";
const snapshot: ReportSnapshot = {
  id: "00000000-0000-4000-8000-000000000001",
  input_digest: "abc123",
  created_at: "2026-11-17T12:00:00Z",
  coverage_confirmed: true,
  result: calculateGains(
    [
      {
        id: "buy",
        securityId: "GB0008706128",
        date: "2024-01-01",
        side: "BUY",
        quantity: "10",
        considerationGBP: "100",
        feesGBP: "5",
      },
      {
        id: "sell",
        securityId: "GB0008706128",
        date: "2024-07-01",
        side: "SELL",
        quantity: "5",
        considerationGBP: "100",
        feesGBP: "2",
      },
    ],
    { taxYear: "2024-25", historyThrough: "2025-05-05" },
  ),
};
const session = async () => ({
  user: { id: "owner", emailVerified: true },
  session: { expiresAt: new Date(Date.now() + 3600000) },
});
const request = (kind = "csv", extra = {}) =>
  new Request("https://cgt.test/api/v2/reports", {
    method: "POST",
    headers: { origin: "https://cgt.test", "content-type": "application/json" },
    body: JSON.stringify({ kind, runId: snapshot.id, ...extra }),
  });
describe("auditable report exports", () => {
  it("exports saved decimal figures, matching details, pools and provenance", () => {
    const csv = reportCsv(snapshot);
    expect(snapshot.result.summary?.netGainGBP).toBe("45.50");
    expect(csv).toContain("45.50");
    expect(csv).toContain("SECTION_104");
    expect(csv).toContain("abc123");
    expect(csv).toContain("52.50");
    expect(csv).toContain("sell");
    expect(csv).not.toContain("NaN");
  });
  it("labels incomplete coverage and blocked figures as drafts, never zeroes", () => {
    expect(reportStatus({ ...snapshot, coverage_confirmed: false })).toContain(
      "DRAFT",
    );
    const result = calculateGains(
      [
        {
          id: "sell",
          securityId: "GB0008706128",
          date: "2024-07-01",
          side: "SELL",
          quantity: "5",
          considerationGBP: "100",
          feesGBP: "0",
        },
      ],
      { taxYear: "2024-25", historyThrough: "2025-05-05" },
    );
    const csv = reportCsv({ ...snapshot, result });
    expect(csv).toContain("UNRESOLVED");
    expect(csv).toContain("DRAFT");
    expect(result.summary).toBeNull();
  });
  it("neutralises spreadsheet formulas including leading whitespace", () => {
    const csv = reportCsv({ ...snapshot, input_digest: '  =HYPERLINK("bad")' });
    expect(csv).toContain("'  =HYPERLINK");
  });
  it("creates readable PDFs and paginates long execution references", async () => {
    const summary = await PDFDocument.load(await reportPdf(snapshot));
    expect(summary.getTitle()).toContain("2024-25");
    expect(summary.getPageCount()).toBeGreaterThan(0);
    const large = {
      ...snapshot,
      result: {
        ...snapshot.result,
        disposals: Array.from({ length: 100 }, () => ({
          ...snapshot.result.disposals[0]!,
          sourceIds: ["a".repeat(200)],
        })),
      },
    };
    const evidence = await PDFDocument.load(await reportPdf(large, true));
    expect(evidence.getPageCount()).toBeGreaterThan(5);
    expect(evidence.getPages().every((p) => p.getWidth() === 595.28)).toBe(
      true,
    );
  });
  it("authenticates before loading data and rejects cross-origin requests", async () => {
    const load = vi.fn(async () => snapshot);
    const handler = createReportHandler({
      readSession: async () => null,
      origin: "https://cgt.test",
      snapshot: load,
      entitled: async () => true,
      consume: async () => {},
    });
    expect((await handler(request())).status).toBe(401);
    expect(load).not.toHaveBeenCalled();
    const foreign = request();
    foreign.headers.set("origin", "https://evil.test");
    expect((await handler(foreign)).status).toBe(403);
  });
  it("keeps CSV available and enforces paid PDF access on the server", async () => {
    const entitlement = vi.fn(async () => false);
    const handler = createReportHandler({
      readSession: session,
      origin: "https://cgt.test",
      snapshot: async () => snapshot,
      entitled: entitlement,
      consume: async () => {},
    });
    const csv = await handler(request());
    expect(csv.status).toBe(200);
    expect(csv.headers.get("cache-control")).toBe("private, no-store");
    expect(entitlement).not.toHaveBeenCalled();
    expect(
      (
        await handler(
          request("summary", { entitled: true, ownerId: "another" }),
        )
      ).status,
    ).toBe(402);
    entitlement.mockResolvedValue(true);
    const pdf = await handler(request("evidence"));
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });
  it("does not bypass unavailable snapshots or billing outages", async () => {
    const handler = createReportHandler({
      readSession: session,
      origin: "https://cgt.test",
      snapshot: async () => {
        throw new AppError(404, "REPORT_UNAVAILABLE", "Recalculate");
      },
      entitled: async () => true,
      consume: async () => {},
    });
    expect((await handler(request("summary"))).status).toBe(404);
    expect((await handler(request("arbitrary"))).status).toBe(400);
  });
});

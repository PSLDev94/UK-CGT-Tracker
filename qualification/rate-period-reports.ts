import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { PDFDocument } from "pdf-lib";
import { expect } from "vitest";
import { CURRENT_SCOPE_DECLARATION } from "../src/domain/cgt/types";
import type { ReportKind } from "../src/domain/reports/report";
import type { Identity } from "../src/server/identity";
import { createReportHandler } from "../src/server/reports-api";
import type { Workspace } from "../src/server/workspace";
import { reportPageText } from "../tests/helpers/pdf-text";

export async function qualifyRatePeriodReports(workspace: Workspace, user: Identity, portfolioId: string, accountId: string) {
  const draft = await workspace.prepareImport(user, {
    accountId, format: "native", ordinarySharesConfirmed: true,
    csv: readFileSync("tests/fixtures/brokers/trading212-october-rate-periods.csv", "utf8"),
  });
  expect(draft.review.status).toBe("ready");
  expect(draft.review.counts).toEqual({total: 6, accepted: 6, excluded: 0, duplicate: 0, needsReview: 0});
  const saved = await workspace.commitImport(user, draft.draftId, draft.revision, draft.reviewVersion);
  expect(saved.outcome).toBe("committed");

  const origin = "https://cgt.test";
  const reports = createReportHandler({
    origin,
    readSession: async () => ({
      user: {id: user.ownerId, emailVerified: true},
      session: {expiresAt: new Date(Date.now()+60_000)},
    }),
    snapshot: (identity, id, kind) => workspace.reportSnapshot(identity, id, kind),
    entitled: async () => true,
    consume: async () => {},
  });
  async function file(runId: string, kind: ReportKind) {
    const response = await reports(new Request(origin + "/api/v2/reports", {
      method: "POST", headers: {origin, "content-type": "application/json"}, body: JSON.stringify({runId, kind}),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain("2024-25." + (kind === "csv" ? "csv" : "pdf"));
    return response;
  }

  const base = {
    portfolioId, taxYear: "2024-25" as const, historyThrough: "2025-05-05",
    personalScopeConfirmed: true, scopeDeclaration: CURRENT_SCOPE_DECLARATION, confirmedAccountIds: [accountId],
  };
  // Lack of the 30-day follow-up, and missing even one account declaration, both
  // require the filing split to stay out of customer exports.
  for (const inputs of [{...base, historyThrough: "2025-04-05"}, {...base, confirmedAccountIds: []}]) {
    const run = await workspace.calculate(user, inputs);
    const rows = Papa.parse<string[]>(await (await file(run.runId, "csv")).text()).data;
    expect(rows[0]).toEqual(["CGT Tracker calculation evidence", "DRAFT - incomplete calculation or account coverage"]);
    expect(rows.some(r => r[0] === "2024-25 rate periods (GBP)")).toBe(false);
    for (const kind of ["summary", "evidence"] as const) {
      const pdf = await PDFDocument.load(await (await file(run.runId, kind)).arrayBuffer());
      const text = reportPageText(pdf);
      expect(text).toContain("DRAFT - incomplete calculation or account coverage");
      expect(text).not.toContain("2024-25 rate periods");
    }
  }

  // The first security consumes its entire £10 pool in thirds. The other
  // security sells one of two shares bought together for £2.01, gaining exactly 0.5p.
  const run = await workspace.calculate(user, base);
  expect(run.coverageConfirmed).toBe(true);
  expect(run.result.poolMovements).toContainEqual(expect.objectContaining({
    securityId: "GB0031348658", date: "2025-04-05", quantityAfter: "0", costAfterGBP: "0",
  }));
  expect(run.result.summary).toMatchObject({
    proceedsGBP: "12.01", allowableCostsGBP: "11.01", gainsGBP: "3.34", lossesGBP: "2.33", netGainGBP: "1.01",
  });
  expect(run.result.disposals.find(s => s.securityId === "GB0005405286")?.gainGBP).toBe("0.01");
  const csv = Papa.parse<string[]>(await (await file(run.runId, "csv")).text()).data;
  expect(csv).toContainEqual(["Calculation reference",run.runId]);
  expect(csv).toContainEqual(["Net gain or loss","1.01"]);
  expect(csv).toContainEqual(["Annual", "", "Net sale proceeds less matched cost gives £1.00 from the displayed figures. The underlying amounts rounded once give £1.01."]);
  expect(csv).toContainEqual(["2024-04-06","2024-10-29","1.67","0.00","1.67"]);
  expect(csv).toContainEqual(["2024-10-30","2025-04-05","1.67","2.33","-0.67"]);
  expect(csv.some(row => row.includes(draft.draftId) && row.includes("CGT-RATE-BOUNDARY-S04"))).toBe(true);
  for (const kind of ["summary", "evidence"] as const) {
    const pdf = await PDFDocument.load(await (await file(run.runId, kind)).arrayBuffer());
    const text = reportPageText(pdf).replace(/\s+/g," ");
    expect(text).toContain("Net gain £1.01");
    expect(text).toContain("Net sale proceeds less matched cost gives £1.00 from the displayed figures. The underlying amounts rounded once give £1.01.");
    expect(text).toContain("6 April 2024 to 29 October 2024 · gains £1.67 · losses £0.00 · net £1.67");
    expect(text).toContain("30 October 2024 to 5 April 2025 · gains £1.67 · losses £2.33 · net -£0.67");
    if (kind === "evidence") {
      for (const ref of ["B01","B02","S01","S02","S03","S04"]) expect(text).toContain("CGT-RATE-BOUNDARY-" + ref);
      expect(text).toContain(draft.draftId);
    }
  }
}

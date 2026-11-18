import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import Papa from "papaparse";
import Decimal from "decimal.js";
import { reportPageText } from "./helpers/pdf-text";
import { calculateGains } from "../src/domain/cgt/calculate";
import {
  reportCsv,
  reportStatus,
  type ReportSnapshot,
} from "../src/domain/reports/report";
import { evidenceIssue } from "../src/domain/reports/eligibility";
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
  it("gives accountants the sale breakdown, fee rounding, import ID and all covered accounts", () => {
    const csv = reportCsv({
      ...snapshot,
      accounts: [
        { label: "First", broker: "ibkr", confirmed: true },
        { label: "Second with no trades", broker: "ajbell", confirmed: true },
      ],
      sources: [{ key: "sell", label: "First", broker: "ibkr", record: 2, instrument: null, reference: "S-5", importReference: "import-A" }],
    });
    const rows = Papa.parse<string[]>(csv, { delimiter: "," }).data;
    expect(rows).toContainEqual(["Gross disposal proceeds", "100.00"]);
    expect(rows).toContainEqual(["Selling costs", "2.00"]);
    expect(rows).toContainEqual(["Net sale proceeds", "98.00"]);
    expect(rows).toContainEqual(["Matched acquisition cost", "52.50"]);
    expect(rows).toContainEqual(["Total allowable costs", "54.50"]);
    expect(rows).toContainEqual(["Net sale proceeds rounding adjustment", "0.00"]);
    expect(rows).toContainEqual(["Second with no trades", "ajbell", "Yes"]);
    expect(rows).toContainEqual(["sell", "ibkr", "First", "2", "S-5", "", "import-A"]);
    const disposal = rows[rows.findIndex((r) => r[0] === "Date") + 1]!;
    expect(disposal.slice(8)).toEqual(["100.00", "2.00", "54.50", "0.00"]);
    const legacy = structuredClone(snapshot);
    delete legacy.result.saleBreakdown;
    for (const disposal of legacy.result.disposals) delete disposal.saleBreakdown;
    const legacyCsv = reportCsv(legacy);
    expect(legacyCsv).toContain('"Selling costs","UNAVAILABLE"');
    expect(legacyCsv).toContain('"Matched acquisition cost","52.50"');
    expect(legacyCsv).toContain("Recalculate this year");
  });
  it.each([
    { name: "gain", proceeds: [15], gains: ["5.00"], net: "5.00" },
    { name: "loss", proceeds: [5], gains: ["-5.00"], net: "-5.00" },
    { name: "break-even", proceeds: [10], gains: ["0.00"], net: "0.00" },
    {
      name: "mixed",
      proceeds: [15, 2, 10],
      gains: ["5.00", "-8.00", "0.00"],
      net: "-3.00",
    },
  ])(
    "exports numeric $name amounts matching the stored result and both PDFs",
    async ({ proceeds, gains, net }) => {
      const trade = { securityId: "GB0008706128", quantity: "1", feesGBP: "0" };
      const result = calculateGains(
        [
          {
            ...trade,
            id: "purchase",
            side: "BUY",
            date: "2024-04-06",
            quantity: String(proceeds.length),
            considerationGBP: String(10 * proceeds.length),
          },
          ...proceeds.map((amount, i) => ({
            ...trade,
            id: `-${i + 1}`,
            side: "SELL" as const,
            date: `2024-08-0${i + 1}`,
            considerationGBP: String(amount),
          })),
        ],
        { taxYear: "2024-25", historyThrough: "2025-05-05" },
      );
      const saved = { ...snapshot, result };
      const { data, errors } = Papa.parse<string[]>(reportCsv(saved), {
        delimiter: ",",
      });
      expect(errors).toEqual([]);
      const first = data.findIndex((r) => r[0] === "Date") + 1;
      const disposals = data.slice(first, first + proceeds.length);
      expect(disposals.map((r) => r[5])).toEqual(gains);
      expect(disposals.map((r) => r[7])).toEqual(
        proceeds.map((_, i) => `'-${i + 1}`),
      );
      const sum = disposals.reduce(
        (total, r) => total.add(r[5]!),
        new Decimal(0),
      );
      expect(sum.toFixed(2)).toBe(net);
      expect(data).toContainEqual(["netGainGBP", net]);
      expect(result.summary?.netGainGBP).toBe(net);
      for (const evidence of [false, true]) {
        const text = reportPageText(
          await PDFDocument.load(await reportPdf(saved, evidence)),
        );
        expect(text).toContain(
          `${net === "0.00" ? "Break-even" : net.startsWith("-") ? "Net loss" : "Net gain"}  £${net.replace("-", "")}`,
        );
        if (evidence)
          for (const gain of gains)
            expect(text).toContain(
              gain.startsWith("-") ? `-£${gain.slice(1)}` : `£${gain}`,
            );
      }
    },
  );
  it("checks both PDF limits inclusively and counts the rendered pool history", () => {
    const sale = {
      ...snapshot.result.disposals[0]!,
      sourceIds: [],
      matches: [],
    };
    const result = {
      ...snapshot.result,
      poolMovements: [],
      disposals: Array(5000).fill(sale),
    };
    expect(evidenceIssue(result)).toBeNull();
    expect(
      evidenceIssue({ ...result, disposals: [...result.disposals, sale] })
        ?.code,
    ).toBe("REPORT_TOO_LARGE");
    const saleWithRefs = { ...sale, sourceIds: Array(49998).fill("ref") };
    const movement = {
      ...snapshot.result.poolMovements![0]!,
      sourceIds: ["buy"],
    };
    const exact = {
      ...result,
      disposals: [saleWithRefs],
      poolMovements: [movement],
    };
    expect(evidenceIssue(exact)).toBeNull();
    expect(
      evidenceIssue({
        ...exact,
        poolMovements: [{ ...movement, sourceIds: ["buy", "buy2"] }],
      })?.code,
    ).toBe("REPORT_TOO_LARGE");
  });

  it("reconstructs partial and closed pools and explains every penny of disposal rounding", async () => {
    const template = { securityId: "GB0008706128", feesGBP: "0" };
    const trades = [
      {
        ...template,
        id: "source-buy",
        date: "2024-01-01",
        side: "BUY" as const,
        quantity: "3",
        considerationGBP: "10",
      },
      ...[1, 2, 3].map((i) => ({
        ...template,
        id: `source-sell-${i}`,
        date: `2024-09-0${i}`,
        side: "SELL" as const,
        quantity: "1",
        considerationGBP: "5",
      })),
    ];
    const options = {
      taxYear: "2024-25",
      historyThrough: "2025-05-05",
    } as const;
    const partial = calculateGains(trades.slice(0, 3), options);
    expect(partial.poolMovements?.at(-1)?.quantityAfter).toBe("1");
    expect(partial.pools[0]?.costGBP).toBe(
      partial.poolMovements?.at(-1)?.costAfterGBP,
    );
    const result = calculateGains(trades, options);
    expect(result.poolMovements?.at(-1)).toMatchObject({
      quantityAfter: "0",
      costAfterGBP: "0",
    });
    expect(result.summary?.netGainGBP).toBe("5.01");
    const saved = {
      ...snapshot,
      result,
      sources: [
        {
          key: "source-buy",
          label: "Example",
          broker: "ibkr",
          record: 2,
          instrument: null,
          reference: "IB-BUY",
          statementReference: "CN-BUY",
        },
      ],
    };
    const rows = Papa.parse<string[]>(reportCsv(saved), {
      delimiter: ",",
    }).data;
    expect(rows).toContainEqual([
      "2024-01-01",
      template.securityId,
      "acquisition",
      "3",
      "10",
      "3",
      "10",
      "source-buy",
    ]);
    expect(rows).toContainEqual(["Matched acquisition cost", "10.00", "-0.01", "9.99"]);
    expect(rows).toContainEqual(["Net gain or loss", "5.00", "0.01", "5.01"]);
    const pdf = reportPageText(
      await PDFDocument.load(await reportPdf(saved, true)),
    );
    expect(pdf).toContain("Section 104 pool movements");
    expect(pdf).toContain("Prior-year history · 1 January 2024");
    expect(pdf).toContain("Change: -1 share · cost -£3.33");
    expect(pdf).not.toContain("3.333333");
    expect(pdf).toContain("Execution reference: IB-BUY");
    expect(pdf).toContain("Statement reference: CN-BUY");
    expect(pdf).toContain("Balance: 0 shares · cost £0");
    expect(pdf).toContain(
      "Matched acquisition cost: annual £10.00 · rounding difference -£0.01 · reported £9.99",
    );
    expect(
      reportPageText(await PDFDocument.load(await reportPdf(saved, false))),
    ).toContain("Annual rounding reconciliation");
  });

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
  it("labels incomplete coverage and gives current acquisition guidance for saved drafts", async () => {
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
    result.issues[0]!.message = "Add an opening pool.";
    const saved = { ...snapshot, result };
    const csv = reportCsv(saved);
    expect(csv).toContain("UNRESOLVED");
    expect(csv).toContain("DRAFT");
    expect(csv).toContain("Upload the earlier purchases");
    for (const evidence of [false, true]) {
      const text = reportPageText(
        await PDFDocument.load(await reportPdf(saved, evidence)),
      );
      expect(text).toContain("Upload the earlier purchases");
      expect(text).not.toContain("opening pool");
    }
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
  it("prints a source once and keeps its identity and reference lines on the same page", async () => {
    const sources = Array.from({length: 30}, (_, i) => ({
      key: `trace-${i.toString().padStart(2, "0")}`,
      label: "Investor", broker: "ibkr", record: i + 2, instrument: "Example share",
      reference: `EXEC-${i.toString().padStart(2, "0")}`, statementReference: `NOTE-${i.toString().padStart(2, "0")}`,
    }));
    const sourceIds = sources.map(source => source.key);
    const disposal = {...snapshot.result.disposals[0]!, sourceIds};
    const movement = {...snapshot.result.poolMovements!.at(-1)!, sourceIds};
    const result = {...snapshot.result, disposals:[disposal], poolMovements:[movement]};
    const pdf = await PDFDocument.load(await reportPdf({...snapshot,result,sources}, true));
    const pages = pdf.getPages().map((_, i) => reportPageText(pdf, i));
    expect(pages.length).toBeGreaterThan(2);
    for (const source of sources) {
      const execution = `Execution reference: ${source.reference}`;
      expect(pages.join("\n").split(execution)).toHaveLength(2);
      const page = pages.find(page => page.includes(execution))!;
      expect(page).toContain(`file row ${source.record}\n${execution}`);
      expect(page).toContain(`Statement reference: ${source.statementReference}`);
      expect(page).toContain(`Trace reference: ${source.key}`);
    }
  });
  it("keeps the filing note on one evidence page and labels single-share trades", async () => {
    const disposal = snapshot.result.disposals[0]!;
    for (let accountCount = 1; accountCount <= 8; accountCount++) {
      const document = await PDFDocument.load(
        await reportPdf(
          {
            ...snapshot,
            accounts: Array.from({ length: accountCount }, (_, i) => ({
              label: `Example ${i}`,
              broker: "hl",
              confirmed: true,
            })),
            result: {
              ...snapshot.result,
              disposals: Array.from({ length: 4 }, () => ({
                ...disposal,
                quantity: "1",
                matches: disposal.matches.map((m) => ({ ...m, quantity: "1" })),
              })),
            },
          },
          true,
        ),
      );
      const pages = document
        .getPages()
        .map((_, i) => reportPageText(document, i).replace(/\s+/g, " "));
      const guidance = pages.find((page) =>
        page.includes("Before using these figures"),
      );
      expect(guidance).toContain(
        "The CSV retains full precision for matching and pool costs.",
      );
      expect(pages.join(" ")).toContain("1 share · cost");
      expect(pages.join(" ")).not.toContain("1 shares");
    }
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
  it("keeps CSV working during a billing outage without granting PDF access or leaking provider errors", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const entitled = vi.fn(async () => {
        throw new Error("private provider response and credentials");
      });
      const handler = createReportHandler({
        readSession: session,
        origin: "https://cgt.test",
        snapshot: async () => snapshot,
        entitled,
        consume: async () => {},
      });
      expect((await handler(request("csv"))).status).toBe(200);
      expect(entitled).not.toHaveBeenCalled();
      const response = await handler(request("summary"));
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("private provider");
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain("credentials");
    } finally {
      errorLog.mockRestore();
    }
  });
  it("limits large evidence PDFs while leaving the complete CSV and summary available", async () => {
    for (const disposals of [
      Array.from({ length: 5001 }, () => snapshot.result.disposals[0]!),
      [
        {
          ...snapshot.result.disposals[0]!,
          sourceIds: Array.from({ length: 50001 }, (_, i) => `source-${i}`),
        },
      ],
    ]) {
      const handler = createReportHandler({
        readSession: session,
        origin: "https://cgt.test",
        snapshot: async () => ({
          ...snapshot,
          result: { ...snapshot.result, disposals },
        }),
        entitled: async () => true,
        consume: async () => {},
      });
      const blocked = await handler(request("evidence"));
      expect(blocked.status).toBe(400);
      expect((await blocked.json()).error.code).toBe("REPORT_TOO_LARGE");
      const csv = await handler(request("csv"));
      expect(csv.status).toBe(200);
      expect(await csv.text()).toContain(disposals.at(-1)!.sourceIds.at(-1)!);
      const summary = await handler(request("summary"));
      expect(summary.status).toBe(200);
      expect(
        (await PDFDocument.load(await summary.arrayBuffer())).getPageCount(),
      ).toBeGreaterThan(0);
    }
  });
});

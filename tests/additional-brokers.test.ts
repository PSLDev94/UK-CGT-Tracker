import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import {
  reviewCsv,
  tradesFromReview,
  type ImportOptions,
} from "../src/domain/imports/review";
import {
  HL_HEADERS,
  II_HEADERS,
  AJ_HEADERS,
  IBKR_HEADERS,
} from "../src/domain/imports/additional-brokers";
import type { SupportingDetails } from "../src/domain/imports/supporting-details";
const detail: SupportingDetails = {
  isin: "GB0008706128",
  currency: "GBP",
  gbpPerUnit: "1",
  priceUnit: "minor",
  fees: "8.49",
  transactionId: "SYNTHETIC-AJ-001",
  reference: "Synthetic contract note 001",
  netAmountConfirmed: true,
};
const config = (
  broker: ImportOptions["broker"],
  supportingDetails: Record<string, SupportingDetails> = { "2": detail },
): ImportOptions => ({
  broker,
  accountId: "test",
  accountType: "GIA",
  format: "native",
  ordinarySharesConfirmed: true,
  supportingDetails,
});
const ii = Papa.unparse([
  II_HEADERS,
  [
    "01/06/2024",
    "03/06/2024",
    "LLOY",
    "0870612",
    "1000",
    "50",
    "Purchase ordinary shares",
    "SYNTHETIC-II-001",
    "508.49",
    "0",
    "1491.51",
  ],
]);
const hl = Papa.unparse([
  HL_HEADERS,
  [
    "01/06/2024",
    "03/06/2024",
    "B900000001",
    "Synthetic ordinary shares",
    "50",
    "1000",
    "-508.49",
  ],
]);
const aj = Papa.unparse([
  AJ_HEADERS,
  [
    "2024-06-01",
    "Synthetic ordinary shares",
    "Purchase",
    "1000",
    "50",
    "508.49",
  ],
]);
const ib = Papa.unparse([
  IBKR_HEADERS,
  [
    "SYNTHETIC",
    "STK",
    "GBP",
    "1",
    "GB0008706128",
    "12345",
    "20240601",
    "BUY",
    "1000",
    "0.5",
    "-500",
    "-3",
    "GBP",
    "-2.5",
    "-505.5",
    "EXECUTION",
  ],
]);
describe("additional broker readers with explicit evidence", () => {
  it.each([
    ["hl", hl],
    ["ii", ii],
    ["ajbell", aj],
  ] as const)(
    "reconciles %s consideration, net cash and verified fees",
    (broker, csv) => {
      const result = reviewCsv(csv, config(broker));
      expect(result.status).toBe("ready");
      expect(result.records[0]?.trade).toMatchObject({
        considerationGBP: "500",
        feesGBP: "8.49",
        securityId: detail.isin,
        date: "2024-06-01",
      });
      expect(
        result.records[0]?.provenance?.native?.supportingDetails?.reference,
      ).toBe(detail.reference);
      expect(
        reviewCsv(csv, config(broker, {})).records[0]?.canSupplyDetails,
      ).toBe(true);
      expect(() =>
        tradesFromReview(reviewCsv(csv, config(broker, {}))),
      ).toThrow();
    },
  );
  it("accepts only known HL preamble metadata and preserves trade record position", () => {
    const csv =
      "Transaction Summary,,,,\nClient Name:,Synthetic,,,\nClient Number:,SYNTHETIC,,,\n\n" +
      hl.replace("Value (£)", "Value (£),");
    const result = reviewCsv(csv, config("hl", { "5": detail }));
    expect(result.status).toBe("ready");
    expect(result.records[0]?.record).toBe(5);
    expect(
      reviewCsv(
        csv.replace("Client Number:", "Corporate action:"),
        config("hl", { "5": detail }),
      ).status,
    ).not.toBe("ready");
  });
  it.each([
    ["hl", hl],
    ["ii", ii],
    ["ajbell", aj],
  ] as const)(
    "blocks incorrect %s fees, units, evidence and ISINs",
    (broker, csv) => {
      for (const change of [
        { fees: "0" },
        { isin: "GB0008706129" },
        { netAmountConfirmed: false },
        { reference: "" },
        { gbpPerUnit: "0" },
      ])
        expect(
          reviewCsv(csv, config(broker, { "2": { ...detail, ...change } }))
            .status,
        ).not.toBe("ready");
      expect(
        reviewCsv(
          csv,
          config(broker, { "2": { ...detail, priceUnit: "major" } }),
        ).status,
      ).not.toBe("ready");
    },
  );
  it("does not synthesize AJ Bell execution IDs or collapse identical fills", () => {
    expect(
      reviewCsv(aj, config("ajbell", { "2": { ...detail, transactionId: "" } }))
        .status,
    ).not.toBe("ready");
    const rows = Papa.parse<string[]>(aj).data;
    const result = reviewCsv(
      Papa.unparse([...rows, rows[1]!]),
      config("ajbell", { "2": detail, "3": detail }),
    );
    expect(result.status).not.toBe("ready");
    expect(result.counts.needsReview).toBe(1);
  });
  it("reconciles signed IBKR executions, currency fees and net cash", () => {
    const result = reviewCsv(ib, config("ibkr", {}));
    expect(result.status).toBe("ready");
    expect(result.records[0]?.trade).toMatchObject({
      quantity: "1000",
      considerationGBP: "500",
      feesGBP: "5.5",
    });
    for (const [a, b] of [
      ["EXECUTION", "ORDER"],
      ["STK", "OPT"],
      ["12345", ""],
      ["-505.5", "-500"],
      ["-3", "3"],
    ])
      expect(reviewCsv(ib.replace(a!, b!), config("ibkr", {})).status).not.toBe(
        "ready",
      );
  });
  it("requires verified GBP base conversion for foreign IBKR trades", () => {
    const usd = ib.replaceAll("GBP", "USD").replace(",1,", ",0.8,");
    expect(reviewCsv(usd, config("ibkr", {})).status).not.toBe("ready");
    const result = reviewCsv(
      usd,
      config("ibkr", {
        "2": { ...detail, currency: "USD", gbpPerUnit: "0.8" },
      }),
    );
    expect(result.status).toBe("ready");
    expect(result.records[0]?.trade?.considerationGBP).toBe("400");
  });
  it("blocks added fees, unknown activity, mixed accounts and out-of-range details", () => {
    expect(
      reviewCsv(ii.replace("Purchase", "Transfer"), config("ii")).status,
    ).not.toBe("ready");
    expect(
      reviewCsv(aj.replace("Amount", "Amount,Extra fee"), config("ajbell"))
        .status,
    ).toBe("unsupported");
    expect(reviewCsv(ii, config("ii", { "5": detail })).status).not.toBe(
      "ready",
    );
    const rows = Papa.parse<string[]>(ib).data;
    expect(
      reviewCsv(
        Papa.unparse([...rows, ["OTHER", ...rows[1]!.slice(1)]]),
        config("ibkr", {}),
      ).status,
    ).not.toBe("ready");
  });
});

it.each([
  ["hl", "hl-assisted", "70.88"],
  ["ii", "ii-assisted", "70.88"],
  ["ajbell", "ajbell-assisted-candidate", "70.88"],
  ["ibkr", "ibkr-flex-gbp", "71.62"],
] as const)(
  "derives independently checked gains from the %s buy/sell fixture",
  async (broker, file, expected) => {
    const { readFileSync } = await import("node:fs");
    const { calculateGains } = await import("../src/domain/cgt/calculate");
    const csv = readFileSync(`tests/fixtures/brokers/${file}.csv`, "utf8");
    const supporting =
      broker === "ibkr"
        ? {}
        : JSON.parse(
            readFileSync(
              "tests/fixtures/brokers/assisted-details.json",
              "utf8",
            ),
          );
    const reviewed = reviewCsv(csv, config(broker, supporting));
    expect(reviewed.status).toBe("ready");
    expect(reviewed.counts).toEqual({
      total: 2,
      accepted: 2,
      excluded: 0,
      duplicate: 0,
      needsReview: 0,
    });
    const result = calculateGains(tradesFromReview(reviewed), {
      taxYear: "2024-25",
      historyThrough: "2025-05-05",
    });
    expect(result.summary?.netGainGBP).toBe(expected);
  },
);

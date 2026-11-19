import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  reviewCsv,
  tradesFromReview,
  type ImportOptions,
} from "../src/domain/imports/review";
import { calculateGains } from "../src/domain/cgt/calculate";
const csv = readFileSync(
  new URL("./fixtures/brokers/freetrade-gbp.csv", import.meta.url),
  "utf8",
);
const options: ImportOptions = {
  broker: "freetrade",
  accountId: "synthetic-fx",
  accountType: "GIA",
  format: "native",
  ordinarySharesConfirmed: true,
};
const rows = () =>
  Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  }).data;
const foreign = () =>
  rows()
    .slice(0, 2)
    .map((r, i) => ({
      ...r,
      ISIN: "US0378331005",
      Ticker: "AAPL",
      "Instrument Currency": "USD",
      Quantity: i ? "50" : "100",
      "Price per Share": i ? "15" : "12.5",
      "Price per Share in Account Currency": i ? "12" : "10",
      "Total Shares Amount": i ? "750" : "1250",
      "Total Amount": i ? "597.30" : "1004.50",
      "Stamp Duty": "0",
      "Base FX Rate": "1.25",
      "FX Rate": i ? "1.255625" : "1.244375",
      "FX Fee (BPS)": "45",
      "FX Fee Amount": i ? "2.70" : "4.50",
    }));
const evidence = (fees: string) => ({
  isin: "US0378331005",
  currency: "USD",
  gbpPerUnit: "0.8",
  priceUnit: "major" as const,
  fees,
  transactionId: "",
  reference: "Synthetic foreign execution contract",
  netAmountConfirmed: true,
});
const withEvidence = {
  ...options,
  supportingDetails: { "2": evidence("5.625"), "3": evidence("3.375") },
};
describe("Freetrade verified foreign fees and explicit renamed columns", () => {
  it("includes FX dealing costs exactly once on buys and sells", () => {
    const review = reviewCsv(Papa.unparse(foreign()), withEvidence);
    expect(review.status, JSON.stringify(review.issues)).toBe("ready");
    expect(
      review.records.map((r) => [r.trade?.considerationGBP, r.trade?.feesGBP]),
    ).toEqual([
      ["1000", "4.5"],
      ["600", "2.7"],
    ]);
    const result = calculateGains(tradesFromReview(review), {
      taxYear: "2024-25",
      historyThrough: "2025-05-05",
    });
    expect(result.summary?.netGainGBP).toBe("95.05");
    expect(result.pools[0]?.costGBP).toBe("502.25");
    expect(
      review.records[0]?.provenance?.native?.supportingDetails?.gbpPerUnit,
    ).toBe("0.8");
  });
  it.each([
    { "FX Fee Amount": "4.49" },
    { "FX Fee (BPS)": "44" },
    { "FX Fee (BPS)": "10000" },
    { "FX Fee (BPS)": "" },
    { "Base FX Rate": "1.24" },
    { "FX Rate": "1.255625" },
    { "FX Rate": "" },
    { "Total Amount": "995.50" },
    { "Total Shares Amount": "1251" },
    { "Price per Share in Account Currency": "10.01" },
    { "Stamp Duty": "1" },
    { "Account Currency": "USD" },
  ])("blocks inconsistent foreign evidence: %j", (change) => {
    const r = foreign();
    Object.assign(r[0]!, change);
    expect(reviewCsv(Papa.unparse(r), withEvidence).status).not.toBe("ready");
  });
  it("shows both conflicting penny values and directs an immutable FX discrepancy to the source", () => {
    for (const [column, value, message] of [
      ["Price per Share in Account Currency", "10.0001", /£1000\.01.*£1000\.00.*contract note/],
      ["FX Fee Amount", "4.49", /£4\.49.*£4\.50.*contract note/],
    ] as const) {
      const rows = foreign();
      rows[0]![column] = value;
      const record = reviewCsv(Papa.unparse(rows), withEvidence).records[0];
      expect(record).toMatchObject({ status: "needs_review", canSupplyDetails: false });
      expect(record?.reason).toMatch(message);
    }
  });
  it("requires evidence and rejects a fee-inclusive conversion or incorrect fees", () => {
    const source = Papa.unparse(foreign());
    expect(reviewCsv(source, options).status).toBe("needs_review");
    for (const change of [
      { gbpPerUnit: "0.8036" },
      { fees: "0" },
      { isin: "GB0008706128" },
    ])
      expect(
        reviewCsv(source, {
          ...withEvidence,
          supportingDetails: {
            ...withEvidence.supportingDetails,
            "2": { ...evidence("5.625"), ...change },
          },
        }).status,
      ).not.toBe("ready");
  });
  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])(
    "recognises only the documented amount aliases (%s, %s)",
    (account, instrument) => {
      let renamed = csv;
      if (account)
        renamed = renamed.replace(
          "Total Amount,",
          "Total Amount in Account Currency,",
        );
      if (instrument)
        renamed = renamed.replace(
          "Total Shares Amount,",
          "Total Amount in Instrument Currency,",
        );
      const review = reviewCsv(renamed, options);
      expect(review.status).toBe("ready");
      expect(
        calculateGains(tradesFromReview(review), {
          taxYear: "2024-25",
          historyThrough: "2025-05-05",
        }).summary?.netGainGBP,
      ).toBe("74.38");
      const existing = new Map(
        reviewCsv(csv, options)
          .records.filter((r) => r.sourceKey)
          .map((r) => [r.sourceKey!, r.digest!]),
      );
      const reexport = reviewCsv(renamed, { ...options, existing });
      expect(reexport.counts.accepted).toBe(0);
      expect(
        reexport.issues.filter((i) => i.code === "DUPLICATE_CONFLICT"),
      ).toHaveLength(2);
    },
  );
  it("rejects ambiguous aliases and additional fee or stock-split columns", () => {
    for (const header of [
      "Total Amount in Account Currency",
      "Stock Split Ratio",
      "Other FX Fee",
    ]) {
      const r = rows();
      r[0]![header] = "1";
      expect(reviewCsv(Papa.unparse(r), options).status).toBe("unsupported");
    }
  });
});

it.each(["MONTHLY_STATEMENT", "TAX_CERTIFICATE"])(
  "accounts for %s document notifications without dropping financial activity",
  (type) => {
    const r = rows();
    const document = Object.fromEntries(
      Object.keys(r[0]!).map((key) => [key, ""]),
    );
    Object.assign(document, {
      Title: "Synthetic statement notification",
      Type: type,
      Timestamp: "2024-09-01T12:00:00.000Z",
      "Account Currency": "GBP",
    });
    const review = reviewCsv(Papa.unparse([...r, document]), options);
    expect(review.status).toBe("ready");
    expect(review.counts).toMatchObject({
      total: 4,
      accepted: 2,
      excluded: 2,
      needsReview: 0,
    });
    expect(review.records[3]?.reason).toContain("Statement notification");
    for (const field of [
      "Quantity",
      "Total Amount",
      "Order ID",
      "FX Fee Amount",
      "Dividend Net Distribution Amount",
    ]) {
      const suspicious = reviewCsv(
        Papa.unparse([...r, { ...document, [field]: "1" }]),
        options,
      );
      expect(suspicious.status).toBe("needs_review");
      expect(() => tradesFromReview(suspicious)).toThrow();
    }
    expect(
      reviewCsv(
        Papa.unparse([...r, { ...document, Type: "UNRECOGNISED_STATEMENT" }]),
        options,
      ).status,
    ).toBe("needs_review");
  },
);

it("uses exported source currencies, prices and fees without a user unit decision", async () => {
  const { feesInTradeCurrency } = await import("../src/domain/imports/exported-terms");
  const rows = foreign();
  const preview = reviewCsv(Papa.unparse(rows), options);
  const terms = preview.records[0]!.exportedTerms!;
  expect(terms).toMatchObject({
    isin: "US0378331005", accountCurrency: "GBP", currency: "USD",
    priceUnit: "major", feesGBP: "4.5", gbpPerUnit: "0.8",
  });
  expect(feesInTradeCurrency(terms, terms.gbpPerUnit!)).toBe("5.625");
  const noRate = { ...rows[0], "Base FX Rate": "", "FX Rate": "", "FX Fee (BPS)": "", "FX Fee Amount": "", "Total Amount": "1000" };
  const missing = reviewCsv(Papa.unparse([noRate]), options).records[0]!.exportedTerms!;
  expect(missing.gbpPerUnit).toBeUndefined();
  expect(feesInTradeCurrency(missing, "0.8")).toBe("0");
  expect(reviewCsv(Papa.unparse([noRate]), {
    ...options, supportingDetails: { "2": evidence("0") },
  }).status).toBe("ready");
  expect(reviewCsv(Papa.unparse(rows), {
    ...withEvidence, supportingDetails: { ...withEvidence.supportingDetails, "2": { ...evidence("5.625"), priceUnit: "minor" } },
  }).records[0]?.provenance?.native?.supportingDetails?.priceUnit).toBe("major");
});

it("blocks genuine changes to a repeated Freetrade execution even when the new cash reconciles", () => {
  const rows = foreign();
  const saved = reviewCsv(Papa.unparse(rows), withEvidence).records[0]!;
  const existing = new Map([[saved.sourceKey!, saved.digest!]]);
  for (const [change, supplement] of [
    [{ "Stamp Duty": "1", "Total Amount": "1005.50" }, {fees: "6.875"}],
    [{ "Quantity": "200", "Price per Share": "6.25", "Price per Share in Account Currency": "5" }, {}],
    [{ ISIN: "GB0008706128" }, {isin: "GB0008706128"}],
    [{ Timestamp: "2024-06-01T12:30:00.000Z" }, {}],
    [{ "FX Fee (BPS)": "50", "FX Fee Amount": "5", "FX Rate": "1.24375", "Total Amount": "1005" }, {fees: "6.25"}],
    [{ "Base FX Rate": "2", "FX Rate": "1.991", "Price per Share in Account Currency": "6.25",
       "FX Fee Amount": "2.81", "Total Amount": "627.81" }, {fees: "5.62", gbpPerUnit: "0.5"}],
  ] as const) {
    const review = reviewCsv(Papa.unparse([{...rows[0], ...change}, rows[1]!]), {
      ...withEvidence, existing,
      supportingDetails: { ...withEvidence.supportingDetails, "2": {...evidence("5.625"), ...supplement} },
    });
    expect(review.issues, JSON.stringify(change)).toContainEqual(expect.objectContaining({code: "DUPLICATE_CONFLICT", record: 2}));
    expect(review.counts.accepted).toBe(1);
    expect(review.status).toBe("needs_review");
  }
});

it.each([
  [{ ISIN: "missing" }, /exported ISIN/],
  [{ "Instrument Currency": "ZZZ" }, /instrument currency/],
  [{ "Base FX Rate": "0" }, /exchange rate/],
  [{ "Base FX Rate": "unknown" }, /exchange rate/],
  [{ "FX Fee Amount": "?" }, /FX fee/],
] as const)("identifies unusable exported fields before opening an editor: %j", (change, explanation) => {
  const review = reviewCsv(Papa.unparse([{ ...foreign()[0], ...change }]), options);
  expect(review.records[0]?.status).toBe("needs_review");
  expect(review.records[0]?.canSupplyDetails).toBe(false);
  expect(review.records[0]?.reason).toMatch(explanation);
});

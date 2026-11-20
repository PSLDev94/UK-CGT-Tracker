import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import {
  reviewCsv,
  tradesFromReview,
  type ImportOptions,
} from "../src/domain/imports/review";
import { TRADING212_HEADERS } from "../src/domain/imports/native";
import { calculateGains } from "../src/domain/cgt/calculate";

const csv = readFileSync(
  new URL("./fixtures/brokers/trading212-2026-gbp.csv", import.meta.url),
  "utf8",
);
const options: ImportOptions = {
  broker: "trading212",
  accountId: "test",
  accountType: "GIA",
  format: "native",
  ordinarySharesConfirmed: true,
};
it.each([
  ["trading212", "Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result (GBP),Total (GBP),Withholding tax,Currency (Withholding tax),Charge amount (GBP),Transaction fee (GBP),Finra fee,Currency (Finra fee),Notes,ID", "older Invest history"],
  ["trading212", "Action,Time (UTC),ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Currency (Result),Total,Currency (Total),ID", "stock split"],
  ["ibkr", "ClientAccountID,CurrencyPrimary,Symbol,Conid,Date/Time,Exchange,Buy/Sell,Quantity,Price,OrigTradeID,TraderID,OrderID,OrderReference,IsAPIOrder", "Several executions can share one order ID"],
] as const)("identifies the observed %s report and explains how to recover", (broker, header, hint) => {
  const file = Papa.unparse([header.split(","), header.split(",").map(()=> "synthetic")]);
  const result = reviewCsv(file,{...options, broker});
  expect(result.status).toBe("unsupported");
  expect(result.issues[0]?.message).toContain(hint);
  expect(result.counts).toMatchObject({accepted:0, needsReview:1});
});
const mutate = (fields: Record<string, string>) => {
  const rows = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  }).data;
  Object.assign(rows[0]!, fields);
  return Papa.unparse(rows);
};
describe("Trading 212 33-column variant", () => {
  it.each([
    ["Market sell", "Stamp duty reserve tax", "497.50"],
    ["Limit sell", "French transaction tax", "497.50"],
    ["Market buy", "Finra fee", "502.50"],
  ])("holds %s with a cash-balanced but contradictory %s charge", (action, fee, cash) => {
    const altered = mutate({
      Action: action, Total: cash, "Transaction fee": "", "Stamp duty reserve tax": "",
      [fee]: "2.50", [`Currency (${fee})`]: "GBP",
    });
    const result = reviewCsv(altered, options);
    expect(result.parserVersion).toBe("trading212-invest-33-v3");
    expect(result.counts.needsReview).toBe(1);
    expect(result.issues[0]?.message).toContain(fee);
    expect(() => tradesFromReview(result)).toThrow();
  });
  it("allows a separately identified sale FINRA fee that reconciles to actual cash", () => {
    const result = reviewCsv(mutate({
      Action: "Limit sell", Total: "499.97", "Transaction fee": "",
      "Stamp duty reserve tax": "", "Finra fee": "0.03", "Currency (Finra fee)": "GBP",
    }), options);
    expect(result.status, JSON.stringify(result.issues)).toBe("ready");
    expect(result.records[0]?.trade?.feesGBP).toBe("0.03");
  });
  it("includes stamp duty and dealing charges in the independently checked pool", () => {
    const review = reviewCsv(csv, options);
    expect(review.status, JSON.stringify(review.issues)).toBe("ready");
    expect(review.records[0]!.trade?.feesGBP).toBe("4");
    expect(review.records[0]!.provenance?.native?.format).toBe(
      "trading212-invest-33-v1",
    );
    const result = calculateGains(tradesFromReview(review), {
      taxYear: "2024-25",
      historyThrough: "2025-05-05",
    });
    expect(result.summary?.netGainGBP).toBe("72.00");
  });
  it("reconciles foreign transaction tax and GBP conversion fees without guessing currencies", () => {
    const foreign = mutate({
      "Currency (Price / share)": "EUR",
      "Price / share": "1",
      "Exchange rate": "1.25",
      Total: "803.60",
      "Transaction fee": "",
      "Stamp duty reserve tax": "",
      "French transaction tax": "3",
      "Currency (French transaction tax)": "EUR",
      "Currency conversion fee": "1.20",
      "Currency (Currency conversion fee)": "GBP",
    });
    const details = {
      isin: "GB0008706128",
      currency: "EUR",
      gbpPerUnit: "0.8",
      fees: "4.5",
      priceUnit: "major" as const,
      transactionId: "",
      reference: "Synthetic EUR execution note",
      netAmountConfirmed: true as const,
    };
    expect(reviewCsv(foreign, options).status).toBe("needs_review");
    const review = reviewCsv(foreign, {
      ...options,
      supportingDetails: { "2": details },
    });
    expect(review.status, JSON.stringify(review.issues)).toBe("ready");
    expect(review.records[0]!.trade?.considerationGBP).toBe("800");
    expect(review.records[0]!.trade?.feesGBP).toBe("3.6");
  });
  it.each<Record<string, string>>([
    { "Finra fee": "1", "Currency (Finra fee)": "USD" },
    { "French transaction tax": "1", "Currency (French transaction tax)": "" },
    { "Stamp duty reserve tax": "9" },
    { "Currency conversion from amount": "100" },
    { "Merchant name": "Unexpected card purchase" },
    { "Time (UTC)": "2024-06-01T12:00:00+01:00" },
    { Action: "Stock split" },
    { "Unrecognised levy": "1" },
  ])("blocks inconsistent or unexplained columns: %j", (fields) => {
    expect(reviewCsv(mutate(fields), options).status).not.toBe("ready");
  });
  it("accepts explicitly UTC timestamps and normalises London tax-day boundaries", () => {
    const review = reviewCsv(
      mutate({
        "Time (UTC)": "2024-06-01T23:30:00+00:00",
        "Exchange rate": "",
      }),
      options,
    );
    expect(review.status, JSON.stringify(review.issues)).toBe("ready");
    expect(review.records[0]!.trade?.date).toBe("2024-06-02");
  });
  it("rejects identical reuploads without saving the trades twice", () => {
    const first = reviewCsv(csv, options);
    const existing = new Map(
      first.records
        .filter((r) => r.sourceKey)
        .map((r) => [r.sourceKey!, r.digest!]),
    );
    const retry = reviewCsv(csv, { ...options, existing });
    expect(retry.counts.duplicate).toBe(2);
    expect(retry.status).toBe("needs_review");
  });
  it("blocks changed-format reexports of the same execution IDs for provenance review", () => {
    const current = reviewCsv(csv, options);
    const existing = new Map(
      current.records
        .filter((r) => r.sourceKey)
        .map((r) => [r.sourceKey!, r.digest!]),
    );
    const rows = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    }).data;
    const legacy = rows.map((row) =>
      Object.fromEntries(
        TRADING212_HEADERS.map((header) => [
          header,
          header === "Time"
            ? row["Time (UTC)"]
            : header === "Transaction fee"
              ? String(
                  Number(row["Transaction fee"]) +
                    Number(row["Stamp duty reserve tax"]),
                )
              : row[header] || "",
        ]),
      ),
    );
    const review = reviewCsv(Papa.unparse(legacy), { ...options, existing });
    expect(review.status).toBe("needs_review");
    expect(review.counts.accepted).toBe(0);
    expect(
      review.issues.filter((issue) => issue.code === "DUPLICATE_CONFLICT"),
    ).toHaveLength(2);
    expect(review.records.map((r) => r.sourceKey)).toEqual(
      current.records.map((r) => r.sourceKey),
    );
  });
});

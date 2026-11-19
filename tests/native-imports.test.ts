import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import {
  reviewCsv,
  tradesFromReview,
  type ImportOptions,
} from "../src/domain/imports/review";
import { ukTradeDate } from "../src/domain/imports/native";
import { calculateGains } from "../src/domain/cgt/calculate";

const fixture = (name: string) =>
  readFileSync(
    new URL(`./fixtures/brokers/${name}.csv`, import.meta.url),
    "utf8",
  );
const options = (broker: ImportOptions["broker"]): ImportOptions => ({
  broker,
  accountId: "synthetic",
  accountType: "GIA",
  format: "native",
  ordinarySharesConfirmed: true,
  latestTradeDate: "2026-11-16",
});
function change(csv: string, column: string, value: string, index = 0) {
  const data = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  }).data;
  data[index]![column] = value;
  return Papa.unparse(data);
}

describe("source-documented native GBP preview readers", () => {
  it.each(["freetrade", "trading212"] as const)(
    "accounts for every %s record and derives independently checked gains",
    (broker) => {
      const review = reviewCsv(fixture(`${broker}-gbp`), options(broker));
      expect(review.counts).toEqual({
        total: 3,
        accepted: 2,
        excluded: 1,
        duplicate: 0,
        needsReview: 0,
      });
      const result = calculateGains(tradesFromReview(review), {
        taxYear: "2024-25",
        historyThrough: "2025-05-05",
      });
      // Freetrade: allocated cost (500+2.50)/1000*250 = 125.625.
      // Exact gain is 200 − 125.625 = 74.375, displayed as 74.38.
      // Trading 212: 10.50 - 10.50/10.5*5.25 = 5.25.
      expect(result.summary?.netGainGBP).toBe(
        broker === "freetrade" ? "74.38" : "5.25",
      );
      expect(review.records[0]?.provenance?.native).toMatchObject({
        ordinarySharesConfirmed: true,
      });
      expect(review.parserVersion).toContain(
        broker === "freetrade" ? "freetrade-activity" : "trading212-invest",
      );
    },
  );
  it.each(["freetrade", "trading212"] as const)(
    "requires explicit asset classification for %s even with valid ISINs",
    (broker) => {
      const result = reviewCsv(fixture(`${broker}-gbp`), {
        ...options(broker),
        ordinarySharesConfirmed: false,
      });
      expect(result.counts).toMatchObject({
        accepted: 0,
        excluded: 1,
        needsReview: 2,
      });
      expect(result.issues[0]?.message).toContain("ordinary share");
      expect(() => tradesFromReview(result)).toThrow();
    },
  );
  it.each(["freetrade", "trading212"] as const)(
    "rejects %s foreign currency and corporate actions without a partial commit",
    (broker) => {
      for (const variant of ["foreign-review", "corporate-action-review"]) {
        const review = reviewCsv(
          fixture(`${broker}-${variant}`),
          options(broker),
        );
        expect(review.status).toBe("needs_review");
        expect(review.counts.needsReview).toBeGreaterThan(0);
        expect(() => tradesFromReview(review)).toThrow();
      }
    },
  );
  it.each(["freetrade", "trading212"] as const)(
    "reconciles %s duplicates across imports but does not collapse ambiguous executions",
    (broker) => {
      const csv = fixture(`${broker}-gbp`),
        opts = options(broker);
      const first = reviewCsv(csv, opts);
      const existing = new Map(
        first.records.flatMap((r) =>
          r.sourceKey && r.digest ? [[r.sourceKey, r.digest]] : [],
        ),
      );
      expect(reviewCsv(csv, { ...opts, existing }).counts).toMatchObject({
        duplicate: 2,
        accepted: 0,
      });
      const time = broker === "freetrade" ? "Timestamp" : "Time";
      const correction = change(
        csv,
        time,
        broker === "freetrade"
          ? "2024-06-01T12:01:00.000Z"
          : "2024-06-01 12:01:00.000",
      );
      expect(reviewCsv(correction, { ...opts, existing }).issues[0]?.code).toBe(
        "DUPLICATE_CONFLICT",
      );
      const rows = Papa.parse<string[]>(csv, { skipEmptyLines: true }).data;
      rows.push(rows[1]!);
      const ambiguous = reviewCsv(Papa.unparse(rows), opts);
      expect(ambiguous.counts.needsReview).toBe(2);
      expect(() => tradesFromReview(ambiguous)).toThrow();
    },
  );
  it.each(["freetrade", "trading212"] as const)(
    "rejects added/renamed/missing %s columns, preserving raw record accountability",
    (broker) => {
      const csv = fixture(`${broker}-gbp`);
      for (const altered of [
        change(csv, "New fee", "1"),
        csv.replace("ISIN", "Unknown identifier"),
        csv.replace("ISIN,", ""),
      ]) {
        const review = reviewCsv(altered, options(broker));
        expect(review.status).toBe("unsupported");
        expect(review.counts.accepted).toBe(0);
        expect(review.counts.needsReview).toBe(3);
      }
    },
  );
  it.each([
    ["Total Amount", "502.51"],
    ["Total Shares Amount", "500.01"],
    ["Price per Share", "50"],
    ["FX Fee Amount", "0.01"],
    ["Stamp Duty", "-2.5"],
    ["Quantity", "0"],
    ["Price per Share", "0"],
    ["Buy / Sell", "BUY_PENDING"],
    ["Type", "FREESHARE_ORDER"],
    ["Order ID", ""],
    ["ISIN", "LLOY"],
    ["Account Currency", "USD"],
    ["Instrument Currency", "GBX"],
    ["Base FX Rate", "1.2"],
    ["Timestamp", "2024-02-30T12:00:00.000Z"],
    ["Timestamp", "2024-06-01T24:00:00.000Z"],
  ])("blocks invalid Freetrade %s=%s", (column, value) => {
    expect(
      reviewCsv(
        change(fixture("freetrade-gbp"), column, value),
        options("freetrade"),
      ).status,
    ).toBe("needs_review");
  });
  it.each([
    ["Total", "10.51"],
    ["Transaction fee", "0.01"],
    ["Currency conversion fee", "0.01"],
    ["Exchange rate", "0"],
    ["Price / share", "0"],
    ["No. of shares", "0"],
    ["Action", "Stock distribution"],
    ["Action", "Dividend (Tax exempted)"],
    ["Currency (Price / share)", "GBX"],
    ["ID", ""],
    ["ISIN", "US0378331006"],
    ["Time", "2024-06-01 24:00:00.000"],
  ])("blocks invalid Trading 212 %s=%s", (column, value) => {
    expect(
      reviewCsv(
        change(fixture("trading212-gbp"), column, value),
        options("trading212"),
      ).status,
    ).toBe("needs_review");
  });
  it("uses UK calendar days across BST, the tax-year boundary and leap days", () => {
    expect(ukTradeDate("2024-04-05T23:30:00.000Z")).toBe("2024-04-06");
    expect(ukTradeDate("2024-01-05T23:30:00Z")).toBe("2024-01-05");
    expect(ukTradeDate("2024-02-29T12:00:00Z")).toBe("2024-02-29");
    expect(() => ukTradeDate("2023-02-29T12:00:00Z")).toThrow();
  });
  it.each([
    ["hl", "hl-contract-note-required", "contract note"],
    ["ii", "ii-wallet-review", "currency"],
    ["ibkr", "ibkr-transaction-history-review", "Flex Query"],
    ["ajbell", "ajbell-unverified-illustration", "ISIN"],
  ] as const)(
    "gives a specific, non-invented recovery path for %s",
    (broker, name, reason) => {
      const review = reviewCsv(fixture(name), options(broker));
      expect(review.status).toBe(
        broker === "ibkr" ? "unsupported" : "needs_review",
      );
      expect(review.issues[0]?.message).toContain(reason);
      expect(review.counts.accepted).toBe(0);
      expect(review.counts.needsReview).toBe(review.counts.total);
      expect(() => tradesFromReview(review)).toThrow();
    },
  );
  it("does not infer the broker or accept a canonical file as a native export", () => {
    expect(
      reviewCsv(fixture("freetrade-gbp"), options("trading212")).status,
    ).toBe("unsupported");
  });
  it("accepts reordered headers, quoted commas, BOM and CRLF without losing provenance", () => {
    const csv = fixture("freetrade-gbp");
    const rows = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    }).data;
    rows[0]!.Title = "Synthetic, ordinary share";
    const reversed = rows.map((r) =>
      Object.fromEntries(Object.entries(r).reverse()),
    );
    const review = reviewCsv(
      "\uFEFF" + Papa.unparse(reversed),
      options("freetrade"),
    );
    expect(review.status).toBe("ready");
    expect(review.records[0]?.provenance?.native?.fields.Title).toBe(
      "Synthetic, ordinary share",
    );
    const existing = new Map(
      review.records.flatMap((r) =>
        r.sourceKey && r.digest ? [[r.sourceKey, r.digest]] : [],
      ),
    );
    expect(
      reviewCsv(Papa.unparse(rows), { ...options("freetrade"), existing })
        .counts.duplicate,
    ).toBe(2);
  });
});

it("reconciles Trading 212 GBP dealing fees and explicit pence prices", () => {
  const csv = fixture("trading212-gbp");
  const fee = change(
    change(
      change(csv, "Transaction fee", "0.50"),
      "Currency (Transaction fee)",
      "GBP",
    ),
    "Total",
    "11.00",
  );
  const reviewed = reviewCsv(fee, options("trading212"));
  expect(reviewed.status).toBe("ready");
  expect(reviewed.records[0]?.trade?.feesGBP).toBe("0.5");
  const pence = change(
    change(csv, "Currency (Price / share)", "GBX"),
    "Price / share",
    "100",
  );
  expect(
    reviewCsv(pence, options("trading212")).records[0]?.trade?.considerationGBP,
  ).toBe("10.5");
});
it("requires explicit, reconciling evidence for foreign Freetrade and Trading 212 trades", () => {
  const evidence = {
    isin: "GB0008706128",
    currency: "USD",
    gbpPerUnit: "0.8",
    priceUnit: "major" as const,
    fees: "3.125",
    transactionId: "",
    reference: "Synthetic FX contract note 001",
    netAmountConfirmed: true,
  };
  const freetrade = reviewCsv(fixture("freetrade-foreign-review"), {
    ...options("freetrade"),
    supportingDetails: { "2": evidence },
  });
  expect(freetrade.status).toBe("ready");
  expect(freetrade.records[0]?.trade?.considerationGBP).toBe("500");
  const csv = change(fixture("trading212-foreign-review"), "Total", "8.40");
  const t212 = reviewCsv(csv, {
    ...options("trading212"),
    supportingDetails: { "2": { ...evidence, fees: "0" } },
  });
  expect(t212.status).toBe("ready");
  expect(t212.records[0]?.trade?.considerationGBP).toBe("8.4");
  expect(
    reviewCsv(csv, {
      ...options("trading212"),
      supportingDetails: {
        "2": { ...evidence, fees: "0", gbpPerUnit: "1.25" },
      },
    }).status,
  ).toBe("needs_review");
});

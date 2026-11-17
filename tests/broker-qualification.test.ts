import Papa from "papaparse";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  brokerCases,
  fixture,
  fixtureRows,
  fixtureDetails,
  syntheticTrade,
} from "./helpers/broker-corpus";
import {
  reviewCsv,
  tradesFromReview,
  type ImportOptions,
} from "../src/domain/imports/review";
import { calculateGains } from "../src/domain/cgt/calculate";

const calculate = (review: ReturnType<typeof reviewCsv>) =>
  calculateGains(tradesFromReview(review), {
    taxYear: "2024-25",
    historyThrough: "2025-05-05",
  });
const pounds = (cents: bigint) =>
  `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, "0")}`;
for (const c of brokerCases)
  describe(c.file, () => {
    const options: ImportOptions = {
      broker: c.broker,
      accountId: "qualification",
      accountType: "GIA",
      format: "native",
      ordinarySharesConfirmed: true,
      supportingDetails: fixtureDetails(c),
      latestTradeDate: "2026-11-17",
    };
    it("preserves the result under column reorder, BOM, CRLF and quoted multiline descriptions", () => {
      const rows = fixtureRows(c);
      // IBKR has no description field in this strict execution layout.
      if (c.broker !== "ibkr")
        rows[0]![c.label] = 'Synthetic, "quoted"\nsecurity';
      const reordered = rows.map((r) =>
        Object.fromEntries(Object.entries(r).reverse()),
      );
      const review = reviewCsv(
        "\uFEFF" + Papa.unparse(reordered, { newline: "\r\n", quotes: true }),
        options,
      );
      expect(review.status, JSON.stringify(review.issues)).toBe("ready");
      expect(calculate(review).summary?.netGainGBP).toBe(c.gain);
    });
    it("blocks cash errors, unsupported activity, missing fields and unknown financial columns without partial commitment", () => {
      const variations: string[] = [];
      for (const change of [
        { [c.amount]: "999999" },
        { [c.activity]: "UNSUPPORTED CORPORATE ACTION" },
        { "Unverified levy": "10" },
      ]) {
        const rows = fixtureRows(c);
        Object.assign(rows[0]!, change);
        variations.push(Papa.unparse(rows));
      }
      const raw = Papa.parse<string[]>(fixture(c), {
        skipEmptyLines: true,
      }).data;
      raw[1]!.pop();
      variations.push(Papa.unparse(raw));
      for (const csv of variations) {
        const review = reviewCsv(csv, options);
        expect(review.status).not.toBe("ready");
        expect(() => tradesFromReview(review)).toThrow();
      }
    });
    it("accounts for each record and detects exact retries and conflicting corrections", () => {
      const review = reviewCsv(fixture(c), options);
      expect(review.status).toBe("ready");
      expect(review.counts.total).toBe(
        review.counts.accepted +
          review.counts.excluded +
          review.counts.duplicate +
          review.counts.needsReview,
      );
      const existing = new Map(
        review.records
          .filter((r) => r.sourceKey)
          .map((r) => [r.sourceKey!, r.digest!]),
      );
      const retry = reviewCsv(fixture(c), { ...options, existing });
      expect(retry.counts.accepted).toBe(0);
      expect(retry.counts.duplicate).toBe(2);
      expect(() => tradesFromReview(retry)).toThrow();
      const rows = fixtureRows(c);
      rows[0]![c.label] =
        c.broker === "ibkr" ? "2024-06-02" : "Corrected description";
      const changed = reviewCsv(Papa.unparse(rows), { ...options, existing });
      expect(changed.issues.some((i) => i.code === "DUPLICATE_CONFLICT")).toBe(
        true,
      );
      expect(() => tradesFromReview(changed)).toThrow();
    });
    it("reconciles generated fractional acquisitions against integer-pence arithmetic", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 999999 }),
          fc.integer({ min: 0, max: 2000 }),
          (units, feePence) => {
            // Quantity in thousandths × £10 gives an exact integer number of pence.
            const quantity = `${Math.floor(units / 1000)}.${String(units % 1000).padStart(3, "0")}`;
            const trade = syntheticTrade(c, {
              id: "10001",
              date: "2024-06-01",
              side: "BUY",
              quantity,
              price: "10",
              gross: pounds(BigInt(units)),
              fees: pounds(BigInt(feePence)),
              net: pounds(BigInt(units + feePence)),
            });
            const review = reviewCsv(Papa.unparse([trade.row]), {
              ...options,
              supportingDetails: ["hl", "ii", "ajbell"].includes(c.broker)
                ? { "2": trade.details }
                : {},
            });
            expect(review.status, JSON.stringify(review.issues)).toBe("ready");
            const result = calculate(review);
            expect(result.pools[0]!.costGBP).toBe(
              pounds(BigInt(units + feePence)).replace(/\.?0+$/, ""),
            );
            expect(result.pools[0]!.quantity).toBe(String(units / 1000));
          },
        ),
        { numRuns: 75, seed: 20261117 },
      );
    });
    it("passes same-day, 30-day and pooled matching after native upload normalization", () => {
      const inputs = [
        {
          id: "10001",
          date: "2024-04-10",
          side: "BUY" as const,
          quantity: "100",
          price: "10",
          gross: "1000",
          fees: "10",
          net: "1010",
        },
        {
          id: "10002",
          date: "2024-06-01",
          side: "SELL" as const,
          quantity: "60",
          price: "20",
          gross: "1200",
          fees: "0",
          net: "1200",
        },
        {
          id: "10003",
          date: "2024-06-01",
          side: "BUY" as const,
          quantity: "10",
          price: "11",
          gross: "110",
          fees: "0",
          net: "110",
        },
        {
          id: "10004",
          date: "2024-06-30",
          side: "BUY" as const,
          quantity: "20",
          price: "12",
          gross: "240",
          fees: "0",
          net: "240",
        },
      ].map((x) => syntheticTrade(c, x));
      const review = reviewCsv(Papa.unparse(inputs.map((x) => x.row)), {
        ...options,
        supportingDetails: ["hl", "ii", "ajbell"].includes(c.broker)
          ? Object.fromEntries(inputs.map((x, i) => [String(i + 2), x.details]))
          : {},
      });
      expect(review.status, JSON.stringify(review.issues)).toBe("ready");
      const result = calculate(review);
      expect(result.summary?.netGainGBP).toBe("547.00");
      expect(
        result.disposals[0]!.matches.map((m) => [
          m.rule,
          m.quantity,
          m.costGBP,
        ]),
      ).toEqual([
        ["SAME_DAY", "10", "110"],
        ["THIRTY_DAY", "20", "240"],
        ["SECTION_104", "30", "303"],
      ]);
      expect(result.pools).toEqual([
        { securityId: "GB0008706128", quantity: "70", costGBP: "707" },
      ]);
    });
  });

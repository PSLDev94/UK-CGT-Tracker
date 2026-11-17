import { expect, it } from "vitest";
import {
  CANONICAL_HEADERS,
  MAX_CSV_BYTES,
  MAX_RECORDS,
  reviewCsv,
  tradesFromReview,
} from "../src/domain/imports/review";
import { calculateGains } from "../src/domain/cgt/calculate";
const options = {
  broker: "trading212" as const,
  accountId: "boundary",
  accountType: "GIA" as const,
  format: "canonical-v1" as const,
};
it("accepts exactly 100,000 distinct executions and conserves their quantities and costs", () => {
  const csv =
    CANONICAL_HEADERS.join(",") +
    "\n" +
    Array.from(
      { length: MAX_RECORDS },
      (_, i) => `${i},2024-06-01,BUY,GB0008706128,1,1,0,GBP,1,ORDINARY_SHARE`,
    ).join("\n");
  expect(Buffer.byteLength(csv)).toBeLessThan(MAX_CSV_BYTES);
  const review = reviewCsv(csv, options);
  expect(review.status).toBe("ready");
  expect(review.counts).toEqual({
    total: 100000,
    accepted: 100000,
    excluded: 0,
    duplicate: 0,
    needsReview: 0,
  });
  const result = calculateGains(tradesFromReview(review), {
    taxYear: "2024-25",
    historyThrough: "2025-05-05",
  });
  expect(result.pools).toEqual([
    { securityId: "GB0008706128", quantity: "100000", costGBP: "100000" },
  ]);
}, 15000);
it("rejects record-count overflow before accepting any trades", () => {
  const csv =
    CANONICAL_HEADERS.join(",") +
    "\n" +
    "x,2024-06-01,BUY,GB0008706128,1,1,0,GBP,1,ORDINARY_SHARE\n".repeat(
      MAX_RECORDS + 1,
    );
  const review = reviewCsv(csv, options);
  expect(review.issues[0]?.code).toBe("INVALID_FILE");
  expect(review.records).toHaveLength(0);
  expect(() => tradesFromReview(review)).toThrow();
});
it("measures the file cap in UTF-8 bytes, including multibyte characters", () => {
  const csv = "£".repeat(Math.floor(MAX_CSV_BYTES / 2) + 1);
  expect(csv.length).toBeLessThan(MAX_CSV_BYTES);
  const review = reviewCsv(csv, options);
  expect(review.issues[0]?.message).toContain("10 MiB");
  expect(review.records).toHaveLength(0);
});

it.each(["\u0001", "\u000b", "\u001f", "\u007f"])(
  "rejects unsupported control characters instead of accepting hidden content",
  (control) => {
    const csv =
      CANONICAL_HEADERS.join(",") +
      `\nx${control},2024-06-01,BUY,GB0008706128,1,1,0,GBP,1,ORDINARY_SHARE`;
    expect(reviewCsv(csv, options).issues[0]?.code).toBe("INVALID_FILE");
  },
);

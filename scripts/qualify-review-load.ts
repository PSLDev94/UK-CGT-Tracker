import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import {
  reviewCsv,
  CANONICAL_HEADERS,
  tradesFromReview,
} from "../src/domain/imports/review";
import { calculateGains } from "../src/domain/cgt/calculate";
import { reportPdf } from "../src/domain/reports/pdf";
async function main() {
  const count = 10000;
  const csv = [
    CANONICAL_HEADERS.join(","),
    ...Array.from({ length: count }, (_, n) =>
      [
        `SYNTHETIC-${n}`,
        n < 7500 ? "2024-01-01" : "2024-07-01",
        n < 7500 ? "BUY" : "SELL",
        "GB0008706128",
        "1",
        n < 7500 ? "1" : "2",
        "0",
        "GBP",
        "1",
        "ORDINARY_SHARE",
      ].join(","),
    ),
  ].join("\n");
  const start = performance.now();
  const review = reviewCsv(csv, {
    broker: "trading212",
    accountId: "synthetic-load",
    accountType: "GIA",
    format: "canonical-v1",
  });
  const parsed = performance.now();
  assert.equal(review.counts.accepted, count);
  const result = calculateGains(tradesFromReview(review), {
    taxYear: "2024-25",
    historyThrough: "2025-05-05",
  });
  const calculated = performance.now();
  assert.equal(result.summary?.netGainGBP, "2500.00");
  const pdf = await reportPdf(
    {
      id: "SYNTHETIC-LOAD",
      input_digest: review.fileDigest,
      created_at: "2026-11-17T12:00:00Z",
      coverage_confirmed: true,
      result,
    },
    true,
  );
  console.log(
    JSON.stringify({
      records: count,
      csvBytes: Buffer.byteLength(csv),
      parseMs: Math.round(parsed - start),
      calculateMs: Math.round(calculated - parsed),
      evidencePdfMs: Math.round(performance.now() - calculated),
      pdfBytes: pdf.length,
      rssMiB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    }),
  );
}
void main().catch(() => {
  console.error("Synthetic review load qualification failed");
  process.exitCode = 1;
});

import { expect, it } from "vitest";
import { reviewCsv } from "../src/domain/imports/review";
import { reviewPage } from "../src/server/workspace-api";
import { longFreetradeStatement } from "./helpers/freetrade-statement";

it("locates actionable and read-only blockers by position across the complete statement", () => {
  const review = reviewCsv(longFreetradeStatement("QA-PAGES"), {
    broker: "freetrade",
    accountId: "test",
    accountType: "GIA",
    format: "native",
    ordinarySharesConfirmed: true,
  });
  expect(review.counts.needsReview).toBe(1);
  expect(reviewPage(review, 1).nextUnresolved).toMatchObject({
    record: 202,
    page: 3,
    canSupplyDetails: true,
  });
  expect(reviewPage(review, 1).records).toHaveLength(100);
  // A native file can have preamble lines before the header. Page boundaries
  // still follow the list of source outcomes, not the broker's record numbers.
  for (const row of review.records) row.record += 7;
  const blocker = review.records[99]!;
  blocker.status = "needs_review";
  blocker.canSupplyDetails = false;
  expect(reviewPage(review, 1).nextUnresolved).toMatchObject({
    record: 108,
    page: 1,
  });
  expect(reviewPage(review, 1).sourceBlockerCount).toBe(1);
  review.records[200]!.status = "accepted";
  expect(reviewPage(review, 3).nextUnresolved).toMatchObject({
    record: 108,
    page: 1,
    canSupplyDetails: false,
  });
  blocker.status = "accepted";
  expect(reviewPage(review, 1).nextUnresolved).toBeNull();
});

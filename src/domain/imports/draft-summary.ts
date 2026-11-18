import type { ImportReview } from "./review";
import { sourceIdentity } from "./source-identity";

export interface DraftSummary {
  fileName: string | null;
  recordCount: number;
  firstTradeDate: string | null;
  lastTradeDate: string | null;
  firstUnresolvedTrade: string | null;
}

export function draftSummary(review: ImportReview, fileName?: string | null): DraftSummary {
  const basename = fileName?.split(/[\\/]/).pop()?.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
  let firstTradeDate: string | null = null;
  let lastTradeDate: string | null = null;
  for (const row of review.records) {
    const date = row.trade?.date;
    if (!date) continue;
    if (!firstTradeDate || date < firstTradeDate) firstTradeDate = date;
    if (!lastTradeDate || date > lastTradeDate) lastTradeDate = date;
  }
  const unresolved = review.records.find((row) => row.canSupplyDetails && row.status === "needs_review");
  const identity = sourceIdentity(unresolved?.source);
  const tradeHint = [identity.date, identity.description, identity.executionReference].filter(Boolean)
    .map((value) => [...value!.replace(/[\p{Cc}\p{Cf}]/gu, "").trim()].slice(0, 96).join(""))
    .filter(Boolean).join(" · ");
  return {
    fileName: basename && basename !== "." && basename !== ".." ? [...basename].slice(0, 255).join("") : null,
    recordCount: review.counts.total,
    firstTradeDate,
    lastTradeDate,
    firstUnresolvedTrade: tradeHint || null,
  };
}

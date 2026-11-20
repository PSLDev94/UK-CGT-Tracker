import type { Disposal } from "../domain/cgt/types";

export type DisposalLocation = { runId: string; disposal: number; source: number };

// A source position belongs to one immutable calculation run.
export function readDisposalLocation(value?: string | null): DisposalLocation | null {
  const match = typeof value === "string"
    && /^([a-zA-Z0-9-]{1,64})\.(0|[1-9]\d{0,7})\.(0|[1-9]\d{0,7})$/.exec(value);
  return match && match[1]
    ? { runId: match[1], disposal: Number(match[2]), source: Number(match[3]) }
    : null;
}

export function disposalSourceKeys(disposal: Disposal) {
  // Grouped sales and their matches can reference the same source row.
  return [...new Set([
    ...disposal.sourceIds,
    ...disposal.matches.flatMap((match) => match.acquisitionIds ?? []),
  ])];
}

export function calculationSourceHref(year: string, source?: string) {
  const params = new URLSearchParams({ year });
  if (source && readDisposalLocation(source)) params.set("source", source);
  return "/dashboard/calculations?" + params;
}

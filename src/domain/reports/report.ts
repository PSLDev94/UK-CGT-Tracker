import type { Calculation } from "../cgt/types";
import { csvCell } from "../imports/review";

export interface ReportSnapshot {
  id: string;
  input_digest: string;
  created_at: string | Date;
  coverage_confirmed: boolean;
  result: Calculation;
}
export type ReportKind = "csv" | "summary" | "evidence";
export function reportStatus(snapshot: ReportSnapshot) {
  return snapshot.result.status === "complete" && snapshot.coverage_confirmed
    ? "Complete calculation - check before filing"
    : "DRAFT - incomplete calculation or account coverage";
}
/** Exports the stored calculation, never a second calculation with different rounding. */
export function reportCsv(snapshot: ReportSnapshot): string {
  const r = snapshot.result;
  const rows: string[][] = [
    ["CGT Tracker calculation evidence", reportStatus(snapshot)],
    ["Tax year", r.taxYear],
    ["Calculation reference", snapshot.id],
    ["Input fingerprint", snapshot.input_digest],
    ["Engine", r.engineVersion],
    ["History through", r.historyThrough],
    ["Required history through", r.requiredHistoryThrough],
    ["Account coverage confirmed", String(snapshot.coverage_confirmed)],
    [
      "Scope",
      "Ordinary share gains and losses only. Not a tax return or personal tax liability.",
    ],
    [],
    [
      "Date",
      "ISIN",
      "Quantity",
      "Net proceeds GBP",
      "Allowable costs GBP",
      "Gain/loss GBP",
      "Unmatched quantity",
      "Source transaction references",
    ],
    ...r.disposals.map((d) => [
      d.date,
      d.securityId,
      d.quantity,
      d.proceedsGBP,
      d.allowableCostGBP ?? "UNRESOLVED",
      d.gainGBP ?? "UNRESOLVED",
      d.unmatchedQuantity,
      d.sourceIds.join("; "),
    ]),
    [],
    [
      "Disposal date",
      "ISIN",
      "Matching rule",
      "Matched quantity",
      "Matched cost GBP",
      "Acquisition date",
      "Acquisition references",
    ],
    ...r.disposals.flatMap((d) =>
      d.matches.map((m) => [
        d.date,
        d.securityId,
        m.rule,
        m.quantity,
        m.costGBP,
        m.acquisitionDate ?? "",
        m.acquisitionIds?.join("; ") ?? "Section 104 pool",
      ]),
    ),
    [],
    ["Pool date", "ISIN", "Quantity", "Pool cost GBP"],
    ...r.pools.map((p) => [r.poolAsOf, p.securityId, p.quantity, p.costGBP]),
    [],
    ["Issue", "ISIN", "Date", "Quantity"],
    ...r.issues.map((i) => [i.message, i.securityId, i.date, i.quantity]),
  ];
  if (r.summary)
    rows.push(
      [],
      ["Summary (GBP)", "Amount"],
      ...Object.entries(r.summary).map(([k, v]) => [k, v]),
    );
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

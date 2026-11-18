import {
  missingAcquisitionGuidance,
  type Calculation,
  type CalculationIssue,
} from "../cgt/types";
import { csvCell } from "../imports/review";

export interface ReportSource {
  key: string;
  label: string;
  broker: string;
  record: number;
  instrument: string | null;
  reference: string | null;
  statementReference?: string | null;
}
export interface ReportSnapshot {
  sources?: ReportSource[];
  id: string;
  input_digest: string;
  created_at: string | Date;
  coverage_confirmed: boolean;
  accounts?: { label: string; broker: string; confirmed: boolean }[];
  result: Calculation;
}
export type ReportKind = "csv" | "summary" | "evidence";
// Stored calculations can contain older wording for a missing acquisition.
export const reportIssueMessage = (issue: CalculationIssue) =>
  issue.code === "MISSING_ACQUISITION_HISTORY"
    ? missingAcquisitionGuidance
    : issue.message;

type ReportCell = string | { decimal: string };
const numberCell = (value: string | null): ReportCell =>
  value === null ? "UNRESOLVED" : { decimal: value };

function encodeCell(cell: ReportCell): string {
  if (typeof cell === "string") return csvCell(cell);
  // Only stored numeric fields get this exception to spreadsheet text escaping.
  // Quantities and pool costs may use Decimal's exponential representation.
  return /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/.test(cell.decimal)
    ? `"${cell.decimal}"`
    : csvCell(cell.decimal);
}
export function reportStatus(snapshot: ReportSnapshot) {
  return snapshot.result.status === "complete" && snapshot.coverage_confirmed
    ? "Complete calculation - check before filing"
    : "DRAFT - incomplete calculation or account coverage";
}
/** Exports the stored calculation, never a second calculation with different rounding. */
export function reportCsv(snapshot: ReportSnapshot): string {
  const r = snapshot.result;
  const rows: ReportCell[][] = [
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
      numberCell(d.quantity),
      numberCell(d.proceedsGBP),
      numberCell(d.allowableCostGBP),
      numberCell(d.gainGBP),
      numberCell(d.unmatchedQuantity),
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
        numberCell(m.quantity),
        numberCell(m.costGBP),
        m.acquisitionDate ?? "",
        m.acquisitionIds?.join("; ") ?? "Section 104 pool",
      ]),
    ),
    [],
    ["Pool date", "ISIN", "Quantity", "Pool cost GBP"],
    ...r.pools.map((p) => [
      r.poolAsOf,
      p.securityId,
      numberCell(p.quantity),
      numberCell(p.costGBP),
    ]),
    [],
    ["Issue", "ISIN", "Date", "Quantity"],
    ...r.issues.map((i) => [
      reportIssueMessage(i),
      i.securityId,
      i.date,
      numberCell(i.quantity),
    ]),
  ];
  if (r.summary)
    rows.push(
      [],
      ["Summary (GBP)", "Amount"],
      ...Object.entries(r.summary).map(([k, v]) => [k, numberCell(v)]),
    );
  return (
    "\uFEFF" + rows.map((row) => row.map(encodeCell).join(",")).join("\r\n")
  );
}

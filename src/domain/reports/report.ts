import {
  missingAcquisitionGuidance,
  saleBreakdownUnavailable,
  type Calculation,
  type CalculationIssue,
} from "../cgt/types";
import { roundingDifferences } from "./rounding";
import { csvCell } from "../imports/review";

export interface ReportSource {
  key: string;
  label: string;
  broker: string;
  record: number;
  instrument: string | null;
  reference: string | null;
  statementReference?: string | null;
  importReference?: string;
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

const evidenceAmount = (value: string | null | undefined): ReportCell =>
  value === undefined ? "UNAVAILABLE" : numberCell(value);

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
      "Net sale proceeds GBP",
      "Matched acquisition cost GBP",
      "Gain/loss GBP",
      "Unmatched quantity",
      "Source transaction references",
      "Gross disposal proceeds GBP",
      "Selling costs GBP",
      "Total allowable costs GBP",
      "Net sale proceeds rounding adjustment GBP",
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
      evidenceAmount(d.saleBreakdown?.grossProceedsGBP),
      evidenceAmount(d.saleBreakdown?.sellingCostsGBP),
      evidenceAmount(d.saleBreakdown?.totalAllowableCostsGBP),
      evidenceAmount(d.saleBreakdown?.proceedsRoundingAdjustmentGBP),
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
  if (!r.saleBreakdown) rows.push([], ["Selling cost evidence", saleBreakdownUnavailable]);
  if (r.summary)
    rows.push(
      [],
      ["Annual sale breakdown (GBP)", "Amount"],
      ["Gross disposal proceeds", evidenceAmount(r.saleBreakdown?.grossProceedsGBP)],
      ["Selling costs", evidenceAmount(r.saleBreakdown?.sellingCostsGBP)],
      ["Net sale proceeds", numberCell(r.summary.proceedsGBP)],
      ["Matched acquisition cost", numberCell(r.summary.allowableCostsGBP)],
      ["Total allowable costs", evidenceAmount(r.saleBreakdown?.totalAllowableCostsGBP)],
      ["Net sale proceeds rounding adjustment", evidenceAmount(r.saleBreakdown?.proceedsRoundingAdjustmentGBP)],
      ["Net gain or loss", numberCell(r.summary.netGainGBP)],
      [],
      ["Calculation keys", "proceedsGBP is net sale proceeds. allowableCostsGBP is matched acquisition cost."],
      ["Summary (GBP)", "Amount"],
      ...Object.entries(r.summary).map(([k, v]) => [k, numberCell(v)]),
    );
  if (snapshot.accounts) {
    rows.push([], ["Account coverage", "Broker", "History confirmed"]);
    for (const account of snapshot.accounts)
      rows.push([account.label, account.broker, account.confirmed ? "Yes" : "No"]);
  }
  if (r.poolMovements) {
    rows.push(
      [],
      ["Section 104 pool movements"],
      [
        "Date",
        "ISIN",
        "Movement",
        "Share change",
        "Cost change GBP",
        "Pool shares after",
        "Pool cost after GBP",
        "Source transaction references",
      ],
    );
    for (const movement of r.poolMovements)
      rows.push([
        movement.date,
        movement.securityId,
        movement.kind,
        numberCell(movement.quantityChange),
        numberCell(movement.costChangeGBP),
        numberCell(movement.quantityAfter),
        numberCell(movement.costAfterGBP),
        movement.sourceIds.join("; "),
      ]);
  } else {
    rows.push(
      [],
      [
        "Section 104 movements",
        "Recalculate this year to include verified pool history.",
      ],
    );
  }
  if (snapshot.sources?.length) {
    rows.push(
      [],
      [
        "Trace reference",
        "Broker",
        "Account",
        "File row",
        "Execution reference",
        "Statement reference",
        "Import reference",
      ],
    );
    for (const source of snapshot.sources)
      rows.push([
        source.key,
        source.broker,
        source.label,
        numberCell(String(source.record)),
        source.reference ?? "",
        source.statementReference ?? "",
        source.importReference ?? "",
      ]);
  }
  const differences = roundingDifferences(r);
  if (differences.length) {
    rows.push(
      [],
      ["Annual rounding reconciliation (GBP)"],
      [
        "Measure",
        "Rounded once for the year",
        "Per-disposal rounding difference",
        "Reported total",
      ],
    );
    for (const d of differences)
      rows.push([
        d.label,
        numberCell(d.annual),
        numberCell(d.adjustment),
        numberCell(d.reported),
      ]);
  }
  return (
    "\uFEFF" + rows.map((row) => row.map(encodeCell).join(",")).join("\r\n")
  );
}

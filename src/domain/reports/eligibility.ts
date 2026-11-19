import { CURRENT_SCOPE_DECLARATION, missingAcquisitionGuidance, type Calculation, type CalculationIssue } from "../cgt/types";
import { TAX_YEARS, type TaxYear } from "../values";

export interface ReportIssue {
  code:
    | "REPORT_INCOMPLETE"
    | "REPORT_TOO_LARGE"
    | "REPORT_NEEDS_REFRESH"
    | "REPORT_UNAVAILABLE"
    | "NO_DISPOSALS"
    | "PENDING_IMPORTS";
  message: string;
}

const reportDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

export const scopeStatement = (result: Calculation) =>
  result.scopeDeclaration === CURRENT_SCOPE_DECLARATION
    ? "The investor confirmed personal ownership in the same capacity, UK residence throughout the matching history including later repurchases, and ordinary market purchases or sales at arm’s length."
    : result.scopeDeclaration === "personal-uk-resident-v1"
    ? "The investor confirmed personal ownership and UK residence. This earlier declaration did not cover the tax basis of each transaction."
    : "This calculation has no recorded ownership and UK residence declaration.";

export function noDisposalsLabel(result: Calculation, coverageConfirmed: boolean) {
  if (result.historyThrough < TAX_YEARS[result.taxYear as TaxYear].end)
    return `No disposals through ${reportDate.format(new Date(result.historyThrough))}`;
  return coverageConfirmed ? "No disposals in this tax year" : "No disposals in the included account history";
}

export function unresolvedPoolIssues(result: Calculation): CalculationIssue[] {
  const bySecurity = new Map<string, CalculationIssue>();
  for (const issue of result.issues)
    if (!bySecurity.has(issue.securityId)) bySecurity.set(issue.securityId, issue);
  return [...bySecurity.values()].sort((a, b) => a.securityId.localeCompare(b.securityId));
}

export function reportIssueMessage(issue: CalculationIssue) {
  if (issue.scope === "pool")
    return "The Section 104 pool needs a reviewed opening position. This security had no disposals in the assessed period.";
  return issue.code === "MISSING_ACQUISITION_HISTORY" ? missingAcquisitionGuidance : issue.message;
}

export function purchaseIssue(result: Calculation, coverageConfirmed: boolean): ReportIssue | null {
  if (!coverageConfirmed || result.status !== "complete" || !result.summary) {
    const blocker = result.issues.find(issue => issue.scope !== "pool");
    const reason = blocker ? reportIssueMessage(blocker)
      : result.hasLaterSales ? "Your portfolio already includes sales after this cutoff. Extend the history date and recalculate."
      : result.status === "provisional" ? `Extend the history through ${reportDate.format(new Date(result.requiredHistoryThrough))} to check later purchases, then recalculate.`
      : "Confirm the complete account history for this year and recalculate.";
    return { code: "REPORT_INCOMPLETE", message: `Only a draft is available for ${result.taxYear}. ${reason} The free CSV contains the available evidence.` };
  }
  if (!result.disposals.length)
    return { code: "NO_DISPOSALS", message: `There are no saved disposals in ${result.taxYear}. Check the tax year or upload a file containing sales before buying a PDF.` };
  return null;
}

export const EVIDENCE_LIMITS = { disposalGroups: 5000, references: 50000 };
const tooLarge: ReportIssue = {
  code: "REPORT_TOO_LARGE",
  message:
    "This calculation exceeds the evidence PDF limit of 5,000 disposal groups or 50,000 matching and pool references.",
};

/** Bound the actual report workload, including pool history from before the tax year. */
export function evidenceIssue(result: Calculation): ReportIssue | null {
  if (result.disposals.length > EVIDENCE_LIMITS.disposalGroups) return tooLarge;
  let count = 0;
  for (const disposal of result.disposals) {
    count += disposal.sourceIds.length;
    for (const match of disposal.matches)
      count += 1 + (match.acquisitionIds?.length ?? 0);
    if (count > EVIDENCE_LIMITS.references) return tooLarge;
  }
  for (const movement of result.poolMovements ?? []) {
    count += 1 + movement.sourceIds.length;
    if (count > EVIDENCE_LIMITS.references) return tooLarge;
  }
  if (!result.poolMovements)
    return {
      code: "REPORT_NEEDS_REFRESH",
      message:
        "Recalculate this year to include verified Section 104 pool history in the evidence PDF.",
    };
  return null;
}

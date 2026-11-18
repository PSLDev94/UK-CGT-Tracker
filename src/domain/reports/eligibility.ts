import type { Calculation } from "../cgt/types";

export interface ReportIssue {
  code:
    | "REPORT_TOO_LARGE"
    | "REPORT_NEEDS_REFRESH"
    | "REPORT_UNAVAILABLE"
    | "PENDING_IMPORTS";
  message: string;
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

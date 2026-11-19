import type { Calculation } from "../cgt/types";
import type { TaxYear } from "../values";

export const sa108Collection =
  "https://www.gov.uk/government/publications/self-assessment-capital-gains-summary-sa108";
export const adjustment2024Url = "https://www.gov.uk/guidance/work-out-your-capital-gains-tax-adjustment-for-the-2024-to-2025-tax-year";
export const adjustment2024Note = "For 2024–25, separate disposals before 30 October 2024 from those on or after that date. The main share gain rates changed mid-year. Check whether your tax return needs an adjustment in SA108 box 51.";

export const filingReview = "Reconcile all taxable accounts, trade dates, exchange rates and fees with your statements and contract notes. Check corporate actions and later repurchases across brokers. Ask a qualified UK tax adviser if the cost, ownership or tax treatment is unclear.";

export function confirmedRatePeriods(result: Calculation, coverageConfirmed: boolean) {
  return result.taxYear === "2024-25" && result.status === "complete" && coverageConfirmed && result.summary
    ? result.ratePeriods ?? []
    : [];
}

export const ratePeriodsNote = "Figures are before allowances and reliefs. For each period and the full year, we calculate gains, losses and net using unrounded amounts. Adding or subtracting the displayed figures can give a difference of one penny.";

const hmrc = "https://assets.publishing.service.gov.uk/media/";
const archive = "https://webarchive.nationalarchives.gov.uk/ukgwa/";

// HMRC removes older editions from its live collection. The National Archives
// preserves the original form and notes for the 2021–22 edition.
const editions = {
  "2021-22": {
    form:
      archive +
      "20250307060826id_/" +
      hmrc +
      "623c6d53d3bf7f6ac0a1404f/sa108-2022.pdf",
    notes:
      archive +
      "20250307060851id_/" +
      hmrc +
      "623c6d9ad3bf7f6ab57107c5/sa108-Notes-2022.pdf",
  },
  "2022-23": {
    form: hmrc + "642ae09bddf8ad0013ac0c7e/SA108_2023.pdf",
    notes: hmrc + "65cf59050f4eb10011a9817c/SA108_Notes_2023.pdf",
  },
  "2023-24": {
    form: hmrc + "660bbb40f9ab417b75eea375/sa108_2024.pdf",
    notes: hmrc + "660bbb5e91a3206e4382b06b/SA108_Notes_2024.pdf",
  },
  "2024-25": {
    form: hmrc + "67e160d5d8e313b503358cc8/sa108-2025.pdf",
    notes: hmrc + "67e1612564220b68ed6a7009/SA108-Notes-2025.pdf",
  },
  "2025-26": {
    form: hmrc + "69bd8990cfa346b9d47049e4/SA108-2026.pdf",
    notes: hmrc + "6a02e5df4fb0713aa63ea77c/SA108-Notes-2026.pdf",
  },
  "2026-27": null,
} satisfies Record<TaxYear, { form: string; notes: string } | null>;

export function sa108Edition(year: string) {
  return Object.hasOwn(editions, year) ? editions[year as TaxYear] : null;
}

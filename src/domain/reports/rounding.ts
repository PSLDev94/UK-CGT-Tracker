import type { AnnualAmounts, Calculation, SaleBreakdown } from "../cgt/types";
import { ExactAmount } from "../cgt/exact-amount";

const fields: Record<keyof AnnualAmounts, string> = {
  proceedsGBP: "Net sale proceeds",
  allowableCostsGBP: "Matched acquisition cost",
  gainsGBP: "Gains",
  lossesGBP: "Losses",
  netGainGBP: "Net gain or loss",
};

export function roundingComparisonLabel(result: Calculation) {
  return result.displayedDisposalTotals ? "Sum of displayed disposals" : "Rounded once for the year";
}

export function annualRoundingNote(result: Calculation) {
  return result.displayedDisposalTotals
    ? "The reported annual figures use the unrounded amounts for every disposal. Adding the amounts shown to pence can give a different result."
    : "This earlier calculation added the displayed disposal amounts. The comparison rounds the full-precision total once for the year.";
}

export function roundingDifferences(result: Calculation) {
  const comparison = result.displayedDisposalTotals ?? result.annualBeforeDisposalRounding;
  const reported = result.summary;
  if (!comparison || !reported) return [];
  return (Object.keys(fields) as (keyof AnnualAmounts)[]).flatMap(key => {
    const adjustment = ExactAmount.from(reported[key]).minus(ExactAmount.from(comparison[key]));
    return adjustment.isZero() ? [] : [{
      label: fields[key], comparison: comparison[key], adjustment: adjustment.toFixed(2), reported: reported[key],
    }];
  });
}

function pounds(value: string) {
  return value.startsWith("-") ? "-£" + value.slice(1) : "£" + value;
}

/** Explain visible residuals only. No missing cost or gain is inferred here. */
export function componentRoundingNotes(
  net: string, matched: string | null, gain: string | null, basis?: SaleBreakdown,
  summary?: Pick<AnnualAmounts, "gainsGBP" | "lossesGBP">,
) {
  const notes: string[] = [];
  function compare(label: string, components: ExactAmount, reported: string) {
    if (!components.minus(ExactAmount.from(reported)).isZero())
      notes.push(`${label} gives ${pounds(components.toFixed(2))} from the displayed figures. The underlying amounts rounded once give ${pounds(reported)}.`);
  }
  if (gain !== null && matched !== null)
    compare("Net sale proceeds less matched cost", ExactAmount.from(net).minus(ExactAmount.from(matched)), gain);
  if (matched !== null && basis?.totalAllowableCostsGBP != null)
    compare("Matched cost plus selling costs", ExactAmount.from(matched).plus(ExactAmount.from(basis.sellingCostsGBP)), basis.totalAllowableCostsGBP);
  if (gain !== null && summary)
    compare("Gains less losses", ExactAmount.from(summary.gainsGBP).minus(ExactAmount.from(summary.lossesGBP)), gain);
  return notes;
}

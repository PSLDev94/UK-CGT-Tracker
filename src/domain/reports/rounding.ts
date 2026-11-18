import type { AnnualAmounts, Calculation } from "../cgt/types";
import { Money } from "../values";

const fields: Record<keyof AnnualAmounts, string> = {
  proceedsGBP: "Net proceeds",
  allowableCostsGBP: "Allowable costs",
  gainsGBP: "Gains",
  lossesGBP: "Losses",
  netGainGBP: "Net gain or loss",
};

/** Difference from rounding once after aggregation to the published sum of penny-rounded disposals. */
export function roundingDifferences(result: Calculation) {
  const before = result.annualBeforeDisposalRounding,
    saved = result.summary;
  if (!before || !saved) return [];
  return (Object.keys(fields) as (keyof AnnualAmounts)[]).flatMap((key) => {
    const adjustment = new Money(saved[key]).minus(before[key]);
    return adjustment.isZero()
      ? []
      : [
          {
            label: fields[key],
            annual: before[key],
            adjustment: adjustment.toFixed(2),
            reported: saved[key],
          },
        ];
  });
}

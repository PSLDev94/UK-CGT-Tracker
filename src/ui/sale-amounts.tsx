import {
  saleBreakdownUnavailable,
  type SaleBreakdown, type AnnualAmounts,
} from "../domain/cgt/types";
import { componentRoundingNotes } from "../domain/reports/rounding";
import { money } from "./format";

export function SaleAmounts({
  breakdown,
  net,
  matched,
  gain,
  summary,
}: {
  breakdown?: SaleBreakdown;
  net: string;
  matched: string | null;
  gain: string | null;
  summary?: AnnualAmounts;
}) {
  const amounts: [string, string | null | undefined][] = [
    ["Gross disposal proceeds", breakdown?.grossProceedsGBP],
    ["Selling costs", breakdown?.sellingCostsGBP],
    ["Net sale proceeds", net],
    ["Matched acquisition cost", matched],
    ["Total allowable costs", breakdown?.totalAllowableCostsGBP],
  ];
  return (
    <div>
      <dl className="grid gap-x-7 gap-y-2 text-sm sm:grid-cols-2">
        {amounts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-gray-600">{label}</dt>
            <dd className="font-semibold tabular-nums">
              {value === undefined ? "Unavailable" : money(value)}
            </dd>
          </div>
        ))}
      </dl>
      {componentRoundingNotes(net, matched, gain, breakdown, summary).map(note =>
        <p key={note} className="caption mt-2">{note}</p>
      )}
      {!breakdown && <p className="caption mt-2">{saleBreakdownUnavailable}</p>}
      {breakdown && breakdown.proceedsRoundingAdjustmentGBP !== "0.00" && (
        <p className="caption mt-2">
          Rounding gross proceeds, selling costs and net proceeds separately
          gives a {money(breakdown.proceedsRoundingAdjustmentGBP)} adjustment to
          net sale proceeds.
        </p>
      )}
    </div>
  );
}

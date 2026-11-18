import {
  saleBreakdownUnavailable,
  type SaleBreakdown,
} from "../domain/cgt/types";
import { money } from "./format";

export function SaleAmounts({
  breakdown,
  net,
  matched,
}: {
  breakdown?: SaleBreakdown;
  net: string;
  matched: string | null;
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

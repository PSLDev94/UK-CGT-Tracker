import Link from "next/link";
import type { Overview } from "./workspace-types";

export function ReportRecovery({ years, previousInputs, draftId, linkedYears = [] }: {
  years: string[];
  previousInputs?: Overview["previousCalculationInputs"];
  draftId?: string;
  linkedYears?: string[];
}) {
  if (!years.length) return null;
  const reasons = new Map(previousInputs?.map(input => [input.taxYear, input.recoveryReason]));
  const allRules = years.every(year => reasons.get(year) === "rules");
  const allPortfolio = years.every(year => reasons.get(year) === "portfolio");
  const saved = years.length === 1 ? "this report was saved" : "these reports were saved";
  return (
    <section aria-label="Reports to recalculate" className="rounded-xl border bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Reports to recalculate</h2>
      <p className="mt-1 text-gray-700">
        {allRules ? `The calculation rules have changed since ${saved}.`
          : allPortfolio ? `Your portfolio has changed since ${saved}.`
          : "You can review the previous calculation settings for each year."}
        {draftId ? " Finish reviewing your preview, then recalculate before downloading." : " Recalculate before downloading."}
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {years.map((year) => (
          <li key={year}>
            {!draftId && linkedYears.includes(year) ? year : (
              <Link
                className="text-blue-700 underline"
                href={draftId
                  ? `/dashboard/upload?${new URLSearchParams({ draft: draftId, year })}`
                  : `/dashboard/calculations?year=${encodeURIComponent(year)}`}
              >
                {draftId ? "Review preview for" : "Recalculate"} {year}
              </Link>
            )}
            {!allRules && !allPortfolio && reasons.get(year) && (
              <span className="caption"> · {reasons.get(year) === "rules" ? "Updated calculation rules" : "Portfolio changed"}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

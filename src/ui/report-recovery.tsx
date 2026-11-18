import Link from "next/link";

export function ReportRecovery({ years, draftId, linkedYears = [] }: {
  years: string[];
  draftId?: string;
  linkedYears?: string[];
}) {
  if (!years.length) return null;
  return (
    <section aria-label="Reports to recalculate" className="rounded-xl border bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Reports to recalculate</h2>
      <p className="mt-1 text-gray-700">
        Your portfolio has changed since {years.length === 1 ? "this report was" : "these reports were"} saved.
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
          </li>
        ))}
      </ul>
    </section>
  );
}

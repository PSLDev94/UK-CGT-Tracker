import Link from "next/link";
import type { Overview } from "./workspace-types";
import { displayDate, money, netOutcome } from "./format";

export function PortfolioOverview({
  data,
  latestRun,
}: {
  data: Overview;
  latestRun?: Overview["calculations"][number];
}) {
  const draft = data.drafts[0];
  const saved = latestRun?.result;
  let title = "Calculate your share gains";
  let description =
    "Your transactions are saved. Choose a tax year and confirm the history included in the calculation.";
  let action = "Calculate gains";
  let href = "/dashboard/calculations";
  if (draft) {
    const account = data.accounts.find((a) => a.id === draft.account_id);
    title = "Your import is ready to review";
    description = `Resume the saved preview for ${account?.label ?? "your broker account"}. Check each source row before saving.`;
    action = "Resume review";
    href = "/dashboard/upload?draft=" + encodeURIComponent(draft.id);
  } else if (!data.accounts.length) {
    title = "Add your first broker account";
    description =
      "Start with the taxable account your CSV came from. Then review its transactions before calculating your gains.";
    action = "Add your first broker account";
    href = "/dashboard/accounts";
  } else if (saved) {
    title = `${saved.taxYear} share gains`;
    description =
      saved.status === "complete" && latestRun.coverage_confirmed
        ? `Matching complete. History through ${displayDate(saved.historyThrough)}.`
        : "Review the history coverage and matching evidence before using these figures.";
    action = "Open latest report";
    href = "/dashboard/reports?year=" + encodeURIComponent(saved.taxYear);
  } else if (!data.imports.some((item) => item.status === "committed")) {
    title = "Upload your first file";
    description =
      "Choose the broker export from your taxable account. You can inspect every row before it is saved.";
    action = "Upload CSV";
    href = "/dashboard/upload";
  }
  return (
    <section className="panel max-w-3xl">
      <h2>{title}</h2>
      {saved && !saved.disposals.length && !draft && <p className="font-semibold">No disposals in this tax year</p>}
      {saved?.summary && saved.disposals.length > 0 && !draft && (
        <p className="text-3xl font-bold text-blue-800 tabular-nums">
          {money(saved.summary.netGainGBP)}{" "}
          <span className="text-sm text-gray-600 font-medium">
            {netOutcome(saved.summary.netGainGBP)}
          </span>
        </p>
      )}
      <p>{description}</p>
      {saved && latestRun?.created_at && !draft && (
        <p className="caption">
          Calculated{" "}
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeZone: "Europe/London",
          }).format(new Date(latestRun.created_at))}
        </p>
      )}
      <div className="actions">
        <Link className="button primary" href={href}>
          {action}
        </Link>
        {saved && !draft && (
          <Link
            href={
              "/dashboard/calculations?year=" +
              encodeURIComponent(saved.taxYear)
            }
          >
            Review calculation
          </Link>
        )}
      </div>
    </section>
  );
}

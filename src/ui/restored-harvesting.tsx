"use client";
import { latestCalculation } from "./latest-calculation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Money } from "../domain/values";
import { ExactAmount } from "../domain/cgt/exact-amount";
import { Calculator, TrendingDown } from "lucide-react";
import { workspaceApi } from "./api";
import { reportIssueMessage, unresolvedPoolIssues } from "../domain/reports/eligibility";
import type { Overview } from "./workspace-types";
import { Notice, money } from "./primitives";
import { displayDate, unitPrice } from "./format";
import styles from "./holding-scenario.module.css";
export function RestoredHarvesting() {
  const [data, setData] = useState<Overview | null>(null);
  const [year, setYear] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    workspaceApi<Overview>({ action: "overview", surface: "scenarios" })
      .then((d) => {
        if (active) {
          setData(d);
          setYear(latestCalculation(d.calculations)?.tax_year ?? "");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const savedRun = data?.calculations.find((c) => c.tax_year === year);
  const result = savedRun?.result;
  const calculationHref = year
    ? "/dashboard/calculations?year=" + encodeURIComponent(year)
    : "/dashboard/calculations";
  const unknownPools = result ? unresolvedPoolIssues(result) : [];
  const pools =
    result?.status === "complete"
      ? result.pools.filter((p) => new Money(p.quantity).gt(0))
      : [];
  const rows = pools.map((p) => {
    const input = prices[p.securityId] ?? "";
    const valid = /^\d{1,12}(\.\d{1,8})?$/.test(input);
    const value = valid ? ExactAmount.from(input).times(ExactAmount.from(p.quantity)) : null;
    return {
      ...p,
      label: data?.instrumentNames?.[p.securityId] ? `${data.instrumentNames[p.securityId]} · ${p.securityId}` : p.securityId,
      input,
      valid,
      value,
      gain: value?.minus(ExactAmount.from(p.costGBP)),
    };
  });
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Tax-Loss Harvesting
        </h1>
        <p className="text-gray-600 mt-1">
          Explore an illustrative price scenario against a saved Section 104
          pool snapshot.
        </p>
      </div>
      {error && (
        <Notice tone="error">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </Notice>
      )}
      {!data && !error && <Notice>Loading saved calculations…</Notice>}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calculator size={20} className="text-blue-600" aria-hidden="true" />
          Explore a price scenario
        </h2>
        <p className="text-sm text-gray-600">
          Enter a hypothetical price to value the shares in each tax pool. A
          repurchase within 30 days of a sale can leave shares in the tax pool
          even when your broker account held none on the snapshot date. This
          illustration uses the tax-pool quantity and omits sale costs and tax.
        </p>
        <label htmlFor="scenario-year" className="text-sm font-medium">
          Pool snapshot year
        </label>
        <select
          className="border rounded px-3 py-2 block my-3"
          id="scenario-year"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setPrices({});
          }}
        >
          {!data?.calculations.length && (
            <option value="">No saved calculations</option>
          )}
          {data?.calculations.map((c) => (
            <option value={c.tax_year} key={c.id}>
              {c.tax_year}
            </option>
          ))}
        </select>
        {result && (
          <p className="caption">
            Snapshot at {displayDate(result.poolAsOf)}.{" "}
            {savedRun?.coverage_confirmed && "Account coverage confirmed. "}
            {result.status === "provisional" &&
              `Extend the history through ${displayDate(result.requiredHistoryThrough)} and recalculate to use the pools.`}
            {result.status === "blocked" && (
              <>{result.issues[0] && reportIssueMessage(result.issues[0])}{" "}
                <Link className="underline" href={calculationHref}>Review calculation issues</Link>.</>
            )}
          </p>
        )}
        {savedRun && !savedRun.coverage_confirmed && (
          <Notice tone="warning">
            Account coverage is unconfirmed for {year}. Confirm the accounts and
            recalculate before estimating a scenario.{" "}
            <Link className="underline" href={calculationHref}>
              Review account coverage
            </Link>
          </Notice>
        )}
        <div
          className={styles.holdings}
          role="region"
          aria-label="Section 104 pool scenario"
        >
          <table role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  Asset
                </th>
                <th scope="col" role="columnheader">
                  Shares in tax pool
                </th>
                <th scope="col" role="columnheader">
                  Pool cost per share
                </th>
                <th scope="col" role="columnheader">
                  Your scenario price (£)
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {rows.map((p) => (
                <tr key={p.securityId} role="row">
                  <th scope="row" role="rowheader" className={styles.asset}>
                    {p.label}
                  </th>
                  <td role="cell">
                    <span aria-hidden="true" className={styles.mobileLabel}>
                      Shares in tax pool
                    </span>
                    {p.quantity}
                  </td>
                  <td role="cell">
                    <span aria-hidden="true" className={styles.mobileLabel}>
                      Pool cost per share
                    </span>
                    {unitPrice(new Money(p.costGBP).div(p.quantity).toString())}
                  </td>
                  <td role="cell" className={styles.price}>
                    <label
                      className={styles.mobileLabel}
                      htmlFor={`price-${p.securityId}`}
                    >
                      Your scenario price (£)
                    </label>
                    <input
                      id={`price-${p.securityId}`}
                      aria-label={`Your scenario price (£) for ${p.label}`}
                      aria-describedby={
                        p.input && !p.valid
                          ? `price-error-${p.securityId}`
                          : undefined
                      }
                      inputMode="decimal"
                      className="border rounded px-2 py-2 w-36 min-h-11"
                      value={p.input}
                      disabled={!savedRun?.coverage_confirmed}
                      onChange={(e) =>
                        setPrices({
                          ...prices,
                          [p.securityId]: e.target.value,
                        })
                      }
                      aria-invalid={!!p.input && !p.valid}
                    />
                    {p.input && !p.valid && (
                      <span
                        id={`price-error-${p.securityId}`}
                        className="block text-sm text-red-700"
                      >
                        Use a non-negative decimal with up to 8 decimal
                        places.
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {unknownPools.map(issue => (
                <tr key={issue.securityId} role="row">
                  <th scope="row" role="rowheader" className={styles.asset}>{issue.securityId}</th>
                  <td colSpan={3} role="cell" className={styles.empty}>Tax-pool balance unresolved. Review the calculation issues before valuing this pool.</td>
                </tr>
              ))}
              {!rows.length && !unknownPools.length && (
                <tr role="row">
                  <td colSpan={4} role="cell" className={styles.empty}>
                    {result
                      ? "This snapshot has no tax pools available to value."
                      : "Save a calculation to explore its tax pools."}{" "}
                    <Link
                      className="text-blue-700 underline"
                      href={calculationHref}
                    >
                      Open calculations
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {rows.some((p) => p.gain) && (
        <section className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-6">
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <TrendingDown size={20} aria-hidden="true" />
            Illustrative tax-pool values
          </h2>
          {rows
            .filter((p) => p.gain)
            .map((p) => (
              <div
                className="bg-white p-4 rounded-lg border border-blue-100 mt-4"
                key={p.securityId}
              >
                <strong>{p.label}</strong>
                <p className="text-sm mt-2 mb-0">
                  Tax-pool value {money(p.value!.toString())} · difference from
                  pool cost {money(p.gain!.toString())}
                </p>
              </div>
            ))}
          <p className="text-sm mt-6">
            Same-day and purchases in the 30 days following a disposal can
            change the matched cost. Review your complete history before making
            any tax decision.
          </p>
        </section>
      )}
    </div>
  );
}

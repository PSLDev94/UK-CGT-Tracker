"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import { Calculator, TrendingDown } from "lucide-react";
import { workspaceApi } from "./api";
import type { Overview } from "./workspace-types";
import { Notice, money } from "./primitives";
export function RestoredHarvesting() {
  const [data, setData] = useState<Overview | null>(null);
  const [year, setYear] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    workspaceApi<Overview>({ action: "overview" })
      .then((d) => {
        if (active) {
          setData(d);
          setYear(d.calculations[0]?.tax_year ?? "");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const result = data?.calculations.find((c) => c.tax_year === year)?.result;
  const pools =
    result?.status === "complete"
      ? result.pools.filter((p) => new Decimal(p.quantity).gt(0))
      : [];
  const rows = pools.map((p) => {
    const input = prices[p.securityId] ?? "";
    const valid = /^\d{1,12}(\.\d{1,8})?$/.test(input);
    const price = valid ? new Decimal(input) : null;
    return {
      ...p,
      input,
      valid,
      value: price?.mul(p.quantity),
      gain: price?.mul(p.quantity).minus(p.costGBP),
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
          Enter a hypothetical price for each holding. Pool snapshots are
          historical and may differ from your current holdings. This scenario
          does not model a disposal, trading costs, later matching, tax savings
          or investment advice.
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
            Snapshot at {result.poolAsOf}.{" "}
            {result.status !== "complete" &&
              "Complete the calculation's missing history before using its pools."}
          </p>
        )}
        <div
          className="overflow-x-auto"
          role="region"
          aria-label="Holding scenario"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Shares at snapshot</th>
                <th>Cost Per Share</th>
                <th>Your scenario price (£)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((p) => (
                  <tr key={p.securityId}>
                    <td>{p.securityId}</td>
                    <td>{p.quantity}</td>
                    <td>
                      {money(new Decimal(p.costGBP).div(p.quantity).toFixed(8))}
                    </td>
                    <td>
                      <input
                        aria-label={`Scenario price for ${p.securityId}`}
                        inputMode="decimal"
                        className="border rounded px-2 py-2 w-36"
                        value={p.input}
                        onChange={(e) =>
                          setPrices({
                            ...prices,
                            [p.securityId]: e.target.value,
                          })
                        }
                        aria-invalid={!!p.input && !p.valid}
                      />
                      {p.input && !p.valid && (
                        <span className="block text-sm text-red-700">
                          Use a non-negative decimal with up to 8 decimal
                          places.
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
                    {result
                      ? "This snapshot has no eligible holdings to explore."
                      : "A saved calculation provides the holdings for this scenario."}{" "}
                    <Link
                      className="text-blue-700 underline"
                      href={
                        year
                          ? "/dashboard/calculations?year=" + year
                          : "/dashboard/calculations"
                      }
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
            Illustrative Holding Scenarios
          </h2>
          {rows
            .filter((p) => p.gain)
            .map((p) => (
              <div
                className="bg-white p-4 rounded-lg border border-blue-100 mt-4"
                key={p.securityId}
              >
                <strong>{p.securityId}</strong>
                <p className="text-sm mt-2 mb-0">
                  Scenario value {money(p.value!.toFixed(8))} · difference from
                  snapshot cost {money(p.gain!.toFixed(8))}
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

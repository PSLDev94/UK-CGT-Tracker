import Decimal from "decimal.js";
import { money, Notice } from "./primitives";
import type { Calculation } from "../domain/cgt/types";
const rules = {
  SAME_DAY: "Same day",
  THIRTY_DAY: "Within 30 days",
  SECTION_104: "Section 104 pool",
};
export function CalculationResult({
  result,
  coverage,
}: {
  result: Calculation;
  coverage: boolean;
}) {
  return (
    <section aria-label="Calculation result" className="space-y-6 mb-8">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">
          {result.taxYear} share gains
        </h2>
        <span className="tag">
          {result.status === "complete"
            ? "Matching complete"
            : result.status === "blocked"
              ? "Missing history"
              : "Provisional"}
        </span>
      </div>
      {!coverage && (
        <Notice tone="warning">
          Account coverage is not confirmed. Check that all your taxable
          accounts and their complete history are included.
        </Notice>
      )}
      {result.status === "provisional" && (
        <Notice tone="warning">
          This is provisional. The year-end look-ahead needs history through{" "}
          {result.requiredHistoryThrough}.
        </Notice>
      )}
      {!!result.issues.length && (
        <Notice tone="error">
          <strong>Acquisition history is missing.</strong>
          <ul>
            {result.issues.map((issue, i) => (
              <li key={i}>
                {issue.securityId} · {issue.date}: {issue.message}
              </li>
            ))}
          </ul>
        </Notice>
      )}
      {result.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {[
            ["Total Gains", result.summary.gainsGBP, "text-green-700"],
            ["Total Losses", result.summary.lossesGBP, "text-red-600"],
            [
              "Allowable Costs",
              result.summary.allowableCostsGBP,
              "text-gray-900",
            ],
            ["Net gain", result.summary.netGainGBP, "text-blue-900"],
          ].map(([label, value, tone]) => (
            <div
              key={label}
              className={`p-6 rounded-xl border shadow-sm ${label === "Net gain" ? "bg-blue-50 border-blue-200 net-gain" : "bg-white"}`}
            >
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                {label}
              </h3>
              <strong className={`text-2xl font-bold ${tone}`}>
                {money(value)}
              </strong>
            </div>
          ))}
        </div>
      )}
      <p className="caption">
        Gains and losses, not tax owed. Personal allowances, reliefs and other
        gains are not applied. This preview is not a filing-ready report.
      </p>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b flex flex-wrap gap-2 items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 m-0">
            Disposals ({result.taxYear})
          </h3>
          <span className="text-sm text-gray-500">
            {result.disposals.length} transactions
          </span>
        </div>
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Disposal evidence"
        >
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                {[
                  "Date",
                  "Asset",
                  "Qty",
                  "Proceeds",
                  "Cost",
                  "Gain/Loss",
                  "Matching Rule",
                ].map((h) => (
                  <th key={h} className="px-6 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.disposals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    No disposals fall in this tax year within the imported
                    history.
                  </td>
                </tr>
              ) : (
                result.disposals.map((d, i) => (
                  <tr key={`${d.securityId}-${i}`} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap">{d.date}</td>
                    <td className="font-medium text-gray-900">
                      {d.securityId}
                    </td>
                    <td>{d.quantity}</td>
                    <td className="number">{money(d.proceedsGBP)}</td>
                    <td className="number">{money(d.allowableCostGBP)}</td>
                    <td className="number font-medium">{money(d.gainGBP)}</td>
                    <td>
                      <details className="border-0 p-0 min-w-56">
                        <summary>
                          {d.date} · {d.securityId} · {money(d.gainGBP)}
                        </summary>
                        <ul className="match-list mt-3">
                          {d.matches.map((m, j) => (
                            <li key={j}>
                              {rules[m.rule]}: {m.quantity} shares
                              {m.acquisitionDate
                                ? ` bought ${m.acquisitionDate}`
                                : ""}
                              . Cost: {money(m.costGBP)}.
                            </li>
                          ))}
                        </ul>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 m-0">
            Section 104 Pools at {result.poolAsOf}
          </h3>
        </div>
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Section 104 pool snapshot"
        >
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Total Shares</th>
                <th>Total Allowable Cost</th>
                <th>Cost Per Share</th>
              </tr>
            </thead>
            <tbody>
              {result.pools.length ? (
                result.pools.map((p) => (
                  <tr key={p.securityId}>
                    <td>{p.securityId}</td>
                    <td>{p.quantity}</td>
                    <td>{money(p.costGBP)}</td>
                    <td>
                      {new Decimal(p.quantity).gt(0)
                        ? money(
                            new Decimal(p.costGBP).div(p.quantity).toFixed(8),
                          )
                        : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No active holdings in this snapshot.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="caption">
        History through {result.historyThrough}. Pool snapshot:{" "}
        {result.poolAsOf}. Calculation version: {result.engineVersion}.
      </p>
    </section>
  );
}

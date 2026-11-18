import Decimal from "decimal.js";
import Link from "next/link";
import { money, Notice } from "./primitives";
import type { Calculation } from "../domain/cgt/types";
import { missingAcquisitionGuidance } from "../domain/cgt/types";
import { displayDate, netOutcome } from "./format";
import { SaleAmounts } from "./sale-amounts";
import { DisposalDetail } from "./disposal-detail";
import { disposalSourceKeys, type DisposalLocation } from "./disposal-location";

function MobileDisposalOutcome({ gain }: { gain: string | null }) {
  const amount = <strong className="tabular-nums">{money(gain)}</strong>;
  if (gain === null) return <>{amount} gain unresolved</>;
  const outcome = netOutcome(gain);
  if (outcome === "Break-even") return <>Break-even {amount}</>;
  return <>{amount} {outcome === "Net loss" ? "loss" : "gain"}</>;
}

export function CalculationResult({
  result,
  runId,
  location,
  coverage,
  confirmedAccounts,
  settingsEdited,
}: {
  result: Calculation;
  runId: string;
  location: DisposalLocation | null;
  coverage: boolean;
  confirmedAccounts: string[];
  settingsEdited: boolean;
}) {
  const noDisposals = result.disposals.length === 0;
  const previousDisposal = location?.runId === runId ? result.disposals[location.disposal] : undefined;
  const target = previousDisposal && location && location.source < disposalSourceKeys(previousDisposal).length
    ? location : null;
  const savedInputs = (
    <p className="caption">
      Last saved calculation · History through{" "}
      {displayDate(result.historyThrough)}.{" "}
      {confirmedAccounts.length
        ? "Confirmed accounts: " + confirmedAccounts.join(", ") + "."
        : "No accounts confirmed."}
    </p>
  );
  if (settingsEdited) {
    return (
      <section aria-label="Last saved calculation" className="panel">
        <h2>{result.taxYear} share gains</h2>
        {savedInputs}
        <p>
          Recalculate with the edited settings to see the updated figures and
          report.
        </p>
      </section>
    );
  }
  return (
    <section
      id="calculation-summary"
      aria-label="Calculation result"
      className="space-y-6 mb-8"
    >
      {savedInputs}
      {location && !target && (
        <Notice>
          This calculation has changed since you opened the receipt.
          {!noDisposals && " Select a disposal below to see its current sources."}
        </Notice>
      )}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <h2
          id="calculation-result-heading"
          tabIndex={-1}
          className="scroll-mt-20 text-lg font-semibold text-gray-900"
        >
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
          {displayDate(result.requiredHistoryThrough)}.
        </Notice>
      )}
      {!!result.issues.length && (
        <Notice tone="error">
          <strong>Acquisition history is missing.</strong>
          <ul>
            {result.issues.map((issue, i) => (
              <li key={i}>
                {issue.securityId} · {displayDate(issue.date)} ·{" "}
                {issue.quantity} unmatched shares
              </li>
            ))}
          </ul>
          <p>{missingAcquisitionGuidance}</p>
          <Link
            className="button primary"
            href={
              "/dashboard/upload?year=" + encodeURIComponent(result.taxYear)
            }
          >
            Upload earlier acquisitions
          </Link>
        </Notice>
      )}
      {noDisposals && <Notice>
        <strong>No disposals in this tax year.</strong> Check the tax year or upload the sales you want to calculate.
      </Notice>}
      {result.summary && !noDisposals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            [
              netOutcome(result.summary.netGainGBP),
              result.summary.netGainGBP,
              "text-blue-900",
            ],
            ["Total Gains", result.summary.gainsGBP, "text-green-700"],
            ["Total Losses", result.summary.lossesGBP, "text-red-600"],
          ].map(([label, value, tone]) => (
            <div
              key={label}
              className={`p-6 rounded-xl border shadow-sm ${label.startsWith("Net") || label === "Break-even" ? "bg-blue-50 border-blue-200 net-gain" : "bg-white"}`}
            >
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                {label}
              </h3>
              <strong className={`text-2xl font-bold tabular-nums ${tone}`}>
                {money(value)}
              </strong>
            </div>
          ))}
        </div>
      )}
      <p className="caption">
        {coverage
          ? "Account coverage confirmed"
          : "Account coverage incomplete"}
      </p>
      <Link
        className={
          noDisposals || result.status === "blocked" ? "button secondary" : "button primary"
        }
        href={"/dashboard/reports?year=" + encodeURIComponent(result.taxYear)}
      >
        {noDisposals ? "View calculation evidence" : result.status === "blocked" ? "View draft reports" : "View reports"}{" "}
        for {result.taxYear}
      </Link>
      {result.summary && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Annual sale breakdown</h3>
          <SaleAmounts breakdown={result.saleBreakdown} net={result.summary.proceedsGBP} matched={result.summary.allowableCostsGBP} />
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
            {result.disposals.length}{" "}
            {result.disposals.length === 1 ? "disposal" : "disposals"}
          </span>
        </div>
        <div className="md:hidden p-4">
          {result.disposals.length === 0 && (
            <p>
              No disposals fall in this tax year within the imported history.
            </p>
          )}
          {result.disposals.map((d, index) => (
            <DisposalDetail
              key={`${runId}-${index}`}
              disposal={d}
              year={result.taxYear}
              position={`${runId}.${index}`}
              returnSource={target?.disposal === index ? target.source : undefined}
              className="mb-2"
            >
                <span className="break-all">{d.securityId}</span> · {displayDate(d.date)}
                <br />
                <MobileDisposalOutcome gain={d.gainGBP} />
            </DisposalDetail>
          ))}
        </div>
        <div
          className="hidden md:block overflow-x-auto"
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
                  "Gross disposal proceeds",
                  "Total allowable costs",
                  "Gain/Loss",
                  "Disposal details",
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
                result.disposals.map((d, index) => (
                  <tr key={`${runId}-${index}`} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap">{displayDate(d.date)}</td>
                    <td className="font-medium text-gray-900">
                      {d.securityId}
                    </td>
                    <td>{d.quantity}</td>
                    <td className="number">{d.saleBreakdown ? money(d.saleBreakdown.grossProceedsGBP) : "Unavailable"}</td>
                    <td className="number">{d.saleBreakdown ? money(d.saleBreakdown.totalAllowableCostsGBP) : "Unavailable"}</td>
                    <td className="number font-medium">{money(d.gainGBP)}</td>
                    <td>
                      <DisposalDetail
                        disposal={d}
                        year={result.taxYear}
                        position={`${runId}.${index}`}
                        returnSource={target?.disposal === index ? target.source : undefined}
                        className="border-0 p-0 min-w-56"
                      >
                        {displayDate(d.date)} · {d.securityId} · {money(d.gainGBP)}
                      </DisposalDetail>
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
            Section 104 Pools at {displayDate(result.poolAsOf)}
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
        Pool snapshot at {displayDate(result.poolAsOf)}. Calculation version{" "}
        {result.engineVersion}.
      </p>
    </section>
  );
}

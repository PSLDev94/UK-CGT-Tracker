import { Money } from "../domain/values";
import Link from "next/link";
import styles from "./workspace-records.module.css";
import { money, Notice } from "./primitives";
import type { Calculation } from "../domain/cgt/types";
import { noDisposalsLabel, reportIssueMessage, scopeStatement, unresolvedPoolIssues } from "../domain/reports/eligibility";
import { displayDate, netOutcome, unitPrice } from "./format";
import { annualRoundingNote, roundingDifferences } from "../domain/reports/rounding";
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
  const unknownPools = unresolvedPoolIssues(result);
  const blockingIssues = result.issues.filter(issue => issue.scope !== "pool");
  const noDisposals = result.disposals.length === 0;
  const previousDisposal = location?.runId === runId ? result.disposals[location.disposal] : undefined;
  const target = previousDisposal && location && location.source < disposalSourceKeys(previousDisposal).length
    ? location : null;
  const savedInputs = (
    <div className="caption">
      <p>Last saved calculation · History through {displayDate(result.historyThrough)}.</p>
      {confirmedAccounts.length ? (
        <details>
          <summary>{confirmedAccounts.length} {confirmedAccounts.length === 1 ? "account" : "accounts"} confirmed</summary>
          <ul className="list-disc pl-5">{confirmedAccounts.map((name, i) => <li key={i}>{name}</li>)}</ul>
        </details>
      ) : <p>No accounts confirmed.</p>}
    </div>
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
      className={styles.calculation}
    >
      {location && !target && (
        <Notice>
          This calculation has changed since you opened the receipt.
          {!noDisposals && " Select a disposal below to see its current sources."}
        </Notice>
      )}
      <div className={styles.resultHeader}>
        <h2
          id="calculation-result-heading"
          tabIndex={-1}
          className="scroll-mt-20"
        >
          {result.taxYear} share gains
        </h2>
        <span className="tag">
          {result.status === "complete"
            ? "Matching complete"
            : result.status === "blocked"
              ? "Review required"
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
      {!!blockingIssues.length && (
        <Notice tone="error">
          <strong>Review the calculation issues.</strong>
          <ul>
            {blockingIssues.map((issue, i) => (
              <li key={i}>
                {issue.securityId} · {displayDate(issue.date)} · {issue.quantity} shares.{" "}
                {reportIssueMessage(issue)}
              </li>
            ))}
          </ul>
          {blockingIssues.some(i => i.code === "MISSING_ACQUISITION_HISTORY") && (
            <Link className="button secondary" href={"/dashboard/upload?year=" + encodeURIComponent(result.taxYear)}>Upload earlier acquisitions</Link>
          )}
        </Notice>
      )}
      {noDisposals && <Notice>
        <strong>{noDisposalsLabel(result, coverage)}.</strong>{" "}
        {result.hasLaterSales ? <>Sales for this year are already on file after the cutoff. <a href="#historyThrough">Review the history date</a> and recalculate.</> : "Check the reporting year and included history."}
      </Notice>}
      {result.summary && !noDisposals && (
        <div className={styles.balance}>
          <div className={`net-gain ${styles.balanceNet}`}>
            <h3>{netOutcome(result.summary.netGainGBP)}</h3>
            <strong>{money(result.summary.netGainGBP)}</strong>
            {savedInputs}
          </div>
          <dl className={styles.balanceParts}>
            <div><dt>Total Gains</dt><dd>{money(result.summary.gainsGBP)}</dd></div>
            <div><dt>Total Losses</dt><dd>{money(result.summary.lossesGBP)}</dd></div>
          </dl>
        </div>
      )}
      {(!result.summary || noDisposals) && savedInputs}
      <Link
        className={
          noDisposals || result.status === "blocked" ? "button secondary" : "button primary"
        }
        href={"/dashboard/reports?year=" + encodeURIComponent(result.taxYear)}
      >
        {noDisposals ? "View calculation evidence" : result.status === "blocked" ? "View draft reports" : "View reports"}{" "}
        for {result.taxYear}
      </Link>
      <p className="caption">{scopeStatement(result)}</p>
      {!!result.reviewedOpeningPools?.length && (
        <section>
          <h3 className="text-lg font-semibold mb-3">Reviewed opening positions</h3>
          <ul className="space-y-3 [overflow-wrap:anywhere]">
            {result.reviewedOpeningPools.map(pool => (
              <li key={pool.securityId}>
                <strong>{pool.securityId}</strong> · {displayDate(pool.asOf)}
                <p>{pool.quantity} {pool.quantity === "1" ? "share" : "shares"} · verified cost £{pool.costGBP}</p>
                <p className="caption">Review case {pool.caseReference} · supporting evidence {pool.sourceReference}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.summary && (
        <div className={styles.breakdown}>
          <h3 className={styles.ledgerTitle}>Annual sale breakdown</h3>
          <SaleAmounts breakdown={result.saleBreakdown} net={result.summary.proceedsGBP} matched={result.summary.allowableCostsGBP} gain={result.summary.netGainGBP} summary={result.summary} />
          {roundingDifferences(result).length > 0 && <p className="caption mt-2">{annualRoundingNote(result)}</p>}
        </div>
      )}
      <p className="caption">
        Gains and losses, not tax owed. Personal allowances, reliefs and other
        gains are not applied. This preview is not a filing-ready report.
      </p>
      <div className={styles.ledger}>
        <div className={styles.ledgerHead}>
          <h3 className={styles.ledgerTitle}>
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
              {noDisposalsLabel(result, coverage)}.
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
                    {noDisposalsLabel(result, coverage)}.
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
      <div className={styles.ledger}>
        <div className={styles.ledgerHead}>
          <h3 className={styles.ledgerTitle}>
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
                <th>Shares in tax pool</th>
                <th>Total Allowable Cost</th>
                <th>Cost Per Share</th>
              </tr>
            </thead>
            <tbody>
              {result.pools.map((p) => (
                <tr key={p.securityId}>
                  <td>{p.securityId}</td>
                  <td>{p.quantity}</td>
                  <td>{money(p.costGBP)}</td>
                  <td>
                    {new Money(p.quantity).gt(0)
                      ? unitPrice(new Money(p.costGBP).div(p.quantity).toString())
                      : "—"}
                  </td>
                </tr>
              ))}
              {unknownPools.map(issue => (
                <tr key={issue.securityId}>
                  <td>{issue.securityId}</td>
                  <td colSpan={3}>Tax-pool balance unresolved. {reportIssueMessage(issue)}</td>
                </tr>
              ))}
              {!result.pools.length && !unknownPools.length && (
                <tr>
                  <td colSpan={4}>No remaining Section 104 pool balances.</td>
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

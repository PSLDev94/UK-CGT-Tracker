import { money, Notice } from "./primitives";
import type { Calculation } from "../domain/cgt/types";

const ruleNames = {
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
    <section className="panel">
      <div className="panel-heading">
        <h2>{result.taxYear} share gains</h2>
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
      {result.issues.length > 0 && (
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
        <div className="metrics">
          {[
            ["Proceeds", result.summary.proceedsGBP],
            ["Allowable costs", result.summary.allowableCostsGBP],
            ["Gains", result.summary.gainsGBP],
            ["Losses", result.summary.lossesGBP],
          ].map(([label, value]) => (
            <div className="metric" key={label}>
              <strong style={{ fontSize: "1.15rem" }}>{money(value)}</strong>
              <span>{label}</span>
            </div>
          ))}
          <p className="full-width" style={{ padding: "1rem", margin: 0 }}>
            Net gain: <strong>{money(result.summary.netGainGBP)}</strong>
          </p>
        </div>
      )}
      <p className="caption">
        Gains and losses, not tax owed. Personal allowances, reliefs and other
        gains are not applied. This preview is not a filing-ready report.
      </p>
      {result.disposals.length === 0 ? (
        <p>No disposals fall in this tax year within the imported history.</p>
      ) : (
        result.disposals.map((disposal, index) => (
          <details key={`${disposal.securityId}-${disposal.date}-${index}`}>
            <summary>
              {disposal.date} · {disposal.securityId} ·{" "}
              {money(disposal.gainGBP)}
            </summary>
            <p>
              {disposal.quantity} shares · proceeds{" "}
              {money(disposal.proceedsGBP)} · allowable cost{" "}
              {money(disposal.allowableCostGBP)}
            </p>
            <ul className="match-list">
              {disposal.matches.map((match, i) => (
                <li key={i}>
                  {ruleNames[match.rule]}: {match.quantity} shares
                  {match.acquisitionDate
                    ? ` bought ${match.acquisitionDate}`
                    : ""}
                  . Cost: {money(match.costGBP)}.
                </li>
              ))}
            </ul>
          </details>
        ))
      )}
      <p className="caption">
        History through {result.historyThrough}. Pool snapshot:{" "}
        {result.poolAsOf}. Calculation version: {result.engineVersion}.
      </p>
    </section>
  );
}

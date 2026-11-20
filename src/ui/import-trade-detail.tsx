import styles from "./workspace-records.module.css";
import type { ImportTradeDetail } from "../domain/imports/trade-detail";
import { Money } from "../domain/values";
import { displayDate } from "./format";

export function statementAmount(value: string, currency: string) {
  const amount = new Money(value);
  const digits = amount.abs().toFixed(Math.max(2, amount.decimalPlaces()));
  const [whole, fraction] = digits.split(".");
  const denomination = currency === "GBP" ? "£" : currency + " ";
  return (
    (amount.isNegative() && !amount.isZero() ? "−" : "") +
    denomination +
    whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    "." +
    fraction
  );
}

export function tradeSummary(trade: Pick<ImportTradeDetail, "date" | "side" | "quantity" | "securityId">) {
  const action = trade.side === "BUY" ? "Buy" : "Sell";
  const shares = trade.quantity === "1" ? "share" : "shares";
  return `${action} ${trade.quantity} ${shares} · ${trade.securityId} · ${displayDate(trade.date)}`;
}

export function ImportTradeDetails({
  record,
  trade,
}: {
  record: number;
  trade: ImportTradeDetail;
}) {
  return (
    <div>
      <p className="caption">
        {tradeSummary(trade)}
      </p>
      <details className="my-2">
        <summary>Trade details for record {record}</summary>
        <dl className={styles.receiptAmounts}>
          <dt>Cash currency</dt>
          <dd>{trade.currency}</dd>
          <dt>Consideration</dt>
          <dd>{statementAmount(trade.consideration, trade.currency)}</dd>
          <dt>Fees and taxes</dt>
          <dd>{statementAmount(trade.fees, trade.currency)}</dd>
          <dt>Net cash</dt>
          <dd>{statementAmount(trade.netCash, trade.currency)}</dd>
          {trade.netCashGBP && (
            <>
              <dt>Net cash in GBP</dt>
              <dd>{statementAmount(trade.netCashGBP, "GBP")}</dd>
            </>
          )}
          {trade.gbpPerUnit && (
            <>
              <dt>GBP per {trade.instrumentCurrency ?? trade.currency}</dt>
              <dd>{trade.gbpPerUnit}</dd>
            </>
          )}
          <dt>Execution reference</dt>
          <dd className="break-all">
            {trade.executionReference ?? "Unavailable in this saved import"}
          </dd>
          {trade.statementReference && (
            <>
              <dt>Statement reference</dt>
              <dd className="break-all">{trade.statementReference}</dd>
            </>
          )}
        </dl>
      </details>
    </div>
  );
}

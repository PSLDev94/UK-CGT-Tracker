import { Money } from "../domain/values";
import type { ImportRecord } from "../domain/imports/review";
import { statementAmount } from "./import-trade-detail";
import styles from "./workspace-records.module.css";

// Preserve unsupported input verbatim. Only well-formed source numbers are used
// for the display calculation; the broker adapter independently verifies a save.
function sourceNumber(value?: string) {
  if (!value || value.length > 40 || !/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,12})?$/.test(value)) return null;
  return new Money(value.replaceAll(",", ""));
}

export function ImportCashCheck({ row, broker, currency, priceUnit, fees }: {
  row: ImportRecord;
  broker: string;
  currency: string;
  priceUnit: string;
  fees: string;
}) {
  const source = row.source;
  if (!source) return null;
  const terms = row.exportedTerms ?? {};
  const side = source["Buy/Sell"] || source["Buy / Sell"] || source.Action || source.Transaction || source.Type ||
    (broker === "hl" ? (/^B\d+$/.test(source.Reference ?? "") ? "Buy" : /^S\d+$/.test(source.Reference ?? "") ? "Sell" : "") : "") ||
    (broker === "ii" ? source.Description?.split(" ", 1)[0] : "");
  const quantity = source.Quantity || source["No. of shares"];
  const price = source["Unit cost (p)"] || source.Price || source.TradePrice || source["Price per Share"] || source["Price / share"];
  const costCurrency = currency === "GBX" ? "GBP" : currency;
  const cashCurrency = terms.accountCurrency || costCurrency;
  const signedQuantity = sourceNumber(quantity), unitPrice = sourceNumber(price);
  const gross = signedQuantity && unitPrice?.isPositive() && priceUnit
    ? signedQuantity.abs().times(unitPrice).div(priceUnit === "minor" ? 100 : 1).toDP(2)
    : null;
  const unitLabel = priceUnit === "minor" ? (costCurrency === "GBP" ? "pence" : "hundredths") : priceUnit === "major" ? costCurrency : "units unconfirmed";
  const sourceFees = terms.feesGBP ?? terms.feesInCurrency ?? fees;
  const feeCurrency = terms.feesGBP !== undefined ? "GBP" : costCurrency;
  const cash = source["Value (£)"] ?? source["Amount (GBP)"] ?? source.Amount ?? source.NetCash ?? source["Total Amount"] ?? source["Total Amount in Account Currency"] ?? source.Total;
  function displayed(value: string | undefined, denomination: string) {
    const number = sourceNumber(value);
    return number && denomination ? statementAmount(number.toFixed(), denomination) : value || "—";
  }
  return (
    <section aria-label="Trade figures to check" className={styles.cashCheck}>
      <h3>Trade figures to check</h3>
      <dl className={styles.receiptAmounts}>
        <dt>Trade</dt><dd>{side || "See source row"}</dd>
        <dt>Quantity</dt><dd>{quantity || "—"}</dd>
        <dt>Price per share</dt><dd>{price || "—"} {unitLabel}</dd>
        <dt>Gross trade value</dt><dd>{gross && costCurrency ? statementAmount(gross.toFixed(), costCurrency) : "Confirm currency and units"}</dd>
        <dt>Dealing fees and taxes</dt><dd>{sourceFees ? displayed(sourceFees, feeCurrency) : "Enter verified charges above"}</dd>
        {broker === "ii" ? <>
          <dt>Broker debit</dt><dd>{displayed(source.Debit, cashCurrency)}</dd>
          <dt>Broker credit</dt><dd>{displayed(source.Credit, cashCurrency)}</dd>
        </> : <>
          <dt>Broker net cash</dt><dd>{displayed(cash, cashCurrency)}</dd>
        </>}
      </dl>
    </section>
  );
}

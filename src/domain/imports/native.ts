import { calendarDate, decimal, ukCalendarDate } from "../values";
import type { BrokerId } from "./brokers";

// Exact, versioned layouts observed in public sample exports. Unknown columns
// are deliberately not optional: a new fee column must never disappear.
export const FREETRADE_HEADERS =
  "Title,Type,Timestamp,Account Currency,Total Amount,Buy / Sell,Ticker,ISIN,Price per Share in Account Currency,Stamp Duty,Quantity,Venue,Order ID,Order Type,Instrument Currency,Total Shares Amount,Price per Share,FX Rate,Base FX Rate,FX Fee (BPS),FX Fee Amount,Dividend Ex Date,Dividend Pay Date,Dividend Eligible Quantity,Dividend Amount Per Share,Dividend Gross Distribution Amount,Dividend Net Distribution Amount,Dividend Withheld Tax Percentage,Dividend Withheld Tax Amount".split(
    ",",
  );
export const TRADING212_HEADERS =
  "Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Currency (Result),Total,Currency (Total),Withholding tax,Currency (Withholding tax),Transaction fee,Notes,ID,Currency conversion fee,Currency (Currency conversion fee),Currency (Transaction fee)".split(
    ",",
  );

type Row = Record<string, string>;
export interface NativeAdapter {
  version: string;
  idColumn: string;
  isTrade: (row: Row) => boolean;
  normalize: (row: Row) => Row;
}
const sameHeaders = (actual: string[], expected: string[]) =>
  actual.length === expected.length &&
  expected.every((h) => actual.includes(h));
const zeroOrBlank = (value: string, label: string) => {
  if (value && !decimal(value, label).isZero())
    throw new Error(
      `${label} needs additional handling in this native format. No transactions will be saved.`,
    );
};
const money = (value: string, label: string) => {
  const amount = decimal(value, label);
  if (amount.decimalPlaces() > 2)
    throw new Error(
      `${label} must be in pounds and pence for this export variant.`,
    );
  return amount;
};
/** These two export variants use UTC; do not let server timezone choose the tax day. */
export function ukTradeDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))
    throw new Error(
      "Expected an execution timestamp in UTC, including seconds.",
    );
  calendarDate(value.slice(0, 10));
  const parsed = new Date(value);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 19) !== value.slice(0, 19)
  )
    throw new Error("Invalid execution timestamp.");
  return ukCalendarDate(parsed);
}
function trade(
  id: string,
  date: string,
  side: string,
  isin: string,
  quantity: string,
  consideration: string,
  fees: string,
): Row {
  return {
    "Transaction ID": id,
    "Trade date": date,
    Type: side,
    ISIN: isin,
    Quantity: quantity,
    Consideration: consideration,
    Fees: fees,
    Currency: "GBP",
    "GBP per unit": "1",
    "Asset type": "ORDINARY_SHARE",
  };
}
const freetrade: NativeAdapter = {
  version: "freetrade-activity-29-gbp-v1",
  idColumn: "Order ID",
  isTrade: (r) => r.Type === "ORDER",
  normalize(r) {
    const exclusions: Row = {
      TOP_UP: "CASH_DEPOSIT",
      WITHDRAWAL: "CASH_WITHDRAWAL",
      DIVIDEND: "CASH_DIVIDEND",
      INTEREST_FROM_CASH: "CASH_INTEREST",
    };
    if (exclusions[r.Type!]) return { Type: exclusions[r.Type!]! };
    if (r.Type !== "ORDER")
      throw new Error(
        `Freetrade activity “${r.Type}” needs review. Free shares, pending orders, transfers and corporate actions are not ordinary purchases or sales.`,
      );
    if (r["Buy / Sell"] !== "BUY" && r["Buy / Sell"] !== "SELL")
      throw new Error("Freetrade order direction must be BUY or SELL.");
    if (r["Account Currency"] !== "GBP" || r["Instrument Currency"] !== "GBP")
      throw new Error(
        "This Freetrade variant currently supports GBP-priced trades in GBP accounts. Foreign-currency trades need a verified FX mapping.",
      );
    for (const key of ["FX Fee Amount", "FX Fee (BPS)"])
      zeroOrBlank(r[key]!, key);
    for (const key of ["FX Rate", "Base FX Rate"])
      if (r[key] && !decimal(r[key]!, key).eq(1))
        throw new Error(`${key} must be blank or 1 for a GBP trade.`);
    for (const key of FREETRADE_HEADERS.filter((h) =>
      h.startsWith("Dividend "),
    ))
      if (r[key]) throw new Error("Dividend details on an order need review.");
    const quantity = decimal(r.Quantity!, "Quantity"),
      price = decimal(r["Price per Share"]!, "Price per Share");
    if (!quantity.gt(0) || !price.gt(0))
      throw new Error(
        "Zero-price orders can represent corporate actions and need review.",
      );
    const gross = money(r["Total Shares Amount"]!, "Total Shares Amount"),
      stamp = money(r["Stamp Duty"] || "0", "Stamp Duty"),
      total = money(r["Total Amount"]!, "Total Amount");
    if (
      !price.eq(
        decimal(
          r["Price per Share in Account Currency"]!,
          "Price per Share in Account Currency",
        ),
      ) ||
      !quantity.times(price).toDP(2).eq(gross)
    )
      throw new Error(
        "Freetrade quantity, prices and gross amount do not reconcile to the penny.",
      );
    if (r["Buy / Sell"] === "SELL" && !stamp.isZero())
      throw new Error("Stamp duty on a sale needs review.");
    if (!gross.plus(stamp).eq(total))
      throw new Error(
        "Freetrade gross amount plus stamp duty does not match Total Amount.",
      );
    return trade(
      r["Order ID"]!,
      ukTradeDate(r.Timestamp!),
      r["Buy / Sell"],
      r.ISIN!,
      quantity.toString(),
      gross.toString(),
      stamp.toString(),
    );
  },
};
const trading212: NativeAdapter = {
  version: "trading212-invest-21-gbp-v1",
  idColumn: "ID",
  isTrade: (r) => /^(Market|Limit|Stop|Stop limit) (buy|sell)$/.test(r.Action!),
  normalize(r) {
    const exclusions: Row = {
      Deposit: "CASH_DEPOSIT",
      Withdrawal: "CASH_WITHDRAWAL",
      "Dividend (Dividend)": "CASH_DIVIDEND",
      "Interest on cash": "CASH_INTEREST",
    };
    if (exclusions[r.Action!]) return { Type: exclusions[r.Action!]! };
    if (!this.isTrade(r))
      throw new Error(
        `Trading 212 activity “${r.Action}” needs review. Corporate actions, distributions and adjustments must not be silently excluded.`,
      );
    if (
      r["Currency (Price / share)"] !== "GBP" ||
      r["Currency (Total)"] !== "GBP"
    )
      throw new Error(
        "This Trading 212 variant currently supports GBP-priced trades with GBP totals. Foreign currency and GBX/pence need a verified mapping.",
      );
    if (!decimal(r["Exchange rate"]!, "Exchange rate").eq(1))
      throw new Error("A GBP trade must have an exchange rate of 1.");
    for (const key of [
      "Transaction fee",
      "Currency conversion fee",
      "Withholding tax",
    ])
      zeroOrBlank(r[key]!, key);
    // Non-zero costs are intentionally blocked until their separate currencies and net/gross semantics are qualified.
    const quantity = decimal(r["No. of shares"]!, "No. of shares"),
      price = decimal(r["Price / share"]!, "Price / share"),
      total = money(r.Total!, "Total");
    if (!quantity.gt(0) || !price.gt(0) || !total.gt(0))
      throw new Error(
        "Zero-value trades can represent takeovers or other corporate actions and need review.",
      );
    if (!quantity.times(price).toDP(2).eq(total))
      throw new Error(
        "Trading 212 quantity times price does not match Total to the penny.",
      );
    return trade(
      r.ID!,
      ukTradeDate(r.Time!.replace(" ", "T") + "Z"),
      r.Action!.endsWith("buy") ? "BUY" : "SELL",
      r.ISIN!,
      quantity.toString(),
      total.toString(),
      "0",
    );
  },
};
export function nativeAdapter(
  broker: BrokerId,
  headers: string[],
): NativeAdapter | undefined {
  if (broker === "freetrade" && sameHeaders(headers, FREETRADE_HEADERS))
    return freetrade;
  if (broker === "trading212" && sameHeaders(headers, TRADING212_HEADERS))
    return trading212;
}
export const NATIVE_GUIDANCE: Record<BrokerId, string> = {
  freetrade:
    "Use the Activity Feed CSV. Only the documented 29-column GBP trade variant is supported in this preview. Transfers and some corporate actions may be missing from the export; reconcile the complete history separately.",
  trading212:
    "Use the Invest account History CSV with all activity categories. Only the documented 21-column GBP trade variant is supported in this preview. Pie holdings and CFD exports cannot establish share acquisition history.",
  hl: "HL Transaction Summary files need verified security identifiers and dealing-cost details from matching contract notes. Unit cost may be in pence. This CSV cannot be imported on its own yet.",
  ii: "Interactive Investor exports can identify securities by SEDOL and may omit the wallet currency. Confirm the security ISIN, wallet currency, execution amounts and fees before converting to the template.",
  ibkr: "IBKR Activity Statements, Flex Queries and Transaction History are different formats. A Flex Query must include execution IDs, ISINs, asset categories, currency, gross proceeds, commission and trade-date FX. Sectioned reports are not yet supported.",
  ajbell:
    "AJ Bell descriptions alone cannot identify a security safely. Verify ISINs, price units, dealing charges and GBP consideration against contract notes before converting to the template.",
};

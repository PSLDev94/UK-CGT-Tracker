import { calendarDate, decimal, ukCalendarDate } from "../values";
import {
  hl,
  ii,
  ajbell,
  ajbellHistory,
  ibkr,
  HL_HEADERS,
  II_HEADERS,
  AJ_HEADERS,
  AJ_HISTORY_HEADERS,
  IBKR_HEADERS,
} from "./additional-brokers";
import { StatementMismatchError, type SupportingDetails } from "./supporting-details";
import type { BrokerId } from "./brokers";

// Exact, versioned layouts observed in public sample exports. Unknown columns
// are deliberately not optional: a new fee column must never disappear.
export const FREETRADE_HEADERS =
  "Title,Type,Timestamp,Account Currency,Total Amount,Buy / Sell,Ticker,ISIN,Price per Share in Account Currency,Stamp Duty,Quantity,Venue,Order ID,Order Type,Instrument Currency,Total Shares Amount,Price per Share,FX Rate,Base FX Rate,FX Fee (BPS),FX Fee Amount,Dividend Ex Date,Dividend Pay Date,Dividend Eligible Quantity,Dividend Amount Per Share,Dividend Gross Distribution Amount,Dividend Net Distribution Amount,Dividend Withheld Tax Percentage,Dividend Withheld Tax Amount".split(
    ",",
  );
const FREETRADE_RENAMED_COLUMNS: Record<string, string> = {
  "Total Amount in Account Currency": "Total Amount",
  "Total Amount in Instrument Currency": "Total Shares Amount",
};
export const TRADING212_HEADERS =
  "Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Currency (Result),Total,Currency (Total),Withholding tax,Currency (Withholding tax),Transaction fee,Notes,ID,Currency conversion fee,Currency (Currency conversion fee),Currency (Transaction fee)".split(
    ",",
  );
/** Publicly documented 2026 Invest export. Every added financial column is checked. */
export const TRADING212_2026_HEADERS =
  "Action,Time (UTC),ISIN,Ticker,Name,Notes,ID,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Currency (Result),Total,Currency (Total),Withholding tax,Currency (Withholding tax),Stamp duty reserve tax,Currency (Stamp duty reserve tax),French transaction tax,Currency (French transaction tax),Transaction fee,Finra fee,Currency conversion from amount,Currency (Currency conversion from amount),Currency conversion to amount,Currency (Currency conversion to amount),Currency conversion fee,Currency (Currency conversion fee),Currency (Transaction fee),Currency (Finra fee),Merchant name,Merchant category".split(
    ",",
  );

type Row = Record<string, string>;
export interface NativeAdapter {
  version: string;
  idColumn: string;
  isTrade: (row: Row) => boolean;
  normalize: (row: Row, details?: SupportingDetails) => Row;
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
  normalize(r, supplied) {
    if (["MONTHLY_STATEMENT", "TAX_CERTIFICATE"].includes(r.Type ?? "")) {
      const metadata = new Set([
        "Title",
        "Type",
        "Timestamp",
        "Account Currency",
      ]);
      if (
        Object.entries(r).some(
          ([key, value]) => !metadata.has(key) && value !== "",
        )
      )
        throw new Error(
          "A statement notification contains financial fields. Review it rather than excluding a possible transaction.",
        );
      if (r.Timestamp) ukTradeDate(r.Timestamp);
      return { Type: "NON_TRANSACTION_DOCUMENT" };
    }
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
    if (r["Account Currency"] !== "GBP")
      throw new Error(
        "This Freetrade export must have a GBP account currency.",
      );
    const foreign = r["Instrument Currency"] !== "GBP";
    if (
      foreign &&
      (!supplied?.netAmountConfirmed ||
        supplied.currency !== r["Instrument Currency"] ||
        supplied.isin !== r.ISIN)
    )
      throw new Error(
        "Check the instrument, GBP cash and fees against your contract note, then add its reference.",
      );
    const rate = foreign
      ? decimal(supplied!.gbpPerUnit, "GBP per unit")
      : decimal("1", "GBP per unit");
    if (!rate.gt(0)) throw new Error("GBP conversion must be positive.");
    const fxFee = money(r["FX Fee Amount"] || "0", "FX Fee Amount");
    const basisPoints = decimal(r["FX Fee (BPS)"] || "0", "FX Fee (BPS)");
    if (
      basisPoints.gte(10000) ||
      (!foreign && (!fxFee.isZero() || !basisPoints.isZero()))
    )
      throw new Error(
        "FX fees on a GBP instrument or an invalid fee percentage require review.",
      );
    if (foreign && (!fxFee.isZero() || !basisPoints.isZero())) {
      const base = decimal(r["Base FX Rate"]!, "Base FX Rate");
      const effective = decimal(r["FX Rate"]!, "FX Rate");
      const fraction = basisPoints.div(10000);
      const multiplier =
        r["Buy / Sell"] === "BUY"
          ? decimal("1", "Rate").minus(fraction)
          : decimal("1", "Rate").plus(fraction);
      if (
        !base.gt(0) ||
        !base.times(rate).toDP(6).eq(1) ||
        !base.times(multiplier).toDP(8).eq(effective)
      )
        throw new Error(
          "Base FX rate, fee percentage and effective exchange rate do not reconcile with the verified GBP conversion.",
        );
    } else
      for (const key of ["FX Rate", "Base FX Rate"])
        if (r[key] && !decimal(r[key]!, key).times(rate).toDP(6).eq(1))
          throw new Error(
            `${key} does not reconcile with the verified GBP conversion.`,
          );
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
    const sourceGross = money(r["Total Shares Amount"]!, "Total Shares Amount"),
      gross = sourceGross.times(rate).toDP(2),
      stamp = money(r["Stamp Duty"] || "0", "Stamp Duty"),
      total = money(r["Total Amount"]!, "Total Amount");
    if (!sourceGross.gt(0) || !gross.gt(0) || !total.gt(0))
      throw new Error(
        "Zero-value executions require review; they must not become ordinary purchases or sales.",
      );
    const accountGross = quantity.times(decimal(
      r["Price per Share in Account Currency"]!, "Price per Share in Account Currency",
    )).toDP(2);
    const instrumentGross = quantity.times(price).toDP(2);
    if (!instrumentGross.eq(sourceGross))
      throw new StatementMismatchError(`Quantity × instrument price gives ${instrumentGross.toFixed(2)} ${r["Instrument Currency"]}. Total Shares Amount is ${sourceGross.toFixed(2)}. Check the execution contract note and request corrected figures from Freetrade.`);
    const ConversionMismatch = r["Base FX Rate"] || r["FX Rate"] ? StatementMismatchError : Error;
    if (!accountGross.eq(gross))
      throw new ConversionMismatch(`Quantity × account price gives £${accountGross.toFixed(2)}. The converted gross is £${gross.toFixed(2)}. Check the gross sterling amount and charges on the contract note. Use the template only once you can evidence both amounts for every execution.`);
    const calculatedFee = sourceGross.times(rate).times(basisPoints).div(10000).toDP(2);
    if (!calculatedFee.eq(fxFee))
      throw new ConversionMismatch(`The exported FX fee is £${fxFee.toFixed(2)}. The base conversion and fee percentage give £${calculatedFee.toFixed(2)}. Obtain the contract note or ask Freetrade to confirm the fee and gross sterling amount before using the template.`);
    const fees = stamp.plus(fxFee);
    if (
      foreign &&
      !decimal(supplied!.fees, "Fees").times(rate).toDP(2).eq(fees)
    )
      throw new Error(
        "Verified fees do not match the exported GBP stamp duty and FX fee.",
      );
    if (r["Buy / Sell"] === "SELL" && !stamp.isZero())
      throw new Error("Stamp duty on a sale needs review.");
    if (
      !(r["Buy / Sell"] === "BUY" ? gross.plus(fees) : gross.minus(fees)).eq(
        total,
      )
    )
      throw new Error(
        "Freetrade gross amount and dealing costs do not match the net cash total for this trade direction.",
      );
    return trade(
      r["Order ID"]!,
      ukTradeDate(r.Timestamp!),
      r["Buy / Sell"],
      r.ISIN!,
      quantity.toString(),
      gross.toString(),
      fees.toString(),
    );
  },
};
const trading212: NativeAdapter = {
  version: "trading212-invest-21-gbp-v1",
  idColumn: "ID",
  isTrade: (r) => /^(Market|Limit|Stop|Stop limit) (buy|sell)$/.test(r.Action!),
  normalize(r, supplied) {
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
    const currency = r["Currency (Price / share)"]!;
    if (r["Currency (Total)"] !== "GBP")
      throw new Error("This Trading 212 reader requires GBP cash totals.");
    const foreign = !["GBP", "GBX"].includes(currency);
    if (
      foreign &&
      (!supplied?.netAmountConfirmed ||
        supplied.currency !== currency ||
        supplied.isin !== r.ISIN)
    )
      throw new Error(
        "Check the instrument, exchange rate and GBP fees against your execution statement, then add its reference.",
      );
    const rate = foreign
      ? decimal(supplied!.gbpPerUnit, "GBP per unit")
      : decimal("1", "Rate");
    if (
      !rate.gt(0) ||
      !decimal(r["Exchange rate"]!, "Exchange rate").times(rate).toDP(6).eq(1)
    )
      throw new Error(
        "Export exchange rate and verified GBP conversion do not reconcile.",
      );
    zeroOrBlank(r["Withholding tax"]!, "Withholding tax");
    const quantity = decimal(r["No. of shares"]!, "No. of shares"),
      price = decimal(r["Price / share"]!, "Price / share").div(
        currency === "GBX" ? 100 : 1,
      ),
      total = money(r.Total!, "Total"),
      gross = quantity.times(price).times(rate).toDP(2);
    let fees = decimal("0", "Fees");
    for (const name of ["Transaction fee", "Currency conversion fee"]) {
      const fee = decimal(r[name] || "0", name),
        feeCurrency = r[`Currency (${name})`];
      if (!fee.isZero()) {
        if (feeCurrency !== "GBP")
          throw new Error(
            "This layout requires separately identified GBP dealing and conversion fees.",
          );
        fees = fees.plus(fee);
      }
    }
    if (
      foreign &&
      !decimal(supplied!.fees, "Verified fees").times(rate).toDP(2).eq(fees)
    )
      throw new Error("Supporting fees do not match the exported GBP fees.");
    if (!quantity.gt(0) || !price.gt(0) || !total.gt(0))
      throw new Error(
        "Zero-value trades can represent corporate actions and need review.",
      );
    if (
      !(r.Action!.endsWith("buy") ? gross.plus(fees) : gross.minus(fees)).eq(
        total,
      )
    )
      throw new Error(
        "Trading 212 quantity, price, GBP conversion, fees and Total do not reconcile to the penny.",
      );
    return trade(
      r.ID!,
      ukTradeDate(r.Time!.replace(" ", "T") + "Z"),
      r.Action!.endsWith("buy") ? "BUY" : "SELL",
      r.ISIN!,
      quantity.toString(),
      gross.toString(),
      fees.toString(),
    );
  },
};
const trading212Current: NativeAdapter = {
  version: "trading212-invest-33-v1",
  idColumn: "ID",
  isTrade: trading212.isTrade,
  normalize(r, supplied) {
    if (!this.isTrade(r)) return trading212.normalize(r, supplied);
    for (const field of [
      "Currency conversion from amount",
      "Currency (Currency conversion from amount)",
      "Currency conversion to amount",
      "Currency (Currency conversion to amount)",
      "Merchant name",
      "Merchant category",
    ])
      if (r[field])
        throw new Error(
          "Separate currency conversions or card activity on a trade require review.",
        );
    const currency = r["Currency (Price / share)"]!;
    const foreign = !["GBP", "GBX"].includes(currency);
    if (
      foreign &&
      (!supplied?.netAmountConfirmed ||
        supplied.currency !== currency ||
        supplied.isin !== r.ISIN)
    )
      throw new Error(
        "Check the instrument, exchange rate and dealing costs against your execution statement, then add its reference.",
      );
    const rate = foreign
      ? decimal(supplied!.gbpPerUnit, "GBP per unit")
      : decimal("1", "Rate");
    let fees = decimal("0", "Fees");
    for (const name of [
      "Transaction fee",
      "Currency conversion fee",
      "Stamp duty reserve tax",
      "French transaction tax",
      "Finra fee",
    ]) {
      const fee = decimal(r[name] || "0", name);
      if (fee.isZero()) continue;
      const denomination = r[`Currency (${name})`];
      if (denomination === "GBP") fees = fees.plus(fee);
      else if (denomination === "GBX") fees = fees.plus(fee.div(100));
      else if (foreign && denomination === currency)
        fees = fees.plus(fee.times(rate));
      else
        throw new Error(
          `${name} currency cannot be reconciled to the verified trade conversion.`,
        );
    }
    const timestamp = r["Time (UTC)"]!;
    // Only documented UTC forms; never interpret a locale-dependent offset.
    const time = timestamp.replace(/(?:Z|\+00:00)$/, "").replace("T", " ");
    return trading212.normalize(
      {
        ...r,
        Time: time,
        "Exchange rate": r["Exchange rate"] || (foreign ? "" : "1"),
        "Transaction fee": fees.toDP(2).toString(),
        "Currency (Transaction fee)": "GBP",
        "Currency conversion fee": "",
        "Currency (Currency conversion fee)": "",
      },
      supplied,
    );
  },
};
export function nativeAdapter(
  broker: BrokerId,
  headers: string[],
): NativeAdapter | undefined {
  for (const [id, expected, adapter] of [
    ["hl", HL_HEADERS, hl],
    ["ii", II_HEADERS, ii],
    ["ajbell", AJ_HEADERS, ajbell],
    ["ajbell", AJ_HISTORY_HEADERS, ajbellHistory],
    ["ibkr", IBKR_HEADERS, ibkr],
  ] as const)
    if (broker === id && sameHeaders(headers, [...expected])) return adapter;
  if (broker === "freetrade" && sameHeaders(headers, FREETRADE_HEADERS))
    return freetrade;
  if (
    broker === "freetrade" &&
    sameHeaders(
      headers.map((h) => FREETRADE_RENAMED_COLUMNS[h] ?? h),
      FREETRADE_HEADERS,
    )
  )
    return {
      ...freetrade,
      version: "freetrade-activity-renamed-29-gbp-v1",
      normalize(row, supplied) {
        return freetrade.normalize(
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              FREETRADE_RENAMED_COLUMNS[key] ?? key,
              value,
            ]),
          ),
          supplied,
        );
      },
    };
  if (broker === "trading212" && sameHeaders(headers, TRADING212_HEADERS))
    return trading212;
  if (broker === "trading212" && sameHeaders(headers, TRADING212_2026_HEADERS))
    return trading212Current;
}
export const NATIVE_GUIDANCE: Record<BrokerId, string> = {
  freetrade:
    "Use the Activity Feed CSV. The documented 29-column layout, including renamed account/instrument amount columns, supports GBP trades and verified foreign trades. Foreign fees, base/effective rates and cash totals must reconcile. For a fractional order with conflicting sterling figures, check the gross GBP amount and separate fees on the execution contract note. Keep all records and use the template with the original Order IDs only when every execution and event can be accounted for. Transfers and some corporate actions may be missing from the export; reconcile complete history separately.",
  trading212:
    "Use the Invest account History CSV with all activity categories. Documented 21- and 33-column layouts support GBP/GBX prices and verified foreign trades with GBP totals. The newer layout also reconciles separately denominated stamp duty, French transaction tax and FINRA fees. Pie holdings and CFD exports cannot establish share acquisition history.",
  hl: "HL Transaction Summary files in UTF-8 and the dated Windows-1252 layout need verified security identifiers and dealing-cost details from matching contract notes. Unit cost may be in pence. Supply these details in the preview; every trade must reconcile before saving.",
  ii: "This assisted 11-column profile was tested with a public parser layout and synthetic trades. Interactive Investor exports can identify securities by SEDOL and may omit the wallet currency. Confirm the security ISIN, wallet currency, execution amounts and fees in the supporting-details form beside each unresolved record.",
  ibkr: "IBKR Activity Statements, Flex Queries and Transaction History are different formats. A Flex Query must include execution IDs, ISINs, asset categories, currency, gross proceeds, commission and trade-date FX. Use the 16-column execution Flex layout. For foreign trades, verify the statement account base is GBP. For a different base, use independently documented trade-date GBP rates in the template and enter ClientAccountID:TradeID as the transaction ID.",
  ajbell:
    "The six-column GBP Transaction history profile follows published partner guidance and has been tested with synthetic trades. Use Date, Description, Transaction, Quantity, Price and Amount (GBP). Confirm GBP prices in pounds, ISINs, execution references and dealing costs against contract notes in the preview. The older Type/Amount candidate also requires these details. Descriptions alone cannot identify a security safely.",
};

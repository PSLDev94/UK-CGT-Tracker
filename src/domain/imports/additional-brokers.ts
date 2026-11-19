import { Money, calendarDate, decimal } from "../values";
import type { NativeAdapter } from "./native";
import { SupportingFieldError, type SupportingDetails } from "./supporting-details";

export const HL_HEADERS =
  "Trade date,Settle date,Reference,Description,Unit cost (p),Quantity,Value (£)".split(
    ",",
  );
export const II_HEADERS =
  "Date,Settlement Date,Symbol,Sedol,Quantity,Price,Description,Reference,Debit,Credit,Running Balance".split(
    ",",
  );
// This observed candidate layout is assisted only; never advertised as broker-certified.
export const AJ_HEADERS = "Date,Description,Type,Quantity,Price,Amount".split(
  ",",
);
// Column names documented in Sharesight's AJ Bell transaction-history guide.
// Identity, execution reference and costs still require contract-note evidence.
export const AJ_HISTORY_HEADERS =
  "Date,Description,Transaction,Quantity,Price,Amount (GBP)".split(",");
export const IBKR_HEADERS =
  "ClientAccountID,AssetClass,CurrencyPrimary,FXRateToBase,ISIN,TradeID,TradeDate,Buy/Sell,Quantity,TradePrice,Proceeds,IBCommission,IBCommissionCurrency,Taxes,NetCash,LevelOfDetail".split(
    ",",
  );
const signed = (value: string, label: string) => {
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,12})?$/.test(value))
    throw new Error(
      `${label} must be a decimal amount without currency symbols.`,
    );
  return new Money(value.replaceAll(",", ""));
};
const unsigned = (value: string, label: string) =>
  decimal(signed(value, label).toFixed(), label);
const date = (value: string) =>
  calendarDate(
    /^\d{2}\/\d{2}\/\d{4}$/.test(value)
      ? value.split("/").reverse().join("-")
      : /^\d{8}$/.test(value)
        ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
        : value,
  );
function details(d: SupportingDetails | undefined, instruction: string): SupportingDetails {
  if (!d?.netAmountConfirmed || d.reference.trim().length < 8)
    throw new Error(instruction);
  return d;
}
function ordinary(
  id: string,
  day: string,
  side: string,
  isin: string,
  qty: string,
  gross: string,
  fees: string,
  currency: string,
  rate: string,
) {
  return {
    "Transaction ID": id,
    "Trade date": date(day),
    Type: side,
    ISIN: isin,
    Quantity: qty,
    Consideration: gross,
    Fees: fees,
    Currency: currency,
    "GBP per unit": rate,
    "Asset type": "ORDINARY_SHARE",
  };
}
function assisted(
  id: string,
  day: string,
  side: string,
  quantity: string,
  price: string,
  net: string,
  d: SupportingDetails,
  fixedPence = false,
) {
  const qty = unsigned(quantity, "Quantity");
  const unit = unsigned(price, "Price").div(
    fixedPence || d.priceUnit === "minor" ? 100 : 1,
  );
  const gross = qty.times(unit).toDP(2),
    fee = decimal(d.fees, "Fees"),
    cash = signed(net, "Net amount").abs();
  if (!qty.gt(0) || !unit.gt(0) || !cash.gt(0))
    throw new Error(
      "Zero-value transactions and non-positive quantities require specialist handling.",
    );
  if (!["BUY", "SELL"].includes(side))
    throw new Error(
      "This activity is not a recognised ordinary share purchase or sale.",
    );
  const expectedCash = side === "BUY" ? gross.plus(fee) : gross.minus(fee);
  if (!expectedCash.eq(cash)) {
    const places = Math.max(2, expectedCash.decimalPlaces(), cash.decimalPlaces());
    throw new SupportingFieldError(
      "fees",
      `Quantity × price, dealing fees and net cash do not reconcile. With the entered details the cash amount is ${d.currency} ${expectedCash.toFixed(places)}. The export shows ${d.currency} ${cash.toFixed(places)}. Check the fees against your contract note.`,
    );
  }
  return ordinary(
    id,
    day,
    side,
    d.isin,
    qty.toFixed(),
    gross.toFixed(),
    fee.toFixed(),
    d.currency,
    d.gbpPerUnit,
  );
}
export const hl: NativeAdapter = {
  version: "hl-summary-assisted-v1",
  idColumn: "Reference",
  isTrade: (r) => /^[BS]\d+$/.test(r.Reference ?? ""),
  normalize(r, supplied) {
    if (!this.isTrade(r))
      throw new Error(
        "HL activity is not an identified buy/sell contract reference. Transfers, distributions and adjustments need specialist review.",
      );
    const d = details(supplied, "Enter the ISIN and dealing fees from your contract note. Add its reference and confirm the net cash amount.");
    if (d.currency !== "GBP" || d.priceUnit !== "minor")
      throw new Error(
        "This HL layout labels unit cost in pence and cash in pounds. Confirm GBP and pence/minor units.",
      );
    const side = r.Reference!.startsWith("B") ? "BUY" : "SELL",
      net = signed(r["Value (£)"]!, "Value");
    if ((side === "BUY" && !net.lt(0)) || (side === "SELL" && !net.gt(0)))
      throw new Error("HL buy/sell reference and cash direction disagree.");
    return assisted(
      r.Reference!,
      r["Trade date"]!,
      side,
      r.Quantity!,
      r["Unit cost (p)"]!,
      r["Value (£)"]!,
      d,
      true,
    );
  },
};
const iiSide = (description: string) =>
  /^(Purchase|Bought|Buy)(?:\s|$)/i.test(description)
    ? "BUY"
    : /^(Sale|Sold|Sell)(?:\s|$)/i.test(description)
      ? "SELL"
      : "";
export const ii: NativeAdapter = {
  version: "ii-transactions-assisted-v1",
  idColumn: "Reference",
  isTrade: (r) => !!iiSide(r.Description ?? ""),
  normalize(r, supplied) {
    const side = iiSide(r.Description ?? "");
    if (!side)
      throw new Error(
        "Interactive Investor activity is not a recognised purchase or sale. Do not omit transfers or corporate actions.",
      );
    const d = details(supplied, "Enter the ISIN, trade currency, price units and dealing fees from your contract note. Add its reference and confirm the net cash amount."),
      debit = unsigned(r.Debit || "0", "Debit"),
      credit = unsigned(r.Credit || "0", "Credit");
    if (
      side === "BUY"
        ? !debit.gt(0) || !credit.isZero()
        : !credit.gt(0) || !debit.isZero()
    )
      throw new Error(
        "Interactive Investor debit/credit and trade direction disagree.",
      );
    return assisted(
      r.Reference!,
      r.Date!,
      side,
      r.Quantity!,
      r.Price!,
      (side === "BUY" ? debit : credit).toFixed(),
      d,
    );
  },
};
export const ajbell: NativeAdapter = {
  version: "ajbell-six-column-assisted-v1",
  idColumn: "Transaction ID",
  isTrade: (r) =>
    ["Purchase", "Sale", "Buy", "Sell", "BUY", "SELL"].includes(r.Type ?? ""),
  normalize(r, supplied) {
    if (!this.isTrade(r))
      throw new Error(
        "AJ Bell activity is not a recognised ordinary purchase or sale. Review transfers and corporate actions separately.",
      );
    const d = details(supplied, "Enter the ISIN, execution reference, currency, price units and dealing fees from your contract note. Confirm the net cash amount.");
    if (!d.transactionId.trim())
      throw new Error(
        "This export omits a transaction ID. Supply the unique execution/contract-note reference; do not use a row number or ticker.",
      );
    return assisted(
      d.transactionId,
      r.Date!,
      ["Purchase", "Buy", "BUY"].includes(r.Type!) ? "BUY" : "SELL",
      r.Quantity!,
      r.Price!,
      r.Amount!,
      d,
    );
  },
};
export const ajbellHistory: NativeAdapter = {
  version: "ajbell-history-gbp-assisted-v1",
  idColumn: "Transaction ID",
  isTrade: (r) => ["Purchase", "Sale"].includes(r.Transaction ?? ""),
  normalize(r, supplied) {
    const d = details(supplied, "Enter the ISIN, execution reference and dealing fees from your contract note. Confirm the net cash amount.");
    if (d.currency !== "GBP" || d.priceUnit !== "major")
      throw new Error(
        "This AJ Bell history layout requires GBP cash and a contract-note-confirmed price in pounds. Foreign prices and pence need a separately verified mapping.",
      );
    if (!this.isTrade(r))
      throw new Error(
        "AJ Bell activity is not a Purchase or Sale. Transfers, distributions and corporate actions require review.",
      );
    return ajbell.normalize(
      { ...r, Type: r.Transaction!, Amount: r["Amount (GBP)"]! },
      d,
    );
  },
};
export const ibkr: NativeAdapter = {
  version: "ibkr-flex-executions-v1",
  idColumn: "TradeID",
  isTrade: () => true,
  normalize(r, supplied) {
    if (r.AssetClass !== "STK" || r.LevelOfDetail !== "EXECUTION")
      throw new Error(
        "Export stock executions only. Orders, closed lots and non-stock assets cannot be imported as executions.",
      );
    if (
      !r.ClientAccountID ||
      !r.TradeID ||
      !["BUY", "SELL"].includes(r["Buy/Sell"]!)
    )
      throw new Error(
        "IBKR execution needs an account and BUY/SELL direction.",
      );
    const side = r["Buy/Sell"]!,
      qty = signed(r.Quantity!, "Quantity"),
      price = decimal(r.TradePrice!, "Trade price"),
      proceeds = signed(r.Proceeds!, "Proceeds"),
      commission = signed(r.IBCommission!, "Commission"),
      taxes = signed(r.Taxes!, "Taxes"),
      net = signed(r.NetCash!, "Net cash");
    if (
      !qty.abs().gt(0) ||
      !price.gt(0) ||
      (side === "BUY"
        ? !qty.gt(0) || !proceeds.lt(0)
        : !qty.lt(0) || !proceeds.gt(0))
    )
      throw new Error("IBKR quantity, proceeds and direction disagree.");
    if (
      commission.gt(0) ||
      taxes.gt(0) ||
      r.IBCommissionCurrency !== r.CurrencyPrimary
    )
      throw new Error(
        "Commission rebates, mixed fee currencies or positive taxes need review.",
      );
    if (
      !qty.abs().times(price).toDP(2).eq(proceeds.abs().toDP(2)) ||
      !proceeds.plus(commission).plus(taxes).eq(net)
    )
      throw new Error(
        "IBKR gross proceeds, execution price, commission, taxes and net cash do not reconcile.",
      );
    let rate = "1";
    if (r.CurrencyPrimary === "GBP" && !decimal(r.FXRateToBase!, "Flex rate to base").eq(1))
      throw new Error("A GBP trade has a non-unit rate to the account base. Use a verified GBP-base Flex export or document the GBP conversions separately in the template.");
    if (r.CurrencyPrimary !== "GBP") {
      const d = details(supplied, "Check the exported rate and net cash against your statement. Add its reference and confirm the statement base currency is GBP.");
      if (d.statementBaseCurrency !== "GBP")
        throw new SupportingFieldError("statementBaseCurrency", "Check the account base currency on the statement. Only a GBP-base Flex export can supply a GBP conversion. For another base currency, use separately documented GBP rates in the template.");
      if (
        d.currency !== r.CurrencyPrimary ||
        d.isin !== r.ISIN ||
        !decimal(d.gbpPerUnit, "GBP per unit").eq(
          decimal(r.FXRateToBase!, "FX rate"),
        )
      )
        throw new Error(
          "Check that your Flex statement uses GBP as its base currency and confirms the exported ISIN and trade-date conversion.",
        );
      rate = d.gbpPerUnit;
    }
    return ordinary(
      `${r.ClientAccountID}:${r.TradeID}`,
      r.TradeDate!,
      side,
      r.ISIN!,
      qty.abs().toFixed(),
      proceeds.abs().toFixed(),
      commission.plus(taxes).abs().toFixed(),
      r.CurrencyPrimary!,
      rate,
    );
  },
};

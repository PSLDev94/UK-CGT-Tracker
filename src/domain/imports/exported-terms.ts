import { decimal, Money } from "../values";

/** Read-only terms from a recognised native trade layout. The adapter still
 * checks identifiers, amounts, fee denominations and net cash before a save. */
export interface ExportedTerms {
  isin?: string;
  currency?: string;
  accountCurrency?: string;
  priceUnit?: "minor" | "major";
  gbpPerUnit?: string;
  feesGBP?: string;
  feesInCurrency?: string;
  sourceIssue?: string;
}

export function feesInTradeCurrency(terms: ExportedTerms, rate: string) {
  if (terms.feesInCurrency !== undefined) return terms.feesInCurrency;
  if (terms.feesGBP === undefined) return undefined;
  try {
    const conversion = decimal(rate, "GBP per unit");
    if (conversion.gt(0))
      return new Money(terms.feesGBP).div(conversion).toDP(12).toFixed();
  } catch {
    /* A missing or invalid rate stays editable. */
  }
}

export function exportedTerms(
  broker: string,
  row: Record<string, string>,
): ExportedTerms {
  if (broker === "hl")
    return { currency: "GBP", priceUnit: "minor", gbpPerUnit: "1" };
  if (broker === "ajbell" && "Amount (GBP)" in row)
    return { currency: "GBP", priceUnit: "major", gbpPerUnit: "1" };
  if (!["freetrade", "ibkr", "trading212"].includes(broker)) return {};
  const instrument =
    row["Instrument Currency"] ||
    row.CurrencyPrimary ||
    row["Currency (Price / share)"];
  const terms: ExportedTerms = {
    currency: instrument,
    isin: row.ISIN,
    priceUnit:
      instrument === "GBX" && broker === "trading212" ? "minor" : "major",
  };
  try {
    if (broker === "ibkr") {
      terms.gbpPerUnit = decimal(
        row.FXRateToBase!,
        "FX rate to base",
      ).toFixed();
      if (terms.gbpPerUnit === "0")
        throw new Error("The Flex FXRateToBase must be positive.");
      if (row.IBCommissionCurrency === instrument) {
        const cost = (field: string) => {
          const value = row[field] ?? "";
          if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,12})?$/.test(value))
            throw new Error(`The Flex ${field} must be a decimal amount.`);
          return new Money(value.replaceAll(",", "")).abs();
        };
        terms.feesInCurrency = cost("IBCommission")
          .plus(cost("Taxes"))
          .toFixed();
      } else
        throw new Error(
          "The Flex commission currency must match the instrument currency.",
        );
      return terms;
    }
    const freetrade = broker === "freetrade";
    terms.accountCurrency = freetrade
      ? row["Account Currency"]
      : row["Currency (Total)"];
    if (terms.accountCurrency !== "GBP")
      throw new Error("This export layout requires GBP cash amounts.");
    const exchange = freetrade
      ? row["Base FX Rate"] || row["FX Rate"]
      : row["Exchange rate"];
    if (exchange) {
      const inverse = decimal(exchange, "Export exchange rate");
      if (inverse.isZero())
        throw new Error("The exported exchange rate must be positive.");
      terms.gbpPerUnit = new Money(1).div(inverse).toDP(12).toFixed();
      if (terms.gbpPerUnit === "0")
        throw new Error("The exported rate exceeds supported precision.");
    } else if (!freetrade)
      throw new Error(
        "The Exchange rate column is missing a rate for this trade.",
      );
    if (freetrade) {
      terms.feesGBP = decimal(row["Stamp Duty"] || "0", "Stamp duty")
        .plus(decimal(row["FX Fee Amount"] || "0", "FX fee"))
        .toFixed();
    } else {
      let total = new Money(0);
      for (const field of [
        "Transaction fee",
        "Currency conversion fee",
        "Stamp duty reserve tax",
        "French transaction tax",
        "Finra fee",
      ]) {
        const amount = decimal(row[field] || "0", field);
        if (amount.isZero()) continue;
        const denomination = row[`Currency (${field})`];
        if (denomination === "GBP") total = total.plus(amount);
        else if (denomination === "GBX") total = total.plus(amount.div(100));
        else if (denomination === instrument && terms.gbpPerUnit)
          total = total.plus(amount.times(terms.gbpPerUnit));
        else
          throw new Error(
            `The ${field} currency cannot be reconciled to this trade.`,
          );
      }
      terms.feesGBP = total.toDP(2).toFixed();
    }
  } catch (error) {
    terms.sourceIssue =
      error instanceof Error
        ? error.message
        : "Check the currency, fees and exchange rate in the export.";
  }
  return terms;
}

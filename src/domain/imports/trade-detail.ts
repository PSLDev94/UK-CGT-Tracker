import type { Trade } from "../cgt/types";
import { Money } from "../values";
import type { ImportRecord } from "./review";

type Provenance = Partial<NonNullable<ImportRecord["provenance"]>> & {
  executionReference?: string;
};

/** The same reconciled figures are shown before saving and in the stored receipt. */
export function importTradeDetail(
  trade: Omit<Trade, "id">,
  evidence?: Provenance,
  reference?: string,
) {
  const currency = evidence?.originalCurrency ?? "GBP";
  const consideration = evidence?.consideration ?? trade.considerationGBP;
  const fees = evidence?.fees ?? trade.feesGBP;
  const fields = evidence?.native?.fields;
  const note = evidence?.native?.supportingDetails;
  // Older native imports stored the reference only in the statement fields.
  const executionReference =
    reference ||
    evidence?.executionReference ||
    fields?.ID ||
    fields?.Reference ||
    fields?.TradeID ||
    fields?.["Order ID"] ||
    note?.transactionId;
  const net = (amount: string, charges: string) =>
    (trade.side === "BUY" ? new Money(amount).negated() : new Money(amount))
      .minus(charges)
      .toFixed();
  return {
    date: trade.date,
    side: trade.side,
    quantity: new Money(trade.quantity).toFixed(),
    securityId: trade.securityId,
    currency,
    consideration,
    fees,
    netCash: net(consideration, fees),
    ...(currency !== "GBP" && {
      gbpPerUnit: evidence?.gbpPerUnit,
      netCashGBP: net(trade.considerationGBP, trade.feesGBP),
    }),
    ...(note &&
      currency === "GBP" &&
      note.currency !== "GBP" && {
        instrumentCurrency: note.currency,
        gbpPerUnit: note.gbpPerUnit,
      }),
    executionReference: executionReference?.trim() || null,
    statementReference: note?.reference?.trim() || null,
  };
}

export type ImportTradeDetail = ReturnType<typeof importTradeDetail>;

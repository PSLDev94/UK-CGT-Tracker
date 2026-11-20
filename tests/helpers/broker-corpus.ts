import { readFileSync } from "node:fs";
import Papa from "papaparse";
import type { BrokerId } from "../../src/domain/imports/brokers";
import type { SupportingDetails } from "../../src/domain/imports/supporting-details";

export const brokerCases = [
  {
    broker: "freetrade",
    file: "freetrade-fx-fees",
    gain: "95.05",
    amount: "Total Amount",
    activity: "Type",
    label: "Title",
  },
  {
    broker: "trading212",
    file: "trading212-gbp",
    gain: "5.25",
    amount: "Total",
    activity: "Action",
    label: "Name",
  },
  {
    broker: "trading212",
    file: "trading212-2026-gbp",
    gain: "72.00",
    amount: "Total",
    activity: "Action",
    label: "Name",
  },
  {
    broker: "freetrade",
    file: "freetrade-gbp",
    gain: "74.38",
    amount: "Total Amount",
    activity: "Type",
    label: "Title",
  },
  {
    broker: "hl",
    file: "hl-assisted",
    gain: "70.88",
    amount: "Value (£)",
    activity: "Reference",
    label: "Description",
  },
  {
    broker: "ii",
    file: "ii-assisted",
    gain: "70.88",
    amount: "Debit",
    activity: "Description",
    label: "Symbol",
  },
  {
    broker: "ajbell",
    file: "ajbell-assisted-candidate",
    gain: "70.88",
    amount: "Amount",
    activity: "Type",
    label: "Description",
  },
  {
    broker: "ajbell",
    file: "ajbell-history-gbp",
    gain: "70.88",
    amount: "Amount (GBP)",
    activity: "Transaction",
    label: "Description",
  },
  {
    broker: "ibkr",
    file: "ibkr-flex-gbp",
    gain: "71.63",
    amount: "NetCash",
    activity: "AssetClass",
    label: "TradeDate",
  },
] satisfies {
  broker: BrokerId;
  file: string;
  gain: string;
  amount: string;
  activity: string;
  label: string;
}[];
export type BrokerCase = (typeof brokerCases)[number];
export const fixture = (c: BrokerCase) =>
  readFileSync(
    new URL(`../fixtures/brokers/${c.file}.csv`, import.meta.url),
    "utf8",
  );
export const fixtureRows = (c: BrokerCase) =>
  Papa.parse<Record<string, string>>(fixture(c), {
    header: true,
    skipEmptyLines: true,
  }).data;
export function fixtureDetails(
  c: BrokerCase,
): Record<string, SupportingDetails> {
  if (c.file === "freetrade-fx-fees")
    return Object.fromEntries(
      ["5.625", "3.375"].map((fees, i) => [
        String(i + 2),
        {
          isin: "US0378331005",
          currency: "USD",
          gbpPerUnit: "0.8",
          priceUnit: "major",
          fees,
          transactionId: "",
          reference: "Synthetic foreign execution contract",
          netAmountConfirmed: true,
        },
      ]),
    ) as Record<string, SupportingDetails>;
  if (!["hl", "ii", "ajbell"].includes(c.broker)) return {};
  const details = JSON.parse(
    readFileSync(
      new URL("../fixtures/brokers/assisted-details.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, SupportingDetails>;
  if (c.file === "ajbell-history-gbp")
    for (const d of Object.values(details)) d.priceUnit = "major";
  return details;
}

/** Independent synthetic exporter: values are test inputs, never inferred from a real file. */
export function syntheticTrade(
  c: BrokerCase,
  input: {
    id: string;
    date: string;
    side: "BUY" | "SELL";
    quantity: string;
    price: string;
    gross: string;
    fees: string;
    net: string;
  },
) {
  const r = { ...fixtureRows(c)[0]! };
  if ("ISIN" in r) r.ISIN = "GB0008706128";
  const d: SupportingDetails = {
    isin: "GB0008706128",
    currency: "GBP",
    gbpPerUnit: "1",
    priceUnit: "major",
    fees: input.fees,
    transactionId: input.id,
    reference: `Synthetic contract ${input.id}`,
    netAmountConfirmed: true,
  };
  const x = input;
  if (c.broker === "trading212") {
    Object.assign(r, {
      ID: x.id,
      Action: `Market ${x.side.toLowerCase()}`,
      "No. of shares": x.quantity,
      "Price / share": x.price,
      "Currency (Price / share)": "GBP",
      "Exchange rate": "1",
      Total: x.net,
      "Transaction fee": x.fees,
      "Currency (Transaction fee)": "GBP",
      "Currency conversion fee": "",
      "Stamp duty reserve tax": "",
    });
    // Do not introduce a column into the legacy layout.
    if (c.file === "trading212-gbp") {
      delete r["Stamp duty reserve tax"];
      r.Time = `${x.date} 12:00:00`;
    } else r["Time (UTC)"] = `${x.date} 12:00:00`;
  } else if (c.broker === "freetrade") {
    Object.assign(r, {
      "Instrument Currency": "GBP",
      "FX Rate": "",
      "Base FX Rate": "",
      "FX Fee Amount": "",
      "FX Fee (BPS)": "",
      "Order ID": x.id,
      Timestamp: `${x.date}T12:00:00.000Z`,
      "Buy / Sell": x.side,
      Quantity: x.quantity,
      "Price per Share": x.price,
      "Price per Share in Account Currency": x.price,
      "Total Shares Amount": x.gross,
      "Stamp Duty": x.fees,
      "Total Amount": x.net,
    });
  } else if (c.broker === "hl") {
    Object.assign(r, {
      Reference: `${x.side === "BUY" ? "B" : "S"}${x.id}`,
      "Trade date": x.date,
      Quantity: x.quantity,
      "Unit cost (p)": String(Number(x.price) * 100),
      "Value (£)": `${x.side === "BUY" ? "-" : ""}${x.net}`,
    });
    d.priceUnit = "minor";
  } else if (c.broker === "ii") {
    Object.assign(r, {
      Reference: x.id,
      Date: x.date,
      Quantity: x.quantity,
      Price: x.price,
      Description:
        x.side === "BUY"
          ? "Purchase synthetic shares"
          : "Sale synthetic shares",
      Debit: x.side === "BUY" ? x.net : "0",
      Credit: x.side === "SELL" ? x.net : "0",
    });
  } else if (c.broker === "ajbell") {
    Object.assign(r, {
      Date: x.date,
      Quantity: x.quantity,
      Price: x.price,
      [c.activity]: x.side === "BUY" ? "Purchase" : "Sale",
      [c.amount]: x.net,
    });
  } else {
    Object.assign(r, {
      TradeID: x.id,
      TradeDate: x.date,
      "Buy/Sell": x.side,
      Quantity: `${x.side === "SELL" ? "-" : ""}${x.quantity}`,
      TradePrice: x.price,
      Proceeds: `${x.side === "BUY" ? "-" : ""}${x.gross}`,
      IBCommission: `-${x.fees}`,
      Taxes: "0",
      NetCash: `${x.side === "BUY" ? "-" : ""}${x.net}`,
    });
  }
  return { row: r, details: d };
}

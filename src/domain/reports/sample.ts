import { createHash } from "node:crypto";
import { calculateGains } from "../cgt/calculate";
import type { Trade } from "../cgt/types";
import type { ReportSnapshot } from "./report";

// The same fictional disposals shown in the public homepage example.
const examples: [
  string,
  string,
  string,
  Trade["side"],
  string,
  string,
  string?,
][] = [
  ["Apple", "US0378331005", "2025-06-02", "BUY", "40", "6200"],
  ["Tesla", "US88160R1014", "2025-06-03", "BUY", "20", "4000"],
  ["Apple", "US0378331005", "2025-10-15", "SELL", "40", "8505", "5"],
  ["Tesla", "US88160R1014", "2025-11-02", "SELL", "20", "4100"],
  ["Tesla", "US88160R1014", "2025-11-12", "BUY", "20", "4600"],
  ["Lloyds Banking Group", "GB0008706128", "2026-03-10", "BUY", "1000", "1150"],
  [
    "Lloyds Banking Group",
    "GB0008706128",
    "2026-03-10",
    "SELL",
    "1000",
    "1200",
  ],
];
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const account = {
  broker: "ajbell",
  label: "Illustrative dealing account",
  confirmed: true,
};
const sources = examples.map(([instrument], index) => ({
  key: hash(`sample-trade-${index + 1}`),
  ...account,
  record: index + 2,
  importReference: "sample-ajbell-history",
  instrument,
  reference: `SAMPLE-DEAL-${index + 1}`,
  statementReference: `Sample contract note ${index + 1}`,
}));
const trades: Trade[] = examples.map(
  (
    [, securityId, date, side, quantity, considerationGBP, feesGBP = "0"],
    index,
  ) => ({
    id: sources[index]!.key,
    securityId,
    date,
    side,
    quantity,
    considerationGBP,
    feesGBP,
  }),
);
export const sampleReport: ReportSnapshot = {
  id: "sample-2025-26",
  input_digest: hash(JSON.stringify(trades)),
  created_at: "2026-05-06T12:00:00Z",
  coverage_confirmed: true,
  accounts: [account],
  result: calculateGains(trades, {
    taxYear: "2025-26",
    historyThrough: "2026-05-05",
  }),
  sources,
};

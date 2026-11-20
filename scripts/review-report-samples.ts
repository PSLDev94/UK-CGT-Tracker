import { mkdirSync, writeFileSync } from "node:fs";
import { calculateGains } from "../src/domain/cgt/calculate";
import { reportPdf } from "../src/domain/reports/pdf";
import { reportCsv } from "../src/domain/reports/report";
import type { Trade } from "../src/domain/cgt/types";
async function main() {
  const trades: Trade[] = [
    {
      id: "SYNTHETIC-BUY-001",
      securityId: "GB0008706128",
      date: "2024-01-01",
      side: "BUY",
      quantity: "1000",
      considerationGBP: "500",
      feesGBP: "2.5",
    },
    {
      id: "SYNTHETIC-SELL-001",
      securityId: "GB0008706128",
      date: "2024-07-01",
      side: "SELL",
      quantity: "250",
      considerationGBP: "200",
      feesGBP: "0",
    },
  ];
  const snapshot = {
    id: "SYNTHETIC-REVIEW-EXAMPLE",
    input_digest: "Synthetic data only - no customer information",
    created_at: "2026-11-17T12:00:00Z",
    coverage_confirmed: true,
    result: calculateGains(trades, {
      taxYear: "2024-25",
      historyThrough: "2025-05-05",
    }),
  };
  mkdirSync(".private/report-review", { recursive: true });
  for (const [kind, evidence] of [
    ["summary", false],
    ["evidence", true],
  ] as const)
    writeFileSync(
      `.private/report-review/${kind}.pdf`,
      await reportPdf(snapshot, evidence),
    );
  writeFileSync(".private/report-review/evidence.csv", reportCsv(snapshot));
  const many = {
    ...snapshot,
    result: {
      ...snapshot.result,
      disposals: Array.from({ length: 150 }, () => ({
        ...snapshot.result.disposals[0]!,
        sourceIds: ["SYNTHETIC-" + "a".repeat(200)],
      })),
    },
  };
  writeFileSync(
    ".private/report-review/multipage.pdf",
    await reportPdf(many, true),
  );
  console.log(
    "Generated synthetic summary, evidence and pagination review artifacts.",
  );
}
void main();

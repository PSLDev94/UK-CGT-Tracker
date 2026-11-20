import { BROKERS } from "../imports/brokers";
import { sampleReport } from "./sample";
import { displayDate, money } from "../../ui/format";

const ruleNames = {
  SAME_DAY: "Same-day rule",
  THIRTY_DAY: "30-day rule",
  SECTION_104: "Section 104 pool",
} as const;
const saleAnchors: Record<string, string> = {
  US0378331005: "apple",
  US88160R1014: "tesla",
  GB0008706128: "lloyds",
};

// This is a view of the fixed public sample. Use the saved amounts, including its fee breakdown.
export function samplePreview() {
  const { result, sources, created_at } = sampleReport;
  const byKey = new Map(sources!.map((source) => [source.key, source]));
  type RecordKind =
    "sale" | "matched-purchase" | "pool-addition" | "pool-retained";
  function receipt(
    key: string,
    date: string,
    kind: RecordKind,
    amountGBP: string,
    role: string,
  ) {
    const source = byKey.get(key)!;
    return {
      ref: source.reference!,
      kind,
      isoDate: date,
      row: source.record,
      amount: money(amountGBP),
      label: `${source.statementReference} · CSV row ${source.record}`,
      date: displayDate(date),
      role,
    };
  }

  const sales = result.disposals.map((sale) => {
    const breakdown = sale.saleBreakdown!;
    const receipts = sale.sourceIds.map((key) =>
      receipt(key, sale.date, "sale", breakdown.grossProceedsGBP, "Sale"),
    );
    for (const match of sale.matches) {
      for (const key of match.acquisitionIds ?? []) {
        receipts.push(
          receipt(
            key,
            match.acquisitionDate!,
            "matched-purchase",
            match.costGBP,
            "Matched purchase",
          ),
        );
      }
    }
    // The sample has one earlier pool purchase per pooled holding. The Tesla
    // purchase explains the remaining pool and is expressly separate from its 30-day match.
    for (const movement of result.poolMovements ?? []) {
      if (
        movement.kind !== "acquisition" ||
        movement.securityId !== sale.securityId ||
        movement.date > sale.date
      )
        continue;
      const inPool = sale.matches.some((match) => match.rule === "SECTION_104");
      const role = inPool
        ? "Purchase added to pool"
        : "Earlier purchase retained in pool";
      for (const key of movement.sourceIds) {
        receipts.push(
          receipt(
            key,
            movement.date,
            inPool ? "pool-addition" : "pool-retained",
            movement.costChangeGBP,
            `${role} · ${money(movement.costChangeGBP)}`,
          ),
        );
      }
    }
    return {
      id: saleAnchors[sale.securityId]!,
      name: byKey.get(sale.sourceIds[0]!)!.instrument!,
      isin: sale.securityId,
      date: displayDate(sale.date),
      rule: sale.matches.map((match) => ruleNames[match.rule]).join(" + "),
      result: `${Number(sale.gainGBP) > 0 ? "+" : ""}${money(sale.gainGBP)}`,
      qty: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 12 }).format(
        Number(sale.quantity),
      ),
      gross: money(breakdown.grossProceedsGBP),
      fee: money(breakdown.sellingCostsGBP),
      net: money(sale.proceedsGBP),
      cost: money(sale.allowableCostGBP),
      totalCost: money(breakdown.totalAllowableCostsGBP),
      sources: receipts,
    };
  });
  const summary = result.summary!;
  const account = sampleReport.accounts![0]!;
  const broker = BROKERS.find((entry) => entry.id === account.broker)?.name ?? account.broker;
  return {
    broker,
    year: result.taxYear.replace("-", "–"),
    net: money(summary.netGainGBP),
    gains: money(summary.gainsGBP),
    losses: money(summary.lossesGBP),
    gross: money(result.saleBreakdown!.grossProceedsGBP),
    costs: money(result.saleBreakdown!.totalAllowableCostsGBP),
    sales,
    coverage: displayDate(result.historyThrough),
    saved: displayDate(new Date(created_at).toISOString().slice(0, 10)),
  };
}
export type PreviewModel = ReturnType<typeof samplePreview>;

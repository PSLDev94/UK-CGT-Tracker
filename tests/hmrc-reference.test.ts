import { describe, expect, it } from "vitest";
import { calculateGains } from "../src/domain/cgt/calculate";
import type { Trade } from "../src/domain/cgt/types";

// HMRC CG51560 examples 1–3, inspected 17 November 2026.
// https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560
// Dates shift into supported years while preserving calendar distances and
// quantities. Monetary amounts are our own synthetic inputs, not HMRC figures.
const t = (
  id: string,
  date: string,
  side: Trade["side"],
  quantity: string,
  considerationGBP: string,
): Trade => ({
  id,
  date,
  side,
  quantity,
  considerationGBP,
  securityId: "reference-ordinary-share",
  feesGBP: "0",
});
const options = { taxYear: "2024-25" as const, historyThrough: "2025-05-05" };

describe("HMRC published share-matching examples", () => {
  it("CG51560 example 1: a 31 July repurchase matches the 1 July disposal", () => {
    const r = calculateGains(
      [
        t("pool", "2024-01-01", "BUY", "1000", "1000"),
        t("sale", "2024-07-01", "SELL", "1000", "3000"),
        t("repurchase", "2024-07-31", "BUY", "1000", "2000"),
      ],
      options,
    );
    expect(r.status).toBe("complete");
    expect(r.disposals[0]?.matches).toMatchObject([
      { rule: "THIRTY_DAY", quantity: "1000", costGBP: "2000" },
    ]);
    expect(r.summary?.netGainGBP).toBe("1000.00");
    expect(r.pools[0]).toMatchObject({ quantity: "1000", costGBP: "1000" });
  });
  it("CG51560 example 2: 500 future shares and 1200 pooled shares match a 1700-share sale", () => {
    const r = calculateGains(
      [
        t("pool", "2024-01-01", "BUY", "2500", "5000"),
        t("sale", "2025-03-27", "SELL", "1700", "6800"),
        t("repurchase", "2025-03-30", "BUY", "500", "1500"),
      ],
      options,
    );
    expect(r.disposals[0]?.matches).toMatchObject([
      { rule: "THIRTY_DAY", quantity: "500", costGBP: "1500" },
      { rule: "SECTION_104", quantity: "1200", costGBP: "2400" },
    ]);
    expect(r.summary?.netGainGBP).toBe("2900.00");
    expect(r.pools[0]).toMatchObject({ quantity: "1300", costGBP: "2600" });
  });
  it("CG51560 example 3: 28 February to 31 March is outside the 30-day window", () => {
    const r = calculateGains(
      [
        t("pool", "2024-01-01", "BUY", "10000", "10000"),
        t("sale", "2025-02-28", "SELL", "2000", "6000"),
        t("repurchase", "2025-03-31", "BUY", "3000", "6000"),
      ],
      options,
    );
    expect(r.disposals[0]?.matches).toMatchObject([
      { rule: "SECTION_104", quantity: "2000", costGBP: "2000" },
    ]);
    expect(r.summary?.netGainGBP).toBe("4000.00");
    expect(r.pools[0]).toMatchObject({ quantity: "11000", costGBP: "14000" });
  });

  it("HS284 2026 example 3 reconciles both partial disposals and all four dealing charges", () => {
    // HMRC's worked calculation uses whole pounds. Step 4 dates the second sale
    // February 2026. Use that timeline and keep the live pool at full precision.
    // https://assets.publishing.service.gov.uk/media/69c14ad87e02b81c0d1c7669/HS284-Example-3-2026.pdf
    const r = calculateGains([
      { ...t("first-buy", "2017-04-07", "BUY", "1000", "4000"), feesGBP: "150" },
      { ...t("second-buy", "2020-09-07", "BUY", "500", "2050"), feesGBP: "80" },
      { ...t("first-sale", "2025-05-07", "SELL", "700", "3360"), feesGBP: "100" },
      { ...t("second-sale", "2026-02-09", "SELL", "400", "2080"), feesGBP: "105" },
    ], { taxYear: "2025-26", historyThrough: "2026-05-05" });
    expect(r.status).toBe("complete");
    expect(r.disposals.map(sale => [sale.allowableCostGBP, sale.gainGBP])).toEqual([
      ["2930.67", "329.33"], ["1674.67", "300.33"],
    ]);
    expect(r.pools).toMatchObject([{ quantity: "400" }]);
    expect(r.saleBreakdown).toMatchObject({ grossProceedsGBP: "5440.00", sellingCostsGBP: "205.00" });
    expect(r.summary?.netGainGBP).toBe("629.67");
    expect(r.displayedDisposalTotals?.netGainGBP).toBe("629.66");
  });
});

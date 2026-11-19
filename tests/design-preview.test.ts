import { describe, expect, it } from "vitest";
import { samplePreview } from "../src/app/design-preview/preview-model";
import { sampleReport } from "../src/domain/reports/sample";

describe("staging design specimen", () => {
  const model = samplePreview();
  it("keeps the annual outcome separate from the individual sale and its fee", () => {
    expect(model).toMatchObject({
      net: "£1,850.00",
      gross: "£13,805.00",
      costs: "£11,955.00",
      gains: "£2,350.00",
      losses: "£500.00",
    });
    expect(model.sales[0]).toMatchObject({
      id: "apple",
      result: "+£2,300.00",
      gross: "£8,505.00",
      net: "£8,500.00",
      cost: "£6,200.00",
      fee: "£5.00",
      totalCost: "£6,205.00",
    });
  });
  it("identifies the purchase used for the loss and preserves all seven source records", () => {
    const tesla = model.sales.find((sale) => sale.id === "tesla")!;
    expect(tesla).toMatchObject({
      result: "−£500.00",
      rule: "30-day rule",
      cost: "£4,600.00",
    });
    expect(tesla.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: "SAMPLE-DEAL-5",
          date: "12 November 2025",
          role: "Matched purchase",
        }),
        expect.objectContaining({
          ref: "SAMPLE-DEAL-2",
          date: "3 June 2025",
          role: expect.stringContaining("retained in pool"),
        }),
      ]),
    );
    expect(
      model.sales
        .flatMap((sale) => sale.sources.map((source) => source.ref))
        .sort(),
    ).toEqual(sampleReport.sources!.map((source) => source.reference).sort());
  });
});

import { describe, expect, it } from "vitest";
import { money, unitPrice } from "../src/ui/format";

describe("financial display without binary floating point", () => {
  it("preserves large monetary amounts and applies display-only penny rounding", () => {
    expect(money("100000000000000.015")).toBe("£100,000,000,000,000.02");
    expect(money("-1234.005")).toBe("−£1,234.01");
  });
  it("keeps sub-penny unit prices visible without changing total-money rounding", () => {
    expect(unitPrice("0.004")).toBe("£0.004");
    expect(unitPrice("0.009000000001")).toBe("£0.009");
    expect(unitPrice("1e-12")).toBe("<£0.00000001");
    expect(unitPrice("0")).toBe("£0.00");
    expect(unitPrice("2.5")).toBe("£2.50");
    expect(unitPrice("10000.015")).toBe("£10,000.015");
  });
  it("handles scientific notation, negative zero and blocked values honestly", () => {
    expect(money("1e-20")).toBe("£0.00");
    expect(money("-0.004")).toBe("£0.00");
    expect(money(null)).toBe("Not calculated");
  });
});

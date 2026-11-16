import { describe, expect, it } from "vitest";
import { money } from "../src/ui/format";

describe("financial display without binary floating point", () => {
  it("preserves large monetary amounts and applies display-only penny rounding", () => {
    expect(money("100000000000000.015")).toBe("£100,000,000,000,000.02");
    expect(money("-1234.005")).toBe("−£1,234.01");
  });
  it("handles scientific notation, negative zero and blocked values honestly", () => {
    expect(money("1e-20")).toBe("£0.00");
    expect(money("-0.004")).toBe("£0.00");
    expect(money(null)).toBe("Not calculated");
  });
});

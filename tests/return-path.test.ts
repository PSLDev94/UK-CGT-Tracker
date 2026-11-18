import { describe, expect, it } from "vitest";
import { authHref, safeReturnPath } from "../src/ui/return-path";
describe("workspace return destinations", () => {
  it("preserves the report and trusted billing state", () => {
    const path = "/dashboard/reports?year=2024-25&format=evidence";
    expect(safeReturnPath(path)).toBe(path);
    const cancelled = path + "&checkout=cancelled";
    expect(safeReturnPath(cancelled)).toBe(cancelled);
    const savedImport = "/dashboard/upload?saved=import-id";
    expect(safeReturnPath(savedImport)).toBe(savedImport);
    expect(
      new URL(
        authHref("/account/sign-in?verification=complete", path),
        "https://example.test",
      ).searchParams.get("next"),
    ).toBe(path);
    expect(safeReturnPath("/billing?checkout=returned&ignored=x")).toBe(
      "/billing?checkout=returned",
    );
  });
  it("falls back for destinations outside the application", () => {
    for (const target of [
      null,
      "/api/v2/contact",
      "//elsewhere.test",
      "https://elsewhere.test",
    ])
      expect(safeReturnPath(target)).toBe("/dashboard");
  });
});

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
  it("preserves the saved source position only on receipt and calculation routes", () => {
    const source = "cdebd356-7070-4f24-8167-0d8dc49432cc.5.26";
    for (const path of ["/dashboard/history", "/dashboard/calculations"]) {
      const target = path + "?year=2024-25&source=" + source;
      expect(safeReturnPath(target)).toBe(target);
      expect(safeReturnPath(path + "?source=run.0.-1")).toBe(path);
    }
    expect(safeReturnPath("/billing?source=" + source)).toBe("/billing");
  });
});

import { TAX_YEARS } from "../values";

export type PdfFormat = "summary" | "evidence";
export interface ReportDestination {
  year: string;
  format: PdfFormat;
}

export function reportDestination(
  year: unknown,
  format: unknown,
): ReportDestination | null {
  return typeof year === "string" &&
    Object.hasOwn(TAX_YEARS, year) &&
    (format === "summary" || format === "evidence")
    ? { year, format }
    : null;
}

export function reportUrl(
  destination: ReportDestination,
  outcome?: "cancelled" | "returned" | "portal",
) {
  const query = new URLSearchParams({
    year: destination.year,
    format: destination.format,
  });
  if (outcome) query.set("checkout", outcome);
  return `/dashboard/reports?${query}#report-${destination.format}`;
}

export function billingUrl(destination: ReportDestination) {
  return `/billing?${new URLSearchParams({ year: destination.year, format: destination.format })}`;
}

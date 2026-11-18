import { DashboardShell } from "@/ui/dashboard-shell";
import { RestoredReports } from "@/ui/restored-reports";
import { reportDestination } from "@/domain/reports/destination";
import { TAX_YEARS } from "@/domain/values";

export const metadata = { title: "Reports" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; format?: string; checkout?: string }>;
}) {
  const { year, format, checkout } = await searchParams;
  return (
    <DashboardShell>
      <RestoredReports
        requestedYear={
          typeof year === "string" && Object.hasOwn(TAX_YEARS, year) ? year : ""
        }
        requestedFormat={reportDestination(year, format)?.format}
        outcome={
          checkout === "returned" || checkout === "cancelled" ? checkout : null
        }
      />
    </DashboardShell>
  );
}

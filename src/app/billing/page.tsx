import { BillingPanel } from "@/ui/billing-panel";
import { DashboardShell } from "@/ui/dashboard-shell";
import { reportDestination } from "@/domain/reports/destination";

export const metadata = { title: "Subscription" };
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; format?: string; checkout?: string }>;
}) {
  const params = await searchParams;
  const outcome = params.checkout;
  return (
    <DashboardShell>
      <BillingPanel
        target={reportDestination(params.year, params.format)}
        outcome={
          outcome === "cancelled" ||
          outcome === "returned" ||
          outcome === "portal"
            ? outcome
            : null
        }
      />
    </DashboardShell>
  );
}

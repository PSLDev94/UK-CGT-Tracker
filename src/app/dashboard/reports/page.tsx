import { DashboardShell } from "@/ui/dashboard-shell";
import { RestoredReports } from "@/ui/restored-reports";
export const metadata = { title: "Reports" };
export default function Page() {
  return (
    <DashboardShell>
      <RestoredReports />
    </DashboardShell>
  );
}

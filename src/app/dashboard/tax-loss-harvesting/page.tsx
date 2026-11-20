import { DashboardShell } from "@/ui/dashboard-shell";
import { RestoredHarvesting } from "@/ui/restored-harvesting";
export const metadata = { title: "Tax Loss Harvesting" };
export default function Page() {
  return (
    <DashboardShell>
      <RestoredHarvesting />
    </DashboardShell>
  );
}

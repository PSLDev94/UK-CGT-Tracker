import { DashboardShell } from "@/ui/dashboard-shell";
import { RestoredSettings } from "@/ui/restored-settings";
export const metadata = { title: "Settings" };
export default function Page() {
  return (
    <DashboardShell>
      <RestoredSettings />
    </DashboardShell>
  );
}

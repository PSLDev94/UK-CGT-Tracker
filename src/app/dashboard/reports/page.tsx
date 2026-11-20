import { Suspense } from "react";
import { RestoredReports } from "@/ui/restored-reports";

export const metadata = { title: "Reports" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading reports…</p>}>
      <RestoredReports />
    </Suspense>
  );
}

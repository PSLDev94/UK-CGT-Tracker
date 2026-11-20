import Link from "next/link";
import { WorkspaceScreen } from "@/ui/workspace";
import { DashboardShell } from "@/ui/dashboard-shell";
import { WorkspaceMasthead } from "@/ui/workspace-masthead";
import { ImportHistoryDetail, ReceiptReference } from "@/ui/import-history-detail";
import { TAX_YEARS } from "@/domain/values";
import { calculationSourceHref } from "@/ui/disposal-location";

export const metadata = { title: "Import history" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ receipt?: string; record?: string; year?: string; source?: string }>;
}) {
  const { receipt, record, year, source } = await searchParams;
  if (!receipt) return <WorkspaceScreen initialView="history" />;
  const calculation =
    year && Object.hasOwn(TAX_YEARS, year)
      ? calculationSourceHref(year, source)
      : "/dashboard/calculations";
  return (
    <DashboardShell>
      <div className="space-y-4">
        <Link className="text-blue-700 underline" href={calculation}>
          Back to calculation
        </Link>
        <WorkspaceMasthead title="Import receipt" />
        <ReceiptReference key={receipt} id={receipt} />
        <ImportHistoryDetail
          key={receipt + "/" + record}
          importId={receipt}
          initiallyOpen
          sourceRecord={record && /^[1-9]\d{0,7}$/.test(record) ? Number(record) : undefined}
        />
        <Link className="text-blue-700 underline" href="/dashboard/history">
          View import history
        </Link>
      </div>
    </DashboardShell>
  );
}

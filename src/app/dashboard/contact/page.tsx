import { reportDestination } from "@/domain/reports/destination";
import { ContactForm } from "@/components/contact-form";
import { DashboardShell } from "@/ui/dashboard-shell";
export const metadata = { title: "Contact Us" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; year?: string; format?: string }>;
}) {
  const { topic, year, format } = await searchParams;
  return (
    <DashboardShell>
      <ContactForm
        initialTopic={topic}
        returnReport={reportDestination(year, format)}
        dashboard
      />
    </DashboardShell>
  );
}

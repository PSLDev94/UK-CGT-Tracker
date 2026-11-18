import { ContactForm } from "@/components/contact-form";
import { DashboardShell } from "@/ui/dashboard-shell";
export const metadata = { title: "Contact Us" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  return (
    <DashboardShell>
      <ContactForm initialTopic={topic} dashboard />
    </DashboardShell>
  );
}

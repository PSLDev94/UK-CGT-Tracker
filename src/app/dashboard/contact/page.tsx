import { ContactForm } from "@/components/contact-form";
import { DashboardShell } from "@/ui/dashboard-shell";
export const metadata = { title: "Contact Us" };
export default function Page() {
  return (
    <DashboardShell>
      <ContactForm dashboard />
    </DashboardShell>
  );
}

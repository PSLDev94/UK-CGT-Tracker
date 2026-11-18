import { ContactForm } from "@/components/contact-form";
export const metadata = { title: "Contact Us" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  return (
    <main id="main">
      <ContactForm initialTopic={topic} />
    </main>
  );
}

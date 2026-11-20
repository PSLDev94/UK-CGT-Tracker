import styles from "@/components/public-pages.module.css";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { ContactForm } from "@/components/contact-form";
export const metadata = { title: "Contact Us" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  return (
    <div className={styles.page}>
      <PublicNav />
      <main id="main" tabIndex={-1} className={styles.frame}>
        <ContactForm initialTopic={topic} />
      </main>
      <PublicFooter />
    </div>
  );
}

import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import styles from "@/components/public-pages.module.css";

export const metadata = { title: "Page unavailable" };

export default function NotFound() {
  return (
    <div className={styles.page}>
      <PublicNav />
      <main id="main" tabIndex={-1} className={styles.frame}>
        <h1 className={styles.taskHeading}>This page is unavailable.</h1>
        <p className={styles.intro}>
          This address may have changed. Return to your overview or browse the broker guides.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link className={styles.action} href="/dashboard">Open workspace</Link>
          <Link className={styles.actionSecondary} href="/supported-brokers">Check broker support</Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

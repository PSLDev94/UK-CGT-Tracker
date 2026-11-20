import styles from "@/components/public-pages.module.css";
import Link from "next/link";
import { Metadata } from "next";
import { ReportPricing } from "@/components/report-pricing";
import { PublicFooter } from "@/components/public-footer";
import { PublicNav } from "@/components/public-nav";
import { ANNUAL_REPORT_PRICE } from "@/domain/reports/access";

export const metadata: Metadata = {
  title: `Pricing | ${ANNUAL_REPORT_PRICE} per year`,
  description:
    "Compare free share-gain calculations and CSV evidence with the £49 annual PDF subscription.",
};

export default async function PricingPage() {
  return (
    <div className={styles.page}>
      <PublicNav />
      <main
        id="main"
        tabIndex={-1}
        className={styles.frame}
      >
        <div className={styles.pricingLead}>
          <h1 className={styles.taskHeading}>
            Simple pricing
          </h1>
          <p className={styles.intro}>
            Import and calculate for free. Download PDF reports for {ANNUAL_REPORT_PRICE} per year.
          </p>
        </div>
        <ReportPricing />
        <p className={styles.meta}>
          The subscription renews annually until cancelled. Checkout uses
          Stripe test payments in this preview. PDF access covers reports on
          the records you supply. Arrange independent tax advice separately if you need it.
          {" "}<Link className="text-blue-700 underline" href="/terms">Read the service terms</Link>.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

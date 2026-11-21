import styles from "@/components/public-pages.module.css";
import Link from "next/link";
import { Metadata } from "next";
import { ReportPricing } from "@/components/report-pricing";
import { PublicFooter } from "@/components/public-footer";
import { PublicNav } from "@/components/public-nav";
import { ANNUAL_REPORT_PRICE } from "@/domain/reports/access";
import { publicBillingMode } from "@/server/public-site";

export function generateMetadata(): Metadata {
  if (publicBillingMode() === "unavailable") return {
    title: "Free workspace",
    description: "Import broker trades, calculate share gains and losses, and export your calculation evidence for free.",
  };
  return { title: `Pricing | ${ANNUAL_REPORT_PRICE} per year`,
    description: "Compare free share-gain calculations and CSV evidence with the £49 annual PDF subscription." };
}

export default async function PricingPage() {
  const mode = publicBillingMode();
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
            {mode === "unavailable" ? "Import your trades, calculate gains and losses, and download CSV evidence for free."
              : <>Import and calculate for free. Download PDF reports for {ANNUAL_REPORT_PRICE} per year.</>}
          </p>
        </div>
        <ReportPricing mode={mode} />
        <p className={styles.meta}>
          {mode !== "unavailable" && "The subscription renews annually until cancelled. "}
          {mode === "preview" && "Checkout uses Stripe test payments in this preview. "}
          {mode === "live" && "Stripe handles payments and subscription management. "}
          {mode === "unavailable" ? "Calculations cover the trading records you supply." : "PDF access covers reports on the records you supply."}
          {" "}Arrange independent tax advice separately if you need it.
          {" "}<Link className="text-blue-700 underline" href="/terms">Read the service terms</Link>.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

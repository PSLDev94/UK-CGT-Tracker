import styles from "@/components/public-pages.module.css";
import Link from "next/link";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { contractTitle, subscriptionTerms } from "@/domain/reports/subscription-terms";
import { isProductionSite, productionTrader, publicBillingMode } from "@/server/public-site";

export const metadata = { title: "Service terms" };

export default function Terms() {
  const trader = productionTrader();
  const production = isProductionSite();
  return (
    <div className={styles.page}>
      <PublicNav />
      <main
        id="main"
        tabIndex={-1}
        className={`${styles.frame} ${styles.legal}`}
      >
        <h1 className={styles.articleTitle}>
          Service information
        </h1>
        {production ? (
          <>
            {publicBillingMode() === "unavailable" && <>
              <h2 className="text-xl font-semibold text-gray-900">Your free workspace</h2>
              <p>Import supported broker files, calculate gains and losses on ordinary shares and download the evidence as a CSV. New PDF subscriptions are currently unavailable.</p>
              <p>Check your trades, costs and account history against your broker statements. The calculation covers the records you supply. A qualified tax adviser can help with your personal tax liability and filing obligations.</p>
            </>}
            {trader && <>
              <p>{contractTitle}</p>
              {subscriptionTerms(trader).map(({ heading, text }) => (
                <section key={heading}>
                  <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
                  <p className="whitespace-pre-line">{text}</p>
                </section>
              ))}
              <p>We email your purchase terms when your first invoice is paid. You can also save your invoice through Manage subscription in Billing.</p>
            </>}
            <p><a className="text-blue-600 underline" href="mailto:support@cgttracker.com">Email PSL Digital support</a>
              {" · "}<Link className="text-blue-600 underline" href="/supported-brokers">Supported layouts and limitations</Link>
              {" · "}<Link className="text-blue-600 underline" href="/privacy">Read about your data</Link></p>
          </>
        ) : <PreviewTerms />}
      </main>
      <PublicFooter />
    </div>
  );
}

function PreviewTerms() {
  return (
    <>
      <p>
        CGT Tracker is operated by PSL Digital. Support:{" "}
        <a
          className="text-blue-600 underline"
          href="mailto:support@cgttracker.com"
        >
          support@cgttracker.com
        </a>
        .
      </p>
      <div className={styles.referenceBox}>
        <strong>Review version — sandbox payments only</strong>
        <p>
          No live payments are enabled. Production terms, consumer
          cancellation information and required business disclosures will be
          finalised before customers can subscribe.
        </p>
      </div>
      <h2 className="text-xl font-semibold text-gray-900">
        What this version provides
      </h2>
      <p>
        Import review, ordinary-share matching across taxable general
        investment accounts, saved calculations and downloadable evidence. It
        calculates gains and losses, not your full personal tax liability.
        Funds, ETFs, corporate actions, employee shares, derivatives, crypto
        and specialist residency cases require additional handling.
      </p>
      <p>
        Check complete acquisition history, all taxable accounts and the
        30-day period after the tax year. Use the calculation only for shares owned by one individual in the same capacity while UK resident throughout the relevant history. A change of residence, a short sale or a disposal before 6 April 2008 may require specialist review. Unsupported or conflicting records
        block an import. A successful import does not prove that the broker
        export contains every relevant transaction. See{" "}
        <Link className="text-blue-600 underline" href="/supported-brokers">
          supported layouts and limitations
        </Link>
        .
      </p>
      <h2 className="text-xl font-semibold text-gray-900">
        Price and billing
      </h2>
      <p>
        The intended subscription price is £49 per year. PSL Digital is not
        VAT-registered; no VAT is added. Stripe hosts checkout and
        subscription management. In this preview these operate in the sandbox,
        with no real charges.
      </p>
      <p>
        PDF reports require an active subscription entitlement. CSV
        calculation evidence and saved investment records remain accessible
        without a subscription. Manage renewal and cancellation through the
        billing portal. The plan renews annually until cancelled. Check the end date shown in Billing after cancellation. If you need help with renewal, a refund or a disputed charge, contact support@cgttracker.com with your invoice reference. Cancellation stops future renewal and does not delete
        your investment records.
      </p>
      <h2 className="text-xl font-semibold text-gray-900">
        Reports and support
      </h2>
      <p>
        The reports explain gains and losses on the records you supplied.
        Reconcile all taxable accounts, trade dates, allowable fees and later
        repurchases with your statements. A qualified UK tax adviser can
        review an uncertain valuation, relief or filing obligation. The
        subscription covers PDF access. It does not include personal tax
        advice, preparation of your return or submission to HMRC.
      </p>
      <p>
        If a figure appears wrong, contact <Link className="text-blue-600 underline" href="/contact">support</Link> with the
        calculation reference and the affected date. Keep sensitive financial
        records out of your first message. You keep your statutory consumer
        rights, including the right to a service supplied with reasonable
        care and skill.
      </p>
      <p>
        <Link className="text-blue-600 underline" href="/privacy">
          Read about your data
        </Link>
        .
      </p>
    </>
  );
}

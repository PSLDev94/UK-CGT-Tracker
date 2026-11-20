import type { Metadata } from "next";
import { Brand } from "@/ui/brand";
import Link from "next/link";
import { PublicFooter } from "@/components/public-footer";
import { BROKERS, IMPORT_PATH_LABEL } from "@/domain/imports/brokers";
import { ANNUAL_REPORT_PRICE } from "@/domain/reports/access";
import { samplePreview } from "@/domain/reports/sample-view";
import { hasPublicSession } from "@/server/public-session";
import { HomeMenu, TradeSelector } from "@/ui/trade-records";
import styles from "@/ui/trade-records.module.css";

export const metadata: Metadata = {
  title: "UK CGT Calculator for Shares | CGT Tracker",
  description:
    "Calculate gains and losses on ordinary shares across taxable broker accounts. Review supported broker CSVs and trace the same-day, 30-day and Section 104 purchases behind each sale.",
  alternates: { canonical: "https://www.cgttracker.com/" },
};

const application = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CGT Tracker",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "UK ordinary-share gains and losses for self-directed investors. Applies HMRC Section 104 pooling, same-day and 30-day share matching rules.",
  url: "https://www.cgttracker.com",
};

export default async function LandingPage() {
  const signedIn = await hasPublicSession();
  const model = samplePreview();
  const brokers = BROKERS.toSorted((a, b) =>
    a.name.localeCompare(b.name, "en-GB"),
  );
  // Lead with the repurchase to show why the original pool cost sometimes stays unused.
  const sales = model.sales.toSorted(
    (a, b) => Number(b.id === "tesla") - Number(a.id === "tesla"),
  );

  return (
    <div className={styles.trades}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(application) }}
      />
      <header className={styles.mast}>
        <div className={`${styles.frame} ${styles.mastInner}`}>
          <Brand />
          <nav aria-label="Main navigation" className={styles.mainNav}>
            <div className={styles.desktopLinks}>
              <a href="#brokers">Brokers</a>
              <a href="/samples/cgt-evidence.pdf">Sample report</a>
              <Link href="/guide">CGT guide</Link>
              <Link href="/pricing">Pricing</Link>
            </div>
            <Link
              href={signedIn ? "/dashboard" : "/login"}
              className={styles.login}
            >
              {signedIn ? "My workspace" : "Sign in"}
            </Link>
            <HomeMenu />
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <section className={styles.exchange} aria-labelledby="cover-title">
          <div className={styles.exchangeInside}>
            <div className={styles.exchangeIntro}>
              <h1 id="cover-title">Which purchase counts?</h1>
              <p className={styles.introCopy}>
                Calculate UK capital gains on shares from your broker CSV. See
                which purchases and fees count towards each sale.
              </p>
              <Link
                className={styles.openAccount}
                href={signedIn ? "/dashboard" : "/signup"}
              >
                {signedIn ? "Open my workspace" : "Calculate my gains"}{" "}
                <span aria-hidden="true">→</span>
              </Link>
              <p className={styles.introTerms}>
                Free to calculate and export a CSV.
              </p>
            </div>
            <TradeSelector
              sales={sales}
              year={model.year}
              broker={model.broker}
            />
          </div>
        </section>

        <section
          id="pricing"
          className={styles.yearAccount}
          aria-labelledby="year-title"
        >
          <div className={styles.yearInner}>
            <div className={styles.yearCopy}>
              <h2 id="year-title">All three sales, one tax year.</h2>
              <p>
                The annual statement brings the trades together and includes the
                records behind each match. Printable reports are included in{" "}
                <Link href="/pricing">
                  the {ANNUAL_REPORT_PRICE} annual plan
                </Link>
                .
              </p>
              <div className={styles.yearLinks}>
                <a
                  className={styles.annualLink}
                  href="/samples/cgt-evidence.pdf"
                >
                  Read the sample PDF <span aria-hidden="true">↗</span>
                </a>
                <a
                  className={styles.annualLink}
                  href="/samples/cgt-summary.pdf"
                  download
                >
                  Download the summary PDF <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>
            <div className={styles.yearResult}>
              <div className={styles.yearLead}>
                <p>{model.year} · Illustrative account</p>
                <strong>{model.net}</strong>
                <span>Net capital gain before allowances</span>
              </div>
              <dl className={styles.yearBreakdown}>
                <div>
                  <dt>Capital gains</dt>
                  <dd>{model.gains}</dd>
                </div>
                <div>
                  <dt>Capital losses</dt>
                  <dd>{model.losses}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section
          id="brokers"
          className={styles.directory}
          aria-labelledby="broker-title"
        >
          <div className={`${styles.frame} ${styles.directoryGrid}`}>
            <div>
              <h2 id="broker-title">Broker imports</h2>
              <p>
                Choose your broker for export instructions and details of any
                records you’ll need.
              </p>
              <Link href="/supported-brokers" className={styles.annualLink}>
                Check my broker <span aria-hidden="true">→</span>
              </Link>
              <details id="faq" className={styles.scope}>
                <summary>What the calculation covers</summary>
                <p>
                  Include ordinary shares from all your taxable broker accounts.
                  Funds, ETFs, bonds, derivatives, crypto and corporate actions
                  are outside the supported scope.
                </p>
                <p>
                  Check your dates, quantities and costs against the original
                  records. A qualified tax adviser can help with reliefs,
                  special valuations and your wider tax position.
                </p>
              </details>
            </div>
            <ul>
              {brokers.map((broker) => (
                <li key={broker.id}>
                  <Link href={`/supported-brokers#${broker.id}`}>
                    <strong>{broker.name}</strong>
                    <span className={styles.method}>
                      {IMPORT_PATH_LABEL[broker.id]}
                    </span>
                    <span className={styles.directoryArrow} aria-hidden="true">
                      ↗
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

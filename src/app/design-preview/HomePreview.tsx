import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown, FileText } from "lucide-react";
import { BROKERS, IMPORT_PATH_LABEL } from "@/domain/imports/brokers";
import { ANNUAL_REPORT_PRICE } from "@/domain/reports/access";
import { hasPublicSession } from "@/server/public-session";
import type { PreviewModel } from "./preview-model";
import styles from "./home.module.css";

function SaleCosts({ sale, showRule }: { sale: PreviewModel["sales"][number]; showRule?: boolean }) {
  return (
    <>
      <div><dt>Gross proceeds</dt><dd>{sale.gross}</dd></div>
      <div><dt>Matched purchase cost{showRule && <><br /><span>{sale.rule}</span></>}</dt><dd>{sale.cost}</dd></div>
      <div><dt>Selling costs</dt><dd>{sale.fee}</dd></div>
    </>
  );
}

export default async function HomePreview({ model }: { model: PreviewModel }) {
  const signedIn = await hasPublicSession();
  const apple = model.sales.find((sale) => sale.id === "apple")!;

  return (
    <main id="main" tabIndex={-1} className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-heading">
        <div className={styles.heroFrame}>
          <div className={styles.introduction}>
            <h1 id="home-heading">What did you gain on your share sales?</h1>
            <p>Bring your taxable broker accounts together. See which purchases matched each sale and how the fees affected your gain or loss.</p>
            <div className={styles.actions}>
              <Link className={styles.primary} href={signedIn ? "/dashboard" : "/signup"}>
                {signedIn ? "Open my workspace" : "Create a free account"} <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <a className={styles.secondary} href="#broker-exports">Check my broker</a>
            </div>
          </div>

          <article className={styles.statement} aria-labelledby="home-sample-title">
            <div className={styles.statementHeader}>
              <span>Illustrative sale</span>
              <span>Tax year {model.year}</span>
            </div>
            <div className={styles.statementBody}>
              <h2 id="home-sample-title">{apple.name}</h2>
              <p className={styles.meta}>{apple.qty} shares sold <span aria-hidden="true">·</span> {apple.date}</p>
              <dl className={`${styles.ledger} ${styles.desktopLedger}`}>
                <SaleCosts sale={apple} showRule />
                <div className={styles.result}><dt>Gain on this sale</dt><dd>{apple.result}</dd></div>
              </dl>
              <div className={styles.mobileLedger}>
                <dl className={styles.ledger}>
                  <div className={styles.result}><dt>Gain on this sale</dt><dd>{apple.result}</dd></div>
                </dl>
                <p className={styles.rule}>{apple.rule}</p>
                <details>
                  <summary>Cost breakdown <ChevronDown aria-hidden="true" size={15} /></summary>
                  <dl className={styles.ledger}>
                    <SaleCosts sale={apple} />
                    <div className={styles.costTotal}><dt>Total allowable costs</dt><dd>{apple.totalCost}</dd></div>
                  </dl>
                </details>
              </div>
            </div>
            <Link className={styles.trace} href="/design-preview/calculations#apple">
              See how this sale was matched <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </article>
        </div>
      </section>

      <section className={styles.directory} id="broker-exports" aria-labelledby="broker-heading">
        <div>
          <h2 id="broker-heading">Start with your broker’s export</h2>
          <p>Choose your broker to see the CSV to download and any contract notes you’ll need.</p>
        </div>
        <ul className={styles.brokers}>
          {BROKERS.map((broker) => (
            <li key={broker.id}>
              <Link href={`/supported-brokers#${broker.id}`}>
                <span><strong>{broker.name}</strong><small>{IMPORT_PATH_LABEL[broker.id]}</small></span>
                <ArrowUpRight aria-hidden="true" size={17} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.reportSection} aria-labelledby="report-heading">
        <div className={styles.reportFrame}>
          <div>
            <h2 id="report-heading">Take the working with you</h2>
            <p>Use the free CSV to check the trades yourself. The {ANNUAL_REPORT_PRICE} annual plan adds printable reports with the figures and matching records to share with your accountant.</p>
            <a className={styles.reportLink} href="/design-preview/report.pdf">
              <FileText aria-hidden="true" size={17} /> Open the sample PDF <ArrowRight aria-hidden="true" size={16} />
            </a>
          </div>
          <div className={styles.reportExcerpt}>
            <h3>Sample annual calculation <span>{model.year}</span></h3>
            <dl>
              <div><dt>Gains</dt><dd>{model.gains}</dd></div>
              <div><dt>Losses</dt><dd>{model.losses}</dd></div>
              <div><dt>Net gain before allowances</dt><dd>{model.net}</dd></div>
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}

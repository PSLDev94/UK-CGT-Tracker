import Link from "next/link";
import { Header } from "@/ui/header";

export default function Home() {
  return (
    <>
      <Header />
      <main id="main" className="public-main">
        <section className="hero">
          <div>
            <span className="eyebrow">
              A clearer view of your UK share gains
            </span>
            <h1>
              Know how your
              <br />
              gains add up.
            </h1>
            <p className="lead">
              Bring your taxable accounts together. Review the records. Follow
              each disposal back to the shares that were bought.
            </p>
            <div className="actions">
              <Link className="button primary" href="/workspace">
                Open your workspace <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/supported-brokers">Check broker support</Link>
            </div>
            <p className="caption">
              A preview for testing. Native broker exports and final tax reports
              are still being verified.
            </p>
          </div>
          <div
            className="hero-ledger"
            aria-label="Illustrative share matching example"
          >
            <div className="ledger-heading">
              <span>SHARE GAINS</span>
              <span className="tag">Illustrative example</span>
            </div>
            <div className="example-result">
              <span>2024–25 · Net gain</span>
              <strong>£391.00</strong>
              <p>One disposal. A clear trail back to its cost.</p>
            </div>
            <div className="example-equation">
              <div>
                <span>Sale proceeds</span>
                <strong>£795.00</strong>
              </div>
              <span aria-hidden="true">−</span>
              <div>
                <span>Allowable cost</span>
                <strong>£404.00</strong>
              </div>
            </div>
            <div className="example-match">
              <span className="match-line" aria-hidden="true"></span>
              <div>
                <strong>50 shares matched</strong>
                <span>Section 104 pool · £8.08 per share</span>
              </div>
              <span className="tag">Traceable</span>
            </div>
            <div className="ledger-footnote">
              Every result starts with the records you review.
              <br />
              Example only. Gains shown before personal allowances.
            </div>
          </div>
        </section>
        <section className="principles" aria-labelledby="principles-title">
          <h2 id="principles-title">A clearer record of what happened.</h2>
          <div className="three-columns">
            <article>
              <span className="eyebrow">Before you save</span>
              <h3>Nothing ambiguous slips through.</h3>
              <p>
                Unrecognised formats and conflicting records stay in review. You
                see the reason and can correct the source file.
              </p>
            </article>
            <article>
              <span className="eyebrow">Across your accounts</span>
              <h3>One taxpayer. One shared history.</h3>
              <p>
                Taxable accounts are combined for matching. ISA and pension
                records stay outside this workspace.
              </p>
            </article>
            <article>
              <span className="eyebrow">When things change</span>
              <h3>Corrections keep their context.</h3>
              <p>
                Reverse an import and recalculate. Previous calculation
                snapshots remain part of the record.
              </p>
            </article>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <span>CGT Tracker · Built for UK investors</span>
        <Link href="/supported-brokers">Current scope and limitations</Link>
      </footer>
    </>
  );
}

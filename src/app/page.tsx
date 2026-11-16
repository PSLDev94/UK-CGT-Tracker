import Link from "next/link";
import { Header } from "@/ui/header";

export default function Home() {
  return (
    <>
      <Header />
      <main id="main" className="public-main">
        <section className="hero">
          <div>
            <span className="eyebrow">UK share gains · Relaunch preview</span>
            <h1>
              Know how your
              <br />
              share gains add up.
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
            aria-label="Illustrative review workflow"
          >
            <div className="ledger-heading">
              <span>From records to a traceable result</span>
              <span className="tag">How it works</span>
            </div>
            <ol className="process">
              <li>
                <span className="step-number">1</span>
                <div>
                  <h2>Bring in your records</h2>
                  <p>Keep each broker account identifiable.</p>
                </div>
              </li>
              <li>
                <span className="step-number">2</span>
                <div>
                  <h2>Account for every row</h2>
                  <p>Included, excluded, duplicate or unresolved.</p>
                  <div className="reconciliation-demo">
                    <span>Included</span>
                    <span>Excluded</span>
                    <span>Duplicate</span>
                    <span>Review</span>
                  </div>
                </div>
              </li>
              <li>
                <span className="step-number">3</span>
                <div>
                  <h2>See the matching evidence</h2>
                  <p>Same-day, 30-day and Section 104 matches.</p>
                </div>
              </li>
            </ol>
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

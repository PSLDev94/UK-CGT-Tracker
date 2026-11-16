import Link from "next/link";
import { Header } from "@/ui/header";
import { BROKERS } from "@/domain/imports/brokers";
import { NATIVE_GUIDANCE } from "@/domain/imports/native";

export default function BrokerSupport() {
  return (
    <>
      <Header />
      <main id="main" className="public-main">
        <section className="principles">
          <span className="eyebrow">Support you can verify</span>
          <h1>Know what your file can tell us.</h1>
          <p className="lead">
            These six brokers are in the relaunch scope. Selected Trading 212
            and Freetrade GBP layouts are available for preview testing. General
            broker certification is still pending; unknown records block saving.
          </p>
          <div className="broker-grid">
            {BROKERS.map((b) => (
              <article className="panel" key={b.id}>
                <h2>{b.name}</h2>
                <span className="tag">
                  {b.id === "freetrade" || b.id === "trading212"
                    ? "Limited GBP preview"
                    : "Native CSV verification pending"}
                </span>
                <p className="muted">{NATIVE_GUIDANCE[b.id]}</p>
              </article>
            ))}
          </div>
          <section className="panel" style={{ marginTop: "2rem" }}>
            <h2>Use the explicit CSV template for testing.</h2>
            <p>
              For ordinary shares in taxable general investment accounts.
              Provide stable transaction IDs, valid ISINs, execution dates,
              quantities and explicit GBP exchange rates. Consideration is the
              gross trade amount before fees; fees are entered separately.
            </p>
            <Link
              className="button secondary"
              href="/templates/cgt-trades.csv"
              download
            >
              Download CSV template
            </Link>
            <details>
              <summary>Template fields and supported scope</summary>
              <p>
                Dates use YYYY-MM-DD. Trade types are BUY or SELL. Asset type
                must be ORDINARY_SHARE. Currency uses ISO major units (GBP, not
                GBX). GBP per unit is the number of pounds per one unit of the
                source currency; use 1 for GBP.
              </p>
              <p>
                CASH_DEPOSIT, CASH_WITHDRAWAL, CASH_DIVIDEND and CASH_INTEREST
                are counted and excluded from share gains. Corporate actions,
                transfers, reinvestments, funds, ETFs, derivatives, crypto and
                pre-April-1982 transactions require additional handling. Do not
                relabel them to force an import.
              </p>
              <p>
                Import complete acquisition history across all your taxable
                accounts. The calculation needs the 30 days after the end of the
                tax year to finish look-ahead matching. A complete result is not
                a personal tax-liability calculation or HMRC approval.
              </p>
            </details>
          </section>
        </section>
      </main>
    </>
  );
}

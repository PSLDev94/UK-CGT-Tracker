import Link from "next/link";
import { Header } from "@/ui/header";
import { BROKERS } from "@/domain/imports/brokers";
import { IBKR_HEADERS } from "@/domain/imports/additional-brokers";
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
            Import documented layouts from all six brokers. Trading 212 and
            Freetrade GBP trades can be read automatically; other layouts may
            require verified details from contract notes. These readers are
            tested with synthetic examples, not certified against every broker
            export. Unknown records block saving.
          </p>
          <div className="broker-grid">
            {BROKERS.map((b) => (
              <article className="panel" key={b.id}>
                <h2>{b.name}</h2>
                <span className="tag">
                  {b.id === "freetrade" || b.id === "trading212"
                    ? "Automatic + assisted"
                    : b.id === "ibkr"
                      ? "Execution Flex CSV"
                      : "Assisted import"}
                </span>
                <p className="muted">{NATIVE_GUIDANCE[b.id]}</p>
              </article>
            ))}
          </div>
          <section className="panel mt-8">
            <h2>Interactive Brokers Flex setup</h2>
            <p>
              Use an Activity Flex Query with Trades at execution level, one
              taxable account, CSV output and trade dates in YYYY-MM-DD or
              YYYYMMDD. Select these fields (any order):
            </p>
            <p className="text-sm break-words">{IBKR_HEADERS.join(", ")}</p>
            <p>
              For foreign trades, verify the statement base currency is GBP and
              supply the trade-date conversion shown in the file. Reconcile
              transfers and corporate actions separately; an execution-only
              export cannot establish complete acquisition history by itself.
            </p>
          </section>
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

import Link from "next/link";
import { PublicFooter } from "@/components/public-footer";
import { safeReturnPath } from "@/ui/return-path";
import { Header } from "@/ui/header";
import {
  BROKERS,
  IMPORT_PATH_LABEL,
  type BrokerId,
} from "@/domain/imports/brokers";
import { IBKR_HEADERS } from "@/domain/imports/additional-brokers";
import { NATIVE_GUIDANCE } from "@/domain/imports/native";

export const metadata = { title: "Supported brokers and CSV exports" };

const FILE_EXAMPLES: Record<
  BrokerId,
  { name: string; download: string; check: string; example: string }
> = {
  trading212: {
    name: "Invest History CSV",
    download:
      "In your Invest account, open History and choose Export. Select all activity categories and download each period needed for your history.",
    example:
      "A Market buy with a GBP price, ISIN and matching GBP total can be included once you confirm the instrument is an ordinary share. A cash interest row is counted separately.",
    check:
      "A Buy or Sell row includes Action, Time, ISIN, share quantity and trade amounts. Export all activity categories.",
  },
  freetrade: {
    name: "Activity Feed CSV",
    download:
      "In the app, open Activity, tap the download arrow and select All Activity. Upload the original, unfiltered CSV.",
    example:
      "An ORDER with Buy / Sell set to BUY, a GBP total and reconciled stamp duty can be included. A foreign trade with an unresolved conversion stays in review.",
    check:
      "Look for the Order ID, Buy / Sell, ISIN and account-currency amounts in the same row. Keep the fee and FX columns.",
  },
  hl: {
    name: "Transaction Summary CSV",
    download:
      "Open your Fund and Share Account, select capital account transactions, set the date range and download the transaction CSV.",
    example:
      "For a purchase of 1,000 shares at a unit cost of 50p, use the contract note to verify the ISIN, units and dealing costs before saving.",
    check:
      "Keep the trade rows beneath the statement header. Use each contract note to verify the ISIN, price units and costs.",
  },
  ii: {
    name: "Trading account transactions CSV",
    download:
      "On the ii website, open Portfolio, then Transaction history. Choose your Trading Account and dates, submit the range and use the download menu to select CSV.",
    example:
      "A purchase with a SEDOL and a debit needs its contract note to confirm which ordinary share was bought, which currency paid for it and what the fees were.",
    check:
      "Keep the settlement amount and currency details. Have the contract note available to identify the security and wallet.",
  },
  ibkr: {
    name: "Activity Flex Query CSV",
    download:
      "In Client Portal, open Performance & Reports, then Flex Queries. Create an Activity Flex Query for Trades, choose CSV and run it for the account and dates you need.",
    example:
      "An EXECUTION row with STK, a TradeID, an ISIN and reconciled GBP proceeds and commission can be included. General statement sections stay blocked.",
    check:
      "Select Trades at execution level. An Activity Statement or Transaction History file uses a different layout.",
  },
  ajbell: {
    name: "Dealing account Transaction history CSV",
    download:
      "In My account, open Documents and statements, then Transaction history. Choose your Dealing account and full date range, then download as CSV.",
    example:
      "A Purchase row with Amount (GBP) needs an ISIN, the trade’s execution reference and verified costs from its contract note.",
    check:
      "Keep the Date, Description, Transaction, Quantity, Price and Amount (GBP) columns. Have a contract note reference for each execution.",
  },
};

export default async function BrokerSupport({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;
  const destination = safeReturnPath(typeof from === "string" ? from : undefined);
  const backToUpload = destination.split("?")[0] === "/dashboard/upload" ? destination : undefined;
  return (
    <>
      <Header backToUpload={backToUpload} />
      <main id="main" tabIndex={-1} className="public-main broker-directory">
        <section className="principles">
          <h1>Find your broker’s CSV export</h1>
          <p className="lead">
            Choose your broker for export instructions and the records you need.
          </p>
          <nav
            aria-label="Jump to broker"
            className="mb-6 flex flex-wrap gap-x-5 gap-y-1"
          >
            {BROKERS.map((broker) => (
              <a
                key={broker.id}
                href={`#${broker.id}`}
                className="py-2 font-medium text-blue-700 underline"
              >
                {broker.name}
              </a>
            ))}
          </nav>
          <p className="mb-6 max-w-prose">
            Use the full history for ordinary shares in taxable accounts,
            including earlier purchases and the 30 days after the reporting
            year. Keep all activity rows in the original export.
            Trading 212 and Freetrade GBP trades can be read automatically. Other
            formats may need contract notes. The examples use synthetic trades.
            Unknown records block saving. ISA and pension accounts are outside scope.
          </p>
          <div className="broker-grid">
            {BROKERS.map((b) => (
              <article id={b.id} className="panel scroll-mt-20" key={b.id}>
                <h2>{b.name}</h2>
                <span className="tag">{IMPORT_PATH_LABEL[b.id]}</span>
                <h3 className="mt-4 font-semibold">
                  {FILE_EXAMPLES[b.id].name}
                </h3>
                <p>{FILE_EXAMPLES[b.id].download}</p>
                <details>
                  <summary>Accepted layouts and limits</summary>
                  <p>{FILE_EXAMPLES[b.id].check}</p>
                  <p>{NATIVE_GUIDANCE[b.id]}</p>
                  <p>
                    <strong>Example review.</strong>{" "}
                    {FILE_EXAMPLES[b.id].example}
                  </p>
                  {b.id === "ibkr" && (
                    <a href="#flex-fields" className="underline">
                      View required Flex fields
                    </a>
                  )}
                </details>
              </article>
            ))}
          </div>
          <section id="flex-fields" className="panel mt-8 scroll-mt-20">
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
          <section id="template" className="panel mt-8 scroll-mt-20">
            <h2>CGT Tracker CSV template</h2>
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
      <PublicFooter />
    </>
  );
}

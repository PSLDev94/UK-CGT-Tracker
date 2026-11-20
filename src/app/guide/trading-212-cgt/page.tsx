import styles from "@/components/public-pages.module.css";
import Link from "next/link";
import { Metadata } from "next";
import { GuideLayout } from "@/components/guide-layout";

export const metadata: Metadata = {
  title: "How to Calculate CGT on Trading 212 UK — Step by Step",
  description:
    "How to export your Trading 212 transaction history and calculate your capital gains tax. Selected GBP ordinary-share exports are available for preview testing.",
  alternates: { canonical: "https://www.cgttracker.com/guide/trading-212-cgt" },
};

export default function Trading212CGTPage() {
  return (
    <GuideLayout
      slug="trading-212-cgt"
      edition="Trading 212 Invest accounts"
      nextStep={{ href: "/supported-brokers#trading212", title: "Check my Trading 212 export" }}
      title="How to Calculate CGT on Trading 212 UK — Step by Step"
      breadcrumb="Trading 212 CGT"
      relatedGuides={[
        {
          href: "/guide/hargreaves-lansdown-cgt",
          title: "Hargreaves Lansdown CGT Guide",
        },
        { href: "/guide/freetrade-cgt", title: "Freetrade CGT Guide" },
        {
          href: "/guide/section-104-pool",
          title: "What is a Section 104 Pool?",
        },
      ]}
    >
      <p>
        Use the Invest history CSV for ordinary shares in your taxable account.
        This guide explains which dates and activity to export and what to
        check in the preview.
      </p>

      <h2>Step 1: Export Your Transaction History</h2>
      <ol>
        <li>Open the menu in your Trading 212 Invest account.</li>
        <li>
          Choose <strong>History</strong> and select the export button.
        </li>
        <li>
          Select all activity categories. Export the history of your holding
          from the first purchase through 30 days after the end of the tax year.
          Download consecutive periods if the history spans several files.
        </li>
        <li>Upload each original, unfiltered CSV to CGT Tracker.</li>
      </ol>
      <p>
        For 2025–26, report sales from 6 April 2025 to 5 April 2026. Earlier
        purchases establish the cost of your holding. Include activity through
        5 May 2026 so a 5 April sale can match a 20 April repurchase.{" "}
        <a href="https://helpcentre.trading212.com/hc/en-us/articles/360016898917-Can-I-export-the-trading-data-from-my-account">
          Trading 212’s export instructions
        </a>
        .
      </p>

      <h2>Step 2: Understanding the CSV Format</h2>
      <p>The Trading 212 CSV typically contains the following columns:</p>
      <div
        className="overflow-x-auto my-6 not-prose"
        tabIndex={0}
        role="region"
        aria-label="Worked example"
      >
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-2 font-semibold text-gray-700">
                Column
              </th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="px-4 py-2 font-medium">Action</td>
              <td className="px-4 py-2">
                &ldquo;Market buy&rdquo;, &ldquo;Market sell&rdquo;,
                &ldquo;Limit buy&rdquo;, &ldquo;Limit sell&rdquo;,
                &ldquo;Dividend (Ordinary)&rdquo;, etc.
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Time</td>
              <td className="px-4 py-2">
                The date and time of the transaction (e.g., &ldquo;2025-06-15
                09:30:22&rdquo;)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Ticker</td>
              <td className="px-4 py-2">
                The stock ticker symbol (e.g., &ldquo;TSCO&rdquo;,
                &ldquo;LLOY&rdquo;)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">No. of shares</td>
              <td className="px-4 py-2">Number of shares bought or sold</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Price / share</td>
              <td className="px-4 py-2">
                Price per share in the currency of the exchange
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Total</td>
              <td className="px-4 py-2">
                Total value of the transaction in your account currency (GBP)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">
                Currency (Price / share)
              </td>
              <td className="px-4 py-2">
                The currency the share is priced in (GBP, USD, EUR, etc.)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Exchange rate</td>
              <td className="px-4 py-2">
                If foreign, the FX rate used to convert to GBP
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Step 3: Key Things to Watch For</h2>

      <h3>Transaction Type Detection</h3>
      <p>
        Trading 212 uses phrases like &ldquo;Market buy&rdquo; and &ldquo;Market
        sell&rdquo; rather than simple &ldquo;BUY&rdquo;/&ldquo;SELL&rdquo;
        labels. In the preview you can see which trades were recognised and
        which cash dividends were counted separately. Leave all rows in the file.
      </p>

      <h3>Foreign Currency Transactions</h3>
      <p>
        If you buy US shares on Trading 212 (e.g., AAPL, TSLA), the price per
        share will be in USD. For CGT purposes, HMRC requires all calculations
        to be in GBP. Trading 212 provides an exchange rate column — the
        &ldquo;Total&rdquo; column is usually already converted to GBP. For a supported Invest CSV, verify the exchange rate and any separate
        dealing costs against your records. CGT Tracker checks the GBP total
        and keeps the row in review if the amounts do not reconcile.
      </p>

      <h3>Fractional Shares</h3>
      <p>
        Trading 212 supports fractional share trading. You might see quantities
        like &ldquo;0.5&rdquo; or &ldquo;2.347&rdquo;. These are valid and
        should be included in your CGT calculation exactly as reported.
      </p>

      <h3>Stock Splits and Corporate Actions</h3>
      <p>
        Keep stock splits and other corporate actions in the export. If one
        blocks saving, compare the event and the resulting share count with your
        broker statement and follow the instructions in the preview.
      </p>

      <h2>Common Mistakes</h2>
      <ul>
        <li>
          <strong>Including ISA transactions:</strong> If you have both a GIA
          and an ISA on Trading 212, make sure you only export the GIA
          transactions. ISA gains are tax-free.
        </li>
        <li>
          <strong>Removing dividend rows.</strong> Upload the original file.
          The preview distinguishes cash income from share trades.
        </li>
        <li>
          <strong>Exporting only the reporting year.</strong> A sale can use
          the cost of an earlier purchase or match a purchase after 5 April.
        </li>
        <li>
          <strong>Reinvested dividends.</strong> Keep the original entry
          and any associated purchase for review. Check the broker statement
          before confirming that your acquisition history is complete.
        </li>
      </ul>

      <div className={`${styles.referenceBox} my-8 not-prose`}>
        <p className="text-sm text-green-900">
          <strong>Skip the manual work:</strong> Selected Trading 212 GBP
          ordinary-share layouts can be reviewed in the preview. Unsupported
          records block saving. Reviewed transactions use{" "}
          <Link
            href="/guide/bed-and-breakfast-rule"
            className="underline font-medium"
          >
            same-day and 30-day matching
          </Link>
          , Section 104 pooling, and calculation evidence for supported layouts.
          The CSV and PDF evidence show gains and losses on the trades you imported.
        </p>
      </div>
    </GuideLayout>
  );
}

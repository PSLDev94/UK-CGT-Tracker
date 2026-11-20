import styles from "@/components/public-pages.module.css";
import Link from "next/link";
import { Metadata } from "next";
import { GuideLayout } from "@/components/guide-layout";

export const metadata: Metadata = {
  title: "Freetrade Capital Gains Tax Guide for UK Investors",
  description:
    "How to calculate your capital gains tax from Freetrade trades. Step-by-step guide to exporting your CSV and applying HMRC rules.",
  alternates: { canonical: "https://www.cgttracker.com/guide/freetrade-cgt" },
};

export default function FreetradeCGTPage() {
  return (
    <GuideLayout
      slug="freetrade-cgt"
      edition="Freetrade general investment accounts"
      nextStep={{ href: "/supported-brokers#freetrade", title: "Check my Freetrade export" }}
      title="Freetrade Capital Gains Tax Guide for UK Investors"
      breadcrumb="Freetrade CGT"
      relatedGuides={[
        { href: "/guide/trading-212-cgt", title: "Trading 212 CGT Guide" },
        {
          href: "/guide/hargreaves-lansdown-cgt",
          title: "Hargreaves Lansdown CGT Guide",
        },
        {
          href: "/guide/section-104-pool",
          title: "What is a Section 104 Pool?",
        },
      ]}
    >
      <p>
        Use the Activity Feed CSV from your Freetrade General Investment Account
        to review ordinary-share trades. Have your contract notes to hand for
        any fees or currency conversions the preview asks you to check.
      </p>

      <h2>How to Export from Freetrade</h2>
      <p>
        Freetrade provides an activity export feature. To download your
        transaction history:
      </p>
      <ol>
        <li>Open the Freetrade app and select your taxable account.</li>
        <li>Open <strong>Activity</strong> and tap the arrow at the top right.</li>
        <li>Choose <strong>All Activity</strong> and save the CSV to your device.</li>
        <li>Upload the original, unfiltered CSV. Keep every row, including stock splits.</li>
      </ol>
      <p>
        Check the export against transfers and corporate actions in your records.
        The Activity Feed can omit these events. Include the purchases that
        established your holding, even in earlier years. For a sale on
        5 April 2026, include purchases through 5 May 2026.{" "}
        <a href="https://help.freetrade.io/en/articles/6627908-how-do-i-download-a-csv-export-of-my-activity-feed">
          Freetrade’s download instructions
        </a>
        .
      </p>

      <h2>Understanding the Freetrade CSV Format</h2>
      <p>
        The Freetrade CSV contains rows for different types of activity. The key
        columns you will see include:
      </p>
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
              <td className="px-4 py-2 font-medium">Type</td>
              <td className="px-4 py-2">
                &ldquo;ORDER&rdquo; for buys/sells, &ldquo;DIVIDEND&rdquo; for
                dividends
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Buy / Sell</td>
              <td className="px-4 py-2">
                &ldquo;BUY&rdquo; or &ldquo;SELL&rdquo; (only present on ORDER
                rows)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Ticker</td>
              <td className="px-4 py-2">
                The stock ticker symbol (for example, TSCO)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Quantity</td>
              <td className="px-4 py-2">Number of shares bought or sold</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Price per share</td>
              <td className="px-4 py-2">Price in GBP (or original currency)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Total amount</td>
              <td className="px-4 py-2">Total transaction value in GBP</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Timestamp</td>
              <td className="px-4 py-2">Date and time of the transaction</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Reading a copy of your statement</h3>
      <p>
        If you want to check the file in a spreadsheet, open a separate copy.
        The activity type tells you what each row records.
      </p>
      <ul>
        <li>
          <strong>ORDER</strong> rows represent buy and sell transactions —
          these are relevant for CGT calculations.
        </li>
        <li>
          <strong>DIVIDEND</strong> rows record cash income. The preview counts
          these separately from ordinary-share trades.
        </li>
      </ul>
      <p>
        For an order, read the <strong>Buy / Sell</strong> column to check its direction.
        A stock split can affect the share count. Keeping it in the original
        upload lets the preview flag the event before you save.
      </p>

      <h2>Common Scenario: Shares Bought in Multiple Orders</h2>
      <p>
        Suppose you buy ordinary shares in the same company on three dates.
        These example trades have no fees or other matching purchases.
      </p>

      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>
            • <strong>January 2025:</strong> Buy 10 shares at £72.50 =
            £725.00
          </li>
          <li>
            • <strong>April 2025:</strong> Buy 15 shares at £75.20 =
            £1,128.00
          </li>
          <li>
            • <strong>August 2025:</strong> Buy 5 shares at £78.00 =
            £390.00
          </li>
          <li>
            •{" "}
            <strong>
              <Link href="/guide/section-104-pool">S104 Pool</Link>:
            </strong>{" "}
            30 shares, total cost £2,243.00, average £74.77/share
          </li>
        </ul>
      </div>

      <p>When you sell 20 shares in November 2025 at £80.00 per share:</p>
      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>
            • <strong>Proceeds:</strong> 20 × £80.00 = £1,600.00
          </li>
          <li>
            • <strong>Allowable cost:</strong> 20 ÷ 30 × £2,243.00 = £1,495.33
          </li>
          <li>
            • <strong>Gain:</strong> £1,600.00 − £1,495.33 ={" "}
            <strong className="text-green-700">£104.67</strong>
          </li>
          <li>
            • <strong>Remaining pool:</strong> 10 shares, cost £747.67
          </li>
        </ul>
      </div>

      <h2>Freetrade-Specific Tips</h2>
      <ul>
        <li>
          <strong>Taxable accounts.</strong> Include ordinary-share sales
          from your General Investment Account when working out gains and losses.
        </li>
        <li>
          <strong>FX charges.</strong> Check the trade-date exchange rate and
          charges against your contract note. The preview asks for supporting
          details where it cannot reconcile the GBP amounts.
        </li>
        <li>
          <strong>Fractional shares:</strong> Freetrade supports fractional
          share purchases. These are valid for CGT purposes — include them in
          your Section 104 pool calculation.
        </li>
        <li>
          <strong>ISA vs GIA:</strong> Only General Investment Account
          transactions are subject to CGT. If you invest through a Freetrade ISA
          or SIPP, those gains are tax-free.
        </li>
      </ul>

      <div className={`${styles.referenceBox} my-8 not-prose`}>
        <p className="text-sm text-green-900">
          <strong>Make it easy:</strong> Selected Freetrade GBP ordinary-share
          layouts are available for preview testing. Unsupported rows block
          saving. Reviewed trades use{" "}
          <Link
            href="/guide/bed-and-breakfast-rule"
            className="underline font-medium"
          >
            same-day and 30-day matching rules
          </Link>
          , build your Section 104 pools, and review calculation evidence.
          The CSV and PDF evidence show gains and losses on the trades you imported.
        </p>
      </div>
    </GuideLayout>
  );
}

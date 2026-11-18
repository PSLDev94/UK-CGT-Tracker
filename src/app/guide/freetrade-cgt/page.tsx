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
        Freetrade is a popular UK investment app offering commission-free
        trading with a clean, modern interface. Like other brokers, Freetrade
        does not calculate your Capital Gains Tax — that responsibility falls on
        you. If you trade in a Freetrade General Investment Account (GIA), every
        disposal is a potential CGT event that must be tracked and, if
        applicable, reported to HMRC.
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
      </ol>
      <p>
        Check the export against transfers and corporate actions in your records.
        The Activity Feed can omit these events. To finish matching for 2025–26,
        include purchases through 5 May 2026.{" "}
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
              <td className="px-4 py-2 font-medium">Side</td>
              <td className="px-4 py-2">
                &ldquo;BUY&rdquo; or &ldquo;SELL&rdquo; (only present on ORDER
                rows)
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-medium">Ticker</td>
              <td className="px-4 py-2">
                The stock ticker symbol (e.g., &ldquo;TSCO&rdquo;,
                &ldquo;VUSA&rdquo;)
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

      <h3>ORDER vs DIVIDEND Rows</h3>
      <p>
        The most important distinction in the Freetrade CSV is between{" "}
        <strong>ORDER</strong> rows and <strong>DIVIDEND</strong> rows:
      </p>
      <ul>
        <li>
          <strong>ORDER</strong> rows represent buy and sell transactions —
          these are relevant for CGT calculations.
        </li>
        <li>
          <strong>DIVIDEND</strong> rows represent dividend payments — these
          should be <em>excluded</em> from CGT calculations as dividends are
          taxed under separate income tax rules.
        </li>
      </ul>
      <p>
        When processing the CSV, filter for ORDER rows only and use the
        &ldquo;Side&rdquo; column to determine whether each transaction is a BUY
        or SELL.
      </p>

      <h2>Common Scenario: Shares Bought in Multiple Orders</h2>
      <p>
        A common pattern on Freetrade is building a position gradually. For
        example, you might buy Vanguard S&amp;P 500 ETF (VUSA) in three separate
        orders over several months:
      </p>

      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>
            • <strong>January 2025:</strong> Buy 10 shares of VUSA at £72.50 =
            £725.00
          </li>
          <li>
            • <strong>April 2025:</strong> Buy 15 shares of VUSA at £75.20 =
            £1,128.00
          </li>
          <li>
            • <strong>August 2025:</strong> Buy 5 shares of VUSA at £78.00 =
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
            • <strong>Allowable cost:</strong> 20 × £74.77 = £1,495.33
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
          <strong>Commission-free doesn&apos;t mean tax-free:</strong> While
          Freetrade charges no commission on basic trades, you still owe CGT on
          any gains outside your ISA.
        </li>
        <li>
          <strong>FX charges:</strong> Freetrade charges a currency conversion
          fee (typically 0.45% for free users, 0.15% for Plus subscribers) on US
          and EU share trades. This FX cost is included in the total transaction
          value and is an allowable cost for CGT.
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

      <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-r-lg my-8 not-prose">
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

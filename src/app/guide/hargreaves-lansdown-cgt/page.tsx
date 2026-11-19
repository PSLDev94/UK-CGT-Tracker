import Link from "next/link";
import { Metadata } from "next";
import { GuideLayout } from "@/components/guide-layout";

export const metadata: Metadata = {
  title: "Hargreaves Lansdown Capital Gains Tax — How to Calculate It",
  description:
    "How to export your Hargreaves Lansdown transaction history and calculate your CGT. Check price units carefully. HL imports use assisted review with contract notes.",
  alternates: {
    canonical: "https://www.cgttracker.com/guide/hargreaves-lansdown-cgt",
  },
};

export default function HargreavesLansdownCGTPage() {
  return (
    <GuideLayout
      slug="hargreaves-lansdown-cgt"
      lastUpdated="November 2026"
      edition="HL Fund and Share accounts"
      nextStep={{ href: "/supported-brokers#hl", title: "Check my HL export" }}
      title="Hargreaves Lansdown Capital Gains Tax — How to Calculate It"
      breadcrumb="Hargreaves Lansdown CGT"
      relatedGuides={[
        { href: "/guide/trading-212-cgt", title: "Trading 212 CGT Guide" },
        { href: "/guide/freetrade-cgt", title: "Freetrade CGT Guide" },
        {
          href: "/guide/section-104-pool",
          title: "What is a Section 104 Pool?",
        },
      ]}
    >
      <p>
        Hargreaves Lansdown (HL) is the UK&apos;s largest investment platform by
        assets under management, used by hundreds of thousands of self-directed
        investors. If you hold shares or funds in an HL Fund &amp; Share Account
        (the taxable general investment account, as opposed to an ISA or SIPP),
        you are responsible for calculating your own Capital Gains Tax.
      </p>
      <p>
        This guide explains how to find and export your HL transaction history,
        the crucial pence-versus-pounds quirk you need to be aware of, and how
        to use CGT Tracker to automate the calculation.
      </p>

      <h2>Where to Find Your Transaction History</h2>
      <p>To export your transaction history from Hargreaves Lansdown:</p>
      <ol>
        <li>
          Log in to your HL account at <strong>hl.co.uk</strong>.
        </li>
        <li>
          Navigate to <strong>My Accounts</strong> → select your{" "}
          <strong>Fund &amp; Share Account</strong>.
        </li>
        <li>
          Look for <strong>Transaction History</strong> or{" "}
          <strong>Trade History</strong> in the account menu.
        </li>
        <li>Export the full acquisition history and include purchases for 30 days after the year you are calculating.</li>
        <li>
          Download/export as CSV. You may need to select &ldquo;Download as
          spreadsheet&rdquo; or similar.
        </li>
      </ol>
      <p>
        Note: HL&apos;s interface and export options can change over time. If
        you cannot find an export option, contact HL support to request a
        transaction history download.
      </p>

      <h2>The Pence vs Pounds Quirk</h2>
      <p>
        This is the single most important thing to know about HL data.
        Hargreaves Lansdown often quotes <strong>unit costs in pence</strong>{" "}
        rather than pounds for UK shares. For example, a price of 178.50p means £1.785
        per share. Some securities are quoted in pounds or another currency.
      </p>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg my-6 not-prose">
        <p className="text-sm text-amber-900">
          <strong>Check the price unit on the contract note.</strong> An
          unlabelled price of 178.50 could mean £178.50 or 178.50p (£1.785).
          Confirm the currency and reconcile the trade before saving.
        </p>
      </div>

      <p>
        How do you tell the difference? Look at the &ldquo;Total&rdquo; or
        &ldquo;Value&rdquo; column. If you bought 100 shares at a
        &ldquo;Price&rdquo; of 178.50 and the &ldquo;Total&rdquo; is £178.50
        (not £17,850), then the price is in pence. Check the export’s currency
        and price units explicitly. The assisted review asks you to confirm these details against your contract note.
      </p>

      <h2>How the S104 Pool Works with HL Purchases</h2>
      <p>
        This example uses three Barclays (BARC) purchases from 2022 to 2025,
        each with an illustrative £11.95 dealing charge. The example omits stamp duty and other charges. Use the amounts actually paid on each contract note.
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
                Date
              </th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">
                Action
              </th>
              <th className="text-right px-4 py-2 font-semibold text-gray-700">
                Shares
              </th>
              <th className="text-right px-4 py-2 font-semibold text-gray-700">
                Price (p)
              </th>
              <th className="text-right px-4 py-2 font-semibold text-gray-700">
                HL Fee
              </th>
              <th className="text-right px-4 py-2 font-semibold text-gray-700">
                Pool Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="px-4 py-2">Mar 2022</td>
              <td className="px-4 py-2">Buy</td>
              <td className="px-4 py-2 text-right">200</td>
              <td className="px-4 py-2 text-right">155.00p</td>
              <td className="px-4 py-2 text-right">£11.95</td>
              <td className="px-4 py-2 text-right font-medium">£321.95</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Aug 2023</td>
              <td className="px-4 py-2">Buy</td>
              <td className="px-4 py-2 text-right">150</td>
              <td className="px-4 py-2 text-right">148.30p</td>
              <td className="px-4 py-2 text-right">£11.95</td>
              <td className="px-4 py-2 text-right font-medium">£556.35</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Feb 2025</td>
              <td className="px-4 py-2">Buy</td>
              <td className="px-4 py-2 text-right">100</td>
              <td className="px-4 py-2 text-right">210.50p</td>
              <td className="px-4 py-2 text-right">£11.95</td>
              <td className="px-4 py-2 text-right font-medium">£778.80</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        The <Link href="/guide/section-104-pool">Section 104 pool</Link> now
        holds 450 shares with a total cost of £778.80 (including HL&apos;s
        £11.95 dealing fee on each transaction). The average cost per share is
        £1.7307 (or 173.07p).
      </p>
      <p>
        Notice how the pence values (155.00p, 148.30p, 210.50p) must be
        converted to pounds (£1.55, £1.483, £2.105) before calculating the pool
        cost. If you mistakenly use 155.00 as pounds, your pool cost would be
        100× too high.
      </p>

      <h2>HL Dealing Charges</h2>
      <p>
        From 1 March 2026, HL reduced its standard online share dealing fee
        from £11.95 to £6.95. Other rates can apply. Enter the actual dealing
        charge shown on each contract note. A purchase fee adds to acquisition
        cost, and a sale fee reduces sale proceeds.{" "}
        <a href="https://www.hl.co.uk/accounts/fee-changes">See HL’s fee changes</a>.
      </p>
      <p>
        Many UK share purchases also incur{" "}
        <strong>Stamp Duty Reserve Tax (SDRT)</strong> at 0.5%, which is also an
        allowable cost. HL usually collects this automatically and it appears as
        a separate line on your contract note.
      </p>

      <h2>Common Issues with HL Data</h2>
      <ul>
        <li>
          <strong>Pence vs pounds confusion</strong> — as described above,
          always check the unit price against the total value.
        </li>
        <li>
          <strong>Corporate actions</strong> — if a share undergoes a stock
          split, rights issue, or merger, HL may reflect this as separate
          transactions that need special handling.
        </li>
        <li>
          <strong>Fund transactions</strong> — if you hold funds (OEICs or unit
          trusts), keep them separate when reviewing your history. The supported import scope is ordinary shares.
        </li>
        <li>
          <strong>Multiple accounts</strong> — ensure you only export the
          taxable Fund &amp; Share Account, not ISA or SIPP transactions.
        </li>
      </ul>

      <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-r-lg my-8 not-prose">
        <p className="text-sm text-green-900">
          <strong>Support status:</strong> Documented Transaction Summary files use assisted review. Check price units, security identifiers and fees against your notes before saving. The calculation applies{" "}
          <Link
            href="/guide/bed-and-breakfast-rule"
            className="underline font-medium"
          >
            30-day B&amp;B matching
          </Link>
          , and Section 104 pooling for supported records.
        </p>
      </div>
    </GuideLayout>
  );
}

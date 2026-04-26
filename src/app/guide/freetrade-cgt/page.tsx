import Link from 'next/link'
import { Metadata } from 'next'
import { GuideLayout } from '@/components/guide-layout'

export const metadata: Metadata = {
  title: 'Freetrade Capital Gains Tax Guide for UK Investors',
  description: 'How to calculate your capital gains tax from Freetrade trades. Step-by-step guide to exporting your CSV and applying HMRC rules.',
  alternates: { canonical: 'https://www.cgttracker.com/guide/freetrade-cgt' },
}

export default function FreetradeCGTPage() {
  return (
    <GuideLayout
      title="Freetrade Capital Gains Tax Guide for UK Investors"
      breadcrumb="Freetrade CGT"
      relatedGuides={[
        { href: '/guide/trading-212-cgt', title: 'Trading 212 CGT Guide' },
        { href: '/guide/hargreaves-lansdown-cgt', title: 'Hargreaves Lansdown CGT Guide' },
        { href: '/guide/section-104-pool', title: 'What is a Section 104 Pool?' },
      ]}
    >
      <p>
        Freetrade is a popular UK investment app offering commission-free trading with a clean, modern interface. Like other brokers, Freetrade does not calculate your Capital Gains Tax — that responsibility falls on you. If you trade in a Freetrade General Investment Account (GIA), every disposal is a potential CGT event that must be tracked and, if applicable, reported to HMRC.
      </p>

      <h2>How to Export from Freetrade</h2>
      <p>
        Freetrade provides an activity export feature. To download your transaction history:
      </p>
      <ol>
        <li>Open the Freetrade app on your phone.</li>
        <li>Go to <strong>Activity</strong> (the clock/history icon in the bottom navigation).</li>
        <li>Tap the <strong>export</strong> or <strong>download</strong> icon (often in the top-right corner).</li>
        <li>Select the date range — choose the full tax year: <strong>6 April 2025 to 5 April 2026</strong>.</li>
        <li>Freetrade will email the CSV to your registered email address. Download it to your computer.</li>
      </ol>
      <p>
        Note: The export feature is available on all Freetrade plans (including the free tier). If you can&apos;t find it, check under <strong>Settings → Statements &amp; Reports</strong> or contact Freetrade support.
      </p>

      <h2>Understanding the Freetrade CSV Format</h2>
      <p>
        The Freetrade CSV contains rows for different types of activity. The key columns you will see include:
      </p>
      <div className="overflow-x-auto my-6 not-prose">
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Column</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr><td className="px-4 py-2 font-medium">Type</td><td className="px-4 py-2">&ldquo;ORDER&rdquo; for buys/sells, &ldquo;DIVIDEND&rdquo; for dividends</td></tr>
            <tr><td className="px-4 py-2 font-medium">Side</td><td className="px-4 py-2">&ldquo;BUY&rdquo; or &ldquo;SELL&rdquo; (only present on ORDER rows)</td></tr>
            <tr><td className="px-4 py-2 font-medium">Ticker</td><td className="px-4 py-2">The stock ticker symbol (e.g., &ldquo;TSCO&rdquo;, &ldquo;VUSA&rdquo;)</td></tr>
            <tr><td className="px-4 py-2 font-medium">Quantity</td><td className="px-4 py-2">Number of shares bought or sold</td></tr>
            <tr><td className="px-4 py-2 font-medium">Price per share</td><td className="px-4 py-2">Price in GBP (or original currency)</td></tr>
            <tr><td className="px-4 py-2 font-medium">Total amount</td><td className="px-4 py-2">Total transaction value in GBP</td></tr>
            <tr><td className="px-4 py-2 font-medium">Timestamp</td><td className="px-4 py-2">Date and time of the transaction</td></tr>
          </tbody>
        </table>
      </div>

      <h3>ORDER vs DIVIDEND Rows</h3>
      <p>
        The most important distinction in the Freetrade CSV is between <strong>ORDER</strong> rows and <strong>DIVIDEND</strong> rows:
      </p>
      <ul>
        <li><strong>ORDER</strong> rows represent buy and sell transactions — these are relevant for CGT calculations.</li>
        <li><strong>DIVIDEND</strong> rows represent dividend payments — these should be <em>excluded</em> from CGT calculations as dividends are taxed under separate income tax rules.</li>
      </ul>
      <p>
        When processing the CSV, filter for ORDER rows only and use the &ldquo;Side&rdquo; column to determine whether each transaction is a BUY or SELL.
      </p>

      <h2>Common Scenario: Shares Bought in Multiple Orders</h2>
      <p>
        A common pattern on Freetrade is building a position gradually. For example, you might buy Vanguard S&amp;P 500 ETF (VUSA) in three separate orders over several months:
      </p>

      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>• <strong>January 2025:</strong> Buy 10 shares of VUSA at £72.50 = £725.00</li>
          <li>• <strong>April 2025:</strong> Buy 15 shares of VUSA at £75.20 = £1,128.00</li>
          <li>• <strong>August 2025:</strong> Buy 5 shares of VUSA at £78.00 = £390.00</li>
          <li>• <strong><Link href="/guide/section-104-pool">S104 Pool</Link>:</strong> 30 shares, total cost £2,243.00, average £74.77/share</li>
        </ul>
      </div>

      <p>
        When you sell 20 shares in November 2025 at £80.00 per share:
      </p>
      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>• <strong>Proceeds:</strong> 20 × £80.00 = £1,600.00</li>
          <li>• <strong>Allowable cost:</strong> 20 × £74.77 = £1,495.33</li>
          <li>• <strong>Gain:</strong> £1,600.00 − £1,495.33 = <strong className="text-green-600">£104.67</strong></li>
          <li>• <strong>Remaining pool:</strong> 10 shares, cost £747.67</li>
        </ul>
      </div>

      <h2>Freetrade-Specific Tips</h2>
      <ul>
        <li><strong>Commission-free doesn&apos;t mean tax-free:</strong> While Freetrade charges no commission on basic trades, you still owe CGT on any gains outside your ISA.</li>
        <li><strong>FX charges:</strong> Freetrade charges a currency conversion fee (typically 0.45% for free users, 0.15% for Plus subscribers) on US and EU share trades. This FX cost is included in the total transaction value and is an allowable cost for CGT.</li>
        <li><strong>Fractional shares:</strong> Freetrade supports fractional share purchases. These are valid for CGT purposes — include them in your Section 104 pool calculation.</li>
        <li><strong>ISA vs GIA:</strong> Only General Investment Account transactions are subject to CGT. If you invest through a Freetrade ISA or SIPP, those gains are tax-free.</li>
      </ul>

      <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-r-lg my-8 not-prose">
        <p className="text-sm text-green-900">
          <strong>Make it easy:</strong> Upload your Freetrade CSV to CGT Tracker. We automatically filter ORDER rows, apply <Link href="/guide/bed-and-breakfast-rule" className="underline font-medium">same-day and 30-day matching rules</Link>, build your Section 104 pools, and generate an SA108-ready report.
        </p>
      </div>
    </GuideLayout>
  )
}

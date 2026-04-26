import Link from 'next/link'
import { Metadata } from 'next'
import { GuideLayout } from '@/components/guide-layout'

export const metadata: Metadata = {
  title: 'How to Calculate CGT on Trading 212 UK — Step by Step',
  description: 'How to export your Trading 212 transaction history and calculate your capital gains tax. CGT Tracker imports Trading 212 CSVs automatically.',
  alternates: { canonical: 'https://www.cgttracker.com/guide/trading-212-cgt' },
}

export default function Trading212CGTPage() {
  return (
    <GuideLayout
      title="How to Calculate CGT on Trading 212 UK — Step by Step"
      breadcrumb="Trading 212 CGT"
      relatedGuides={[
        { href: '/guide/hargreaves-lansdown-cgt', title: 'Hargreaves Lansdown CGT Guide' },
        { href: '/guide/freetrade-cgt', title: 'Freetrade CGT Guide' },
        { href: '/guide/section-104-pool', title: 'What is a Section 104 Pool?' },
      ]}
    >
      <p>
        Trading 212 is one of the most popular commission-free brokers in the UK, with millions of active users trading shares, ETFs, and fractional shares. While the app makes investing easy, it doesn&apos;t calculate your <strong>Capital Gains Tax</strong> for you. If you trade in a General Investment Account (GIA) — not an ISA — you are responsible for calculating and reporting your gains to HMRC.
      </p>
      <p>
        This guide walks you through the complete process: exporting your transaction history from Trading 212, understanding the CSV format, and calculating your CGT liability correctly.
      </p>

      <h2>Step 1: Export Your Transaction History</h2>
      <p>
        Trading 212 allows you to export your complete transaction history as a CSV file. Here&apos;s how:
      </p>
      <ol>
        <li>Open the Trading 212 app or website and log in to your account.</li>
        <li>Navigate to the <strong>Activity</strong> or <strong>History</strong> section (this may be under the menu or in account settings).</li>
        <li>Look for an <strong>Export</strong> or <strong>Download</strong> button — Trading 212 typically offers a &ldquo;Download statement&rdquo; or &ldquo;Export CSV&rdquo; option.</li>
        <li>Select the date range covering the full tax year: <strong>6 April</strong> of one year to <strong>5 April</strong> of the next. For the 2025-26 tax year, this is 6 April 2025 to 5 April 2026.</li>
        <li>Download the CSV file to your computer.</li>
      </ol>
      <p>
        [SCREENSHOT: Trading 212 export screen showing the date range selector and Download CSV button]
      </p>

      <h2>Step 2: Understanding the CSV Format</h2>
      <p>
        The Trading 212 CSV typically contains the following columns:
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
            <tr><td className="px-4 py-2 font-medium">Action</td><td className="px-4 py-2">&ldquo;Market buy&rdquo;, &ldquo;Market sell&rdquo;, &ldquo;Limit buy&rdquo;, &ldquo;Limit sell&rdquo;, &ldquo;Dividend (Ordinary)&rdquo;, etc.</td></tr>
            <tr><td className="px-4 py-2 font-medium">Time</td><td className="px-4 py-2">The date and time of the transaction (e.g., &ldquo;2025-06-15 09:30:22&rdquo;)</td></tr>
            <tr><td className="px-4 py-2 font-medium">Ticker</td><td className="px-4 py-2">The stock ticker symbol (e.g., &ldquo;TSCO&rdquo;, &ldquo;LLOY&rdquo;)</td></tr>
            <tr><td className="px-4 py-2 font-medium">No. of shares</td><td className="px-4 py-2">Number of shares bought or sold</td></tr>
            <tr><td className="px-4 py-2 font-medium">Price / share</td><td className="px-4 py-2">Price per share in the currency of the exchange</td></tr>
            <tr><td className="px-4 py-2 font-medium">Total</td><td className="px-4 py-2">Total value of the transaction in your account currency (GBP)</td></tr>
            <tr><td className="px-4 py-2 font-medium">Currency (Price / share)</td><td className="px-4 py-2">The currency the share is priced in (GBP, USD, EUR, etc.)</td></tr>
            <tr><td className="px-4 py-2 font-medium">Exchange rate</td><td className="px-4 py-2">If foreign, the FX rate used to convert to GBP</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Step 3: Key Things to Watch For</h2>

      <h3>Transaction Type Detection</h3>
      <p>
        Trading 212 uses phrases like &ldquo;Market buy&rdquo; and &ldquo;Market sell&rdquo; rather than simple &ldquo;BUY&rdquo;/&ldquo;SELL&rdquo; labels. Any action containing the word &ldquo;buy&rdquo; is a purchase, and any containing &ldquo;sell&rdquo; is a disposal. &ldquo;Dividend&rdquo; rows should be excluded from CGT calculations (dividends are taxed separately as income).
      </p>

      <h3>Foreign Currency Transactions</h3>
      <p>
        If you buy US shares on Trading 212 (e.g., AAPL, TSLA), the price per share will be in USD. For CGT purposes, HMRC requires all calculations to be in GBP. Trading 212 provides an exchange rate column — the &ldquo;Total&rdquo; column is usually already converted to GBP. CGT Tracker handles this conversion automatically.
      </p>

      <h3>Fractional Shares</h3>
      <p>
        Trading 212 supports fractional share trading. You might see quantities like &ldquo;0.5&rdquo; or &ldquo;2.347&rdquo;. These are valid and should be included in your CGT calculation exactly as reported.
      </p>

      <h3>Stock Splits and Corporate Actions</h3>
      <p>
        If a company underwent a stock split during the period, Trading 212 should reflect this in the transaction history. However, it&apos;s worth double-checking that your share counts align before and after the split date.
      </p>

      <h2>Common Mistakes</h2>
      <ul>
        <li><strong>Including ISA transactions:</strong> If you have both a GIA and an ISA on Trading 212, make sure you only export the GIA transactions. ISA gains are tax-free.</li>
        <li><strong>Ignoring dividends:</strong> Don&apos;t include dividend rows in your CGT calculation — they are taxed under different rules.</li>
        <li><strong>Wrong tax year:</strong> Ensure your date range covers exactly 6 April to 5 April, not calendar year January to December.</li>
        <li><strong>Reinvested dividends:</strong> If you have &ldquo;Dividend (Reinvested)&rdquo; rows, these represent a new purchase and <em>should</em> be added to your <Link href="/guide/section-104-pool">Section 104 pool</Link>.</li>
      </ul>

      <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-r-lg my-8 not-prose">
        <p className="text-sm text-green-900">
          <strong>Skip the manual work:</strong> CGT Tracker imports Trading 212 CSVs automatically. Upload your exported file and get your complete CGT calculation — including <Link href="/guide/bed-and-breakfast-rule" className="underline font-medium">same-day and 30-day matching</Link>, Section 104 pooling, and an SA108-ready report — in under 2 minutes.
        </p>
      </div>
    </GuideLayout>
  )
}

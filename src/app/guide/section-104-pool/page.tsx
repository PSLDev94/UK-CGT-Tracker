import Link from 'next/link'
import { Metadata } from 'next'
import { GuideLayout } from '@/components/guide-layout'

export const metadata: Metadata = {
  title: 'What is a Section 104 Pool? UK CGT Explained with Examples',
  description: 'A plain-English guide to HMRC\'s Section 104 pool rule for UK investors. Includes worked examples showing exactly how to calculate your average cost when you buy shares in multiple tranches.',
  alternates: { canonical: 'https://www.cgttracker.com/guide/section-104-pool' },
}

export default function Section104PoolPage() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What happens if I sell all my shares in a Section 104 pool?',
        acceptedAnswer: { '@type': 'Answer', text: 'If you sell every share in a Section 104 pool, the pool is emptied — both the share count and total cost go to zero. Any future purchases of the same security start a brand-new pool from scratch. The gain or loss on the disposal is calculated as normal: sale proceeds minus the total remaining pool cost.' },
      },
      {
        '@type': 'Question',
        name: 'Do dividends affect my Section 104 pool?',
        acceptedAnswer: { '@type': 'Answer', text: 'No. Dividends are taxed separately as income and do not affect the cost basis in your Section 104 pool. Only acquisition costs (the price you paid for shares plus any dealing fees) increase the pool cost. Stamp Duty Reserve Tax (SDRT) paid on purchases is also added to the pool cost.' },
      },
      {
        '@type': 'Question',
        name: 'Does stamp duty count towards my Section 104 pool cost?',
        acceptedAnswer: { '@type': 'Answer', text: 'Yes. HMRC allows you to include Stamp Duty Reserve Tax (SDRT, usually 0.5% on UK share purchases) as part of the acquisition cost in your Section 104 pool. This increases your allowable cost, which reduces any future capital gain when you sell.' },
      },
    ],
  }

  return (
    <GuideLayout
      title="What is a Section 104 Pool? UK CGT Explained with Examples"
      breadcrumb="Section 104 Pool"
      relatedGuides={[
        { href: '/guide/bed-and-breakfast-rule', title: 'The 30-Day Bed & Breakfast Rule' },
        { href: '/guide/cgt-rates-2025-26', title: 'UK CGT Rates 2025-26' },
        { href: '/tools/section-104-calculator', title: 'Free Section 104 Calculator' },
      ]}
      jsonLd={[faqLd]}
    >
      <p>
        When you invest in shares through a UK broker, you rarely buy everything in a single transaction. Most investors build positions over time — buying 200 shares of Tesco in January, another 100 in March, and perhaps 50 more in June. When it comes time to sell, HMRC needs a consistent way to determine <strong>what you paid</strong> for the shares you&apos;re disposing of. That is where the <strong>Section 104 pool</strong> comes in.
      </p>

      <h2>How the Section 104 Pool Works</h2>
      <p>
        The Section 104 pool (named after Section 104 of the Taxation of Chargeable Gains Act 1992) is essentially a running average. For each security you hold, HMRC requires you to maintain a single pool that tracks two numbers:
      </p>
      <ul>
        <li><strong>Total number of shares</strong> — the quantity currently in the pool</li>
        <li><strong>Total allowable cost</strong> — the cumulative cost of acquiring those shares, including broker fees and Stamp Duty Reserve Tax (SDRT)</li>
      </ul>
      <p>
        Every time you buy more of the same share, the pool grows. Every time you sell, the pool shrinks proportionally. The <strong>average cost per share</strong> is simply the total cost divided by the total shares. This average cost is then used to calculate your capital gain or loss when you sell.
      </p>

      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6 not-prose">
        <p className="text-sm text-blue-900">
          <strong>Important:</strong> The Section 104 pool is the <em>third</em> matching rule HMRC applies. Before using the pool, HMRC first checks for <Link href="/guide/bed-and-breakfast-rule" className="underline font-medium">same-day matches and 30-day bed &amp; breakfast matches</Link>. Only shares that don&apos;t match under those two rules flow through to the Section 104 pool.
        </p>
      </div>

      <h2>Example 1: Building a Pool</h2>
      <p>
        Sarah invests in Lloyds Banking Group (LLOY) through her Trading 212 account over several months:
      </p>

      <div className="overflow-x-auto my-6 not-prose">
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Date</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-700">Action</th>
              <th className="text-right px-4 py-2 font-semibold text-gray-700">Shares</th>
              <th className="text-right px-4 py-2 font-semibold text-gray-700">Price</th>
              <th className="text-right px-4 py-2 font-semibold text-gray-700">Fees</th>
              <th className="text-right px-4 py-2 font-semibold text-gray-700">Pool Shares</th>
              <th className="text-right px-4 py-2 font-semibold text-gray-700">Pool Cost</th>
              <th className="text-right px-4 py-2 font-semibold text-gray-700">Avg Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr><td className="px-4 py-2">10 Jan 2025</td><td className="px-4 py-2">Buy</td><td className="px-4 py-2 text-right">500</td><td className="px-4 py-2 text-right">£0.52</td><td className="px-4 py-2 text-right">£1.50</td><td className="px-4 py-2 text-right font-medium">500</td><td className="px-4 py-2 text-right font-medium">£261.50</td><td className="px-4 py-2 text-right">£0.5230</td></tr>
            <tr><td className="px-4 py-2">15 Mar 2025</td><td className="px-4 py-2">Buy</td><td className="px-4 py-2 text-right">300</td><td className="px-4 py-2 text-right">£0.58</td><td className="px-4 py-2 text-right">£1.50</td><td className="px-4 py-2 text-right font-medium">800</td><td className="px-4 py-2 text-right font-medium">£437.00</td><td className="px-4 py-2 text-right">£0.5463</td></tr>
            <tr><td className="px-4 py-2">22 Jun 2025</td><td className="px-4 py-2">Buy</td><td className="px-4 py-2 text-right">200</td><td className="px-4 py-2 text-right">£0.55</td><td className="px-4 py-2 text-right">£1.50</td><td className="px-4 py-2 text-right font-medium">1,000</td><td className="px-4 py-2 text-right font-medium">£548.50</td><td className="px-4 py-2 text-right">£0.5485</td></tr>
          </tbody>
        </table>
      </div>

      <p>
        After three purchases, Sarah has a Section 104 pool of <strong>1,000 shares</strong> with a total cost of <strong>£548.50</strong>. Her average cost per share is £0.5485. Note that the dealing fees (£1.50 each) are included in the pool cost — this is an allowable expense under HMRC rules.
      </p>

      <h2>Example 2: Selling from the Pool</h2>
      <p>
        In September 2025, Sarah sells 400 shares of LLOY at £0.65 per share. No same-day or 30-day match applies, so the disposal is matched against the Section 104 pool.
      </p>
      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>• <strong>Proceeds:</strong> 400 × £0.65 = <strong>£260.00</strong></li>
          <li>• <strong>Allowable cost:</strong> 400 ÷ 1,000 × £548.50 = <strong>£219.40</strong></li>
          <li>• <strong>Gain:</strong> £260.00 − £219.40 = <strong className="text-green-600">£40.60</strong></li>
          <li>• <strong>Pool after sale:</strong> 600 shares, cost £329.10, avg £0.5485/share</li>
        </ul>
      </div>
      <p>
        Notice that the average cost per share remains the same after a sale — only the total shares and total cost decrease proportionally. This is a key feature of the Section 104 pool.
      </p>

      <h2>Example 3: Pool After Adding More Shares</h2>
      <p>
        In November 2025, Sarah buys another 400 shares at £0.70 with £1.50 fees:
      </p>
      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>• <strong>Existing pool:</strong> 600 shares, £329.10 cost</li>
          <li>• <strong>New purchase:</strong> 400 × £0.70 + £1.50 = £281.50</li>
          <li>• <strong>New pool:</strong> 1,000 shares, cost £610.60, avg £0.6106/share</li>
        </ul>
      </div>
      <p>
        The new average cost (£0.6106) is higher than before because Sarah bought at a higher price. If she sells now, her gain will be smaller (or she could have a loss) compared to buying at the earlier, lower prices.
      </p>

      <h2>What Costs Can Be Included?</h2>
      <p>
        HMRC allows the following costs to be included in your Section 104 pool:
      </p>
      <ul>
        <li><strong>Purchase price</strong> — the amount you paid for the shares</li>
        <li><strong>Broker commission/fees</strong> — dealing charges levied by your broker</li>
        <li><strong>Stamp Duty Reserve Tax (SDRT)</strong> — the 0.5% charge on UK share purchases</li>
        <li><strong>PTM levy</strong> — the Panel on Takeovers and Mergers levy (if applicable, currently £1 on trades over £10,000)</li>
      </ul>
      <p>
        You can also include selling costs (broker fees on disposal) as a deduction from the proceeds, which has the same net effect on the gain calculation.
      </p>

      <h2>When the Section 104 Pool Does NOT Apply</h2>
      <p>
        The pool is only used after HMRC&apos;s higher-priority matching rules have been applied:
      </p>
      <ol>
        <li><strong>Same-day rule</strong> — if you buy and sell the same shares on the same day, those transactions are matched first.</li>
        <li><strong>30-day (B&amp;B) rule</strong> — if you sell shares and repurchase the same shares within 30 days, the sale is matched to the repurchase. Read the full <Link href="/guide/bed-and-breakfast-rule">30-day bed and breakfast rule guide</Link>.</li>
        <li><strong>Section 104 pool</strong> — everything else comes from the pool.</li>
      </ol>

      <h2>Frequently Asked Questions</h2>

      <h3>What if I sell all my shares?</h3>
      <p>
        If you sell every share in a Section 104 pool, the pool is completely emptied — both the share count and total cost go to zero. Any future purchases of the same security start a brand-new pool from scratch. The gain or loss on the final disposal is calculated as: sale proceeds minus the total remaining pool cost.
      </p>

      <h3>Do dividends affect my pool?</h3>
      <p>
        No. Dividends are taxed separately as income (under dividend tax rules, not CGT) and do not affect the cost basis in your Section 104 pool. Only acquisition costs increase the pool. However, if you reinvest dividends by purchasing additional shares, those new purchases <em>are</em> added to the pool at whatever price you bought them.
      </p>

      <h3>Does stamp duty count?</h3>
      <p>
        Yes. Stamp Duty Reserve Tax (SDRT), typically 0.5% on UK share purchases, is treated by HMRC as an allowable cost of acquisition. It should be added to the pool cost along with the purchase price and broker fees. This marginally increases your allowable cost and therefore marginally reduces your gain on disposal.
      </p>

      <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-r-lg my-8 not-prose">
        <p className="text-sm text-green-900">
          <strong>Try it yourself:</strong> Use our free <Link href="/tools/section-104-calculator" className="underline font-medium">Section 104 pool calculator</Link> to build a pool from your own purchase history and see exactly how the average cost changes over time.
        </p>
      </div>
    </GuideLayout>
  )
}

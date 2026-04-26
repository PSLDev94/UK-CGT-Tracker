import Link from 'next/link'
import { Metadata } from 'next'
import { GuideLayout } from '@/components/guide-layout'

export const metadata: Metadata = {
  title: 'The 30-Day Bed & Breakfast Rule: UK CGT Guide 2025-26',
  description: 'Sold shares and bought them back within 30 days? HMRC\'s bed and breakfast rule changes how your gain is calculated. Full guide with examples.',
  alternates: { canonical: 'https://www.cgttracker.com/guide/bed-and-breakfast-rule' },
}

export default function BedAndBreakfastRulePage() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the 30-day bed and breakfast rule?',
        acceptedAnswer: { '@type': 'Answer', text: 'If you sell shares and buy the same shares back within 30 calendar days, HMRC matches the sale against the repurchase rather than your Section 104 pool. This prevents investors from selling at a loss to reduce their tax bill and immediately buying back to maintain their position.' },
      },
      {
        '@type': 'Question',
        name: 'Does the bed and breakfast rule apply to ISA shares?',
        acceptedAnswer: { '@type': 'Answer', text: 'No. Shares held within an ISA are completely exempt from Capital Gains Tax, so the B&B rule is irrelevant. However, if you sell shares in a taxable account and repurchase within an ISA within 30 days, the B&B rule would still apply to the disposal in the taxable account.' },
      },
      {
        '@type': 'Question',
        name: 'How do I avoid triggering the bed and breakfast rule?',
        acceptedAnswer: { '@type': 'Answer', text: 'Wait at least 31 days before repurchasing the same shares. Alternatively, consider legitimate strategies: buy shares in your spouse\'s name, repurchase within an ISA (bed and ISA), or repurchase within a SIPP pension (bed and SIPP).' },
      },
    ],
  }

  return (
    <GuideLayout
      title="The 30-Day Bed & Breakfast Rule: UK CGT Guide 2025-26"
      breadcrumb="Bed & Breakfast Rule"
      relatedGuides={[
        { href: '/guide/section-104-pool', title: 'What is a Section 104 Pool?' },
        { href: '/guide/cgt-rates-2025-26', title: 'UK CGT Rates 2025-26' },
        { href: '/tools/bed-and-breakfast-calculator', title: 'Free B&B Calculator' },
      ]}
      jsonLd={[faqLd]}
    >
      <p>
        If you sell shares and then buy the same shares back within 30 days, you might think you&apos;ve crystallised a gain or loss for tax purposes. But HMRC disagrees. The <strong>30-day bed and breakfast rule</strong> (formally known as the &ldquo;identification rule&rdquo;) overrides the normal <Link href="/guide/section-104-pool">Section 104 pool</Link> matching and instead matches your sale against the repurchase. This fundamentally changes how your gain or loss is calculated.
      </p>

      <h2>Why Does the Rule Exist?</h2>
      <p>
        The name &ldquo;bed and breakfast&rdquo; comes from a practice that was common before 1998: an investor would sell shares just before the end of the tax year (&ldquo;put them to bed&rdquo;) to crystallise a loss and reduce their CGT bill, then buy the same shares back the next morning (&ldquo;at breakfast&rdquo;). The investor&apos;s economic position was unchanged — they still owned the same shares — but they&apos;d claimed a tax loss.
      </p>
      <p>
        HMRC closed this loophole by introducing the 30-day rule. If you sell and repurchase within 30 calendar days, the disposal cost is set to the <strong>repurchase price</strong>, not the original pool cost. This typically eliminates the artificial loss.
      </p>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg my-6 not-prose">
        <p className="text-sm text-amber-900">
          <strong>Key point:</strong> The 30-day window starts from the day <em>after</em> the sale. If you sell on 1 June, the rule applies to any repurchase between 2 June and 1 July (inclusive). A repurchase on 2 July would be outside the window.
        </p>
      </div>

      <h2>How the Rule Works — Step by Step</h2>
      <ol>
        <li>You sell shares of security X.</li>
        <li>Within the next 30 calendar days, you buy shares of the same security X.</li>
        <li>The sale is &ldquo;matched&rdquo; against the repurchase. The allowable cost of the disposal becomes the cost of the repurchased shares (not the Section 104 pool cost).</li>
        <li>The repurchased shares are <strong>not</strong> added to the Section 104 pool — they are consumed by the B&amp;B match.</li>
      </ol>

      <h2>Example 1: A Loss Being Reduced</h2>
      <p>
        James owns 500 shares of Vodafone (VOD) in his <Link href="/guide/section-104-pool">Section 104 pool</Link> with a total cost of £1,250 (average cost £2.50 per share). He decides to sell and rebuy:
      </p>

      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <h4 className="font-bold text-gray-900 mb-3">Timeline</h4>
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>• <strong>1 March:</strong> James sells 500 shares at £2.00 each = £1,000 proceeds</li>
          <li>• <strong>Without B&amp;B rule:</strong> Gain = £1,000 − £1,250 = <strong className="text-red-600">−£250 loss</strong></li>
          <li>• <strong>15 March:</strong> James buys 500 shares at £2.10 each = £1,050 cost</li>
          <li>• <strong>With B&amp;B rule:</strong> The sale is matched to the 15 March purchase</li>
          <li>• <strong>Actual gain:</strong> £1,000 − £1,050 = <strong className="text-red-600">−£50 loss</strong></li>
        </ul>
      </div>
      <p>
        The B&amp;B rule has reduced James&apos;s loss from £250 to just £50. This is exactly what HMRC intends — James&apos;s economic position barely changed (he sold at £2.00 and rebought at £2.10), so the tax relief should reflect the true economic movement, not the artificial comparison to his original cost.
      </p>

      <h2>Example 2: A Gain Being Affected</h2>
      <p>
        Emma owns 200 shares of Barclays (BARC) with a pool cost of £600 (£3.00 per share). She sells and rebuys at a lower price:
      </p>

      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <h4 className="font-bold text-gray-900 mb-3">Timeline</h4>
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>• <strong>10 July:</strong> Emma sells 200 shares at £5.00 each = £1,000 proceeds</li>
          <li>• <strong>Without B&amp;B rule:</strong> Gain = £1,000 − £600 = <strong className="text-green-600">£400 gain</strong></li>
          <li>• <strong>25 July:</strong> Emma buys 200 shares at £4.50 each = £900 cost</li>
          <li>• <strong>With B&amp;B rule:</strong> The sale is matched to the 25 July purchase</li>
          <li>• <strong>Actual gain:</strong> £1,000 − £900 = <strong className="text-green-600">£100 gain</strong></li>
        </ul>
      </div>
      <p>
        In this case, the B&amp;B rule actually <em>reduces</em> Emma&apos;s gain (from £400 to £100) because she repurchased at a lower price. The remaining pool cost of £600 is preserved for future disposals. This can occasionally work in the investor&apos;s favour, but it&apos;s not something you should plan around.
      </p>

      <h2>Legitimate Alternatives: Bed and ISA, Bed and SIPP, Bed and Spouse</h2>
      <p>
        While the classic bed and breakfast is caught by the 30-day rule, HMRC does allow several legitimate alternatives:
      </p>

      <h3>Bed and ISA</h3>
      <p>
        Sell shares in your taxable general investment account and repurchase them within your Stocks &amp; Shares ISA. The sale is a genuine disposal for CGT purposes (the 30-day rule does not apply because the repurchase is in a different tax wrapper). Any future gains on those shares within the ISA are entirely tax-free. This is one of the most effective CGT planning strategies available to UK investors.
      </p>

      <h3>Bed and SIPP</h3>
      <p>
        Similar to bed and ISA, but you repurchase within your Self-Invested Personal Pension. The disposal crystallises the gain or loss, and the shares then grow tax-free within the pension. You also receive tax relief on the pension contribution. However, you cannot access pension funds until age 55 (rising to 57 in 2028).
      </p>

      <h3>Bed and Spouse</h3>
      <p>
        Transfer shares to your spouse or civil partner (this is a no-gain, no-loss transfer and is not a taxable event). Your spouse then sells and repurchases in their own name. Each spouse has their own annual exempt amount (£3,000 for 2025-26), so this can effectively double the household&apos;s tax-free allowance. The 30-day rule does not apply because the repurchase is by a different person.
      </p>

      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6 not-prose">
        <p className="text-sm text-blue-900">
          <strong>Want to check if the B&amp;B rule applies?</strong> Use our free <Link href="/tools/bed-and-breakfast-calculator" className="underline font-medium">bed and breakfast rule calculator</Link> to enter your sell and re-buy details and see your actual gain or loss instantly.
        </p>
      </div>

      <h2>Key Points to Remember</h2>
      <ul>
        <li>The 30-day window is <strong>calendar days</strong>, not business days — weekends and bank holidays count.</li>
        <li>The rule applies per security — selling Vodafone and buying Barclays within 30 days does <strong>not</strong> trigger the rule.</li>
        <li>If you sell more shares than you repurchase, only the quantity repurchased is matched under B&amp;B. The remainder is matched against the Section 104 pool.</li>
        <li>The same-day rule takes priority over the 30-day rule. If you buy and sell on the same day, those are matched first.</li>
        <li>B&amp;B matched acquisitions are <strong>not</strong> added to the Section 104 pool — they are entirely consumed by the match.</li>
      </ul>

      <h2>How CGT Tracker Handles This</h2>
      <p>
        CGT Tracker automatically detects bed and breakfast matches when processing your broker CSV. The engine applies HMRC&apos;s matching rules in the correct priority order: same-day first, then 30-day B&amp;B, then Section 104 pool. Each matched disposal is clearly labelled in your tax report, so you can verify exactly how each gain or loss was calculated.
      </p>
    </GuideLayout>
  )
}

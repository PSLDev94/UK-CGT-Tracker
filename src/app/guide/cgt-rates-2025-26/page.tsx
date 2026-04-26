import Link from 'next/link'
import { Metadata } from 'next'
import { GuideLayout } from '@/components/guide-layout'

export const metadata: Metadata = {
  title: 'UK Capital Gains Tax Rates 2025-26 on Shares',
  description: 'UK CGT rates on shares for 2025-26: 18% basic rate, 24% higher rate. Includes the October 2024 budget changes and how to calculate your bill.',
  alternates: { canonical: 'https://www.cgttracker.com/guide/cgt-rates-2025-26' },
}

export default function CGTRatesPage() {
  return (
    <GuideLayout
      title="UK Capital Gains Tax Rates 2025-26 on Shares"
      breadcrumb="CGT Rates 2025-26"
      relatedGuides={[
        { href: '/guide/section-104-pool', title: 'What is a Section 104 Pool?' },
        { href: '/guide/sa108-how-to-fill-in', title: 'How to Fill in SA108' },
        { href: '/tools/cgt-allowance-checker', title: 'CGT Allowance Checker' },
      ]}
    >
      <p>
        Capital Gains Tax rates on shares and investments in the UK have changed significantly over the past few years. The October 2024 Autumn Budget introduced the latest changes, increasing rates for disposals from 30 October 2024 onwards. This guide covers the current 2025-26 tax year rates, the historical progression, and exactly how your income level determines which rate you pay.
      </p>

      <h2>Current CGT Rates for 2025-26</h2>
      <p>
        For the tax year 6 April 2025 to 5 April 2026, the CGT rates on shares, securities, and other investments (excluding residential property) are:
      </p>
      <ul>
        <li><strong>Basic rate taxpayers:</strong> 18%</li>
        <li><strong>Higher and additional rate taxpayers:</strong> 24%</li>
      </ul>
      <p>
        The <strong>annual exempt amount</strong> for 2025-26 is <strong>£3,000</strong>. This means the first £3,000 of capital gains in the tax year is tax-free.
      </p>

      <h2>Historical Rate Table</h2>
      <div className="overflow-x-auto my-6 not-prose">
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Tax Year</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Annual Exempt Amount</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Basic Rate</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Higher Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr><td className="px-4 py-2">2021-22</td><td className="px-4 py-2">£12,300</td><td className="px-4 py-2">10%</td><td className="px-4 py-2">20%</td></tr>
            <tr><td className="px-4 py-2">2022-23</td><td className="px-4 py-2">£12,300</td><td className="px-4 py-2">10%</td><td className="px-4 py-2">20%</td></tr>
            <tr><td className="px-4 py-2">2023-24</td><td className="px-4 py-2">£6,000</td><td className="px-4 py-2">10%</td><td className="px-4 py-2">20%</td></tr>
            <tr><td className="px-4 py-2">2024-25 (before 30 Oct)</td><td className="px-4 py-2">£3,000</td><td className="px-4 py-2">10%</td><td className="px-4 py-2">20%</td></tr>
            <tr><td className="px-4 py-2">2024-25 (from 30 Oct)</td><td className="px-4 py-2">£3,000</td><td className="px-4 py-2">18%</td><td className="px-4 py-2">24%</td></tr>
            <tr className="bg-blue-50 font-medium"><td className="px-4 py-2">2025-26</td><td className="px-4 py-2">£3,000</td><td className="px-4 py-2">18%</td><td className="px-4 py-2">24%</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        As you can see, both the annual exempt amount and the rates have moved against investors. The exempt amount has fallen from £12,300 to just £3,000, and rates on shares have nearly doubled from 10%/20% to 18%/24%.
      </p>

      <h2>The October 2024 Mid-Year Rate Change</h2>
      <p>
        The 2024-25 tax year is uniquely complicated because the Autumn Budget on 30 October 2024 increased CGT rates <em>during</em> the tax year. Disposals before 30 October 2024 are taxed at the old rates (10%/20%), while disposals on or after 30 October 2024 are taxed at the new rates (18%/24%).
      </p>
      <p>
        If you made disposals in both periods within the 2024-25 tax year, you need to calculate the gains separately for each period and apply the appropriate rate. This is one area where using automated software like CGT Tracker can save significant time and prevent errors.
      </p>

      <h2>How Your Income Determines Your CGT Rate</h2>
      <p>
        Whether you pay the basic or higher rate of CGT depends on your total taxable income for the year. The process works as follows:
      </p>
      <ol>
        <li>Calculate your total taxable income (salary, dividends, rental income, etc.)</li>
        <li>Subtract your Personal Allowance (£12,570 for 2025-26) to get your taxable income</li>
        <li>Check how much of the basic rate band (£37,700) you have remaining</li>
        <li>Capital gains are &ldquo;stacked on top&rdquo; of your income — gains that fall within the remaining basic rate band are taxed at 18%, gains above are taxed at 24%</li>
      </ol>

      <h3>Worked Example: Mixed Rate Calculation</h3>
      <p>
        David has a salary of £45,000 and capital gains of £10,000 in the 2025-26 tax year.
      </p>
      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>• <strong>Taxable income:</strong> £45,000 − £12,570 = £32,430</li>
          <li>• <strong>Basic rate band remaining:</strong> £37,700 − £32,430 = <strong>£5,270</strong></li>
          <li>• <strong>Capital gains after exemption:</strong> £10,000 − £3,000 = <strong>£7,000</strong> taxable</li>
          <li>• <strong>First £5,270 of gains:</strong> taxed at 18% = <strong>£948.60</strong></li>
          <li>• <strong>Remaining £1,730 of gains:</strong> taxed at 24% = <strong>£415.20</strong></li>
          <li>• <strong>Total CGT due:</strong> £948.60 + £415.20 = <strong>£1,363.80</strong></li>
        </ul>
      </div>
      <p>
        If David were entirely a higher rate taxpayer (income above £50,270), the entire £7,000 taxable gain would be taxed at 24% = £1,680. Being a mixed-rate taxpayer saves him £316.20.
      </p>

      <h2>How to Reduce Your CGT Bill Legitimately</h2>
      <p>
        There are several HMRC-approved strategies to reduce your capital gains tax:
      </p>

      <h3>1. Use Your Annual Exempt Amount</h3>
      <p>
        Make sure both you and your spouse/civil partner use the full £3,000 annual exemption each year. Consider transferring assets to your spouse before sale to utilise their exemption (spouse transfers are tax-free).
      </p>

      <h3>2. Bed and ISA</h3>
      <p>
        Sell shares in your taxable account and repurchase within your ISA. The sale crystallises any gain (potentially within your exempt amount), and future growth within the ISA is entirely tax-free. Read more about this and other strategies in our <Link href="/guide/bed-and-breakfast-rule">bed and breakfast rule guide</Link>.
      </p>

      <h3>3. Offset Losses</h3>
      <p>
        Capital losses can be offset against gains in the same tax year. If your losses exceed your gains, the excess can be carried forward indefinitely to offset future gains. Use our <Link href="/tools/cgt-allowance-checker">CGT allowance checker</Link> to see your current position.
      </p>

      <h3>4. Time Your Disposals</h3>
      <p>
        If you are close to the end of the tax year, consider whether it is more advantageous to sell before or after 5 April. Splitting gains across two tax years gives you two annual exempt amounts.
      </p>

      <h3>5. Pension Contributions</h3>
      <p>
        Making pension contributions reduces your taxable income, which can push more of your capital gains into the basic rate band (18% instead of 24%).
      </p>

      <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-r-lg my-8 not-prose">
        <p className="text-sm text-green-900">
          <strong>Know your position:</strong> Use our free <Link href="/tools/cgt-allowance-checker" className="underline font-medium">CGT allowance checker</Link> to instantly see how much of your £3,000 exemption remains and what your estimated tax bill looks like.
        </p>
      </div>
    </GuideLayout>
  )
}

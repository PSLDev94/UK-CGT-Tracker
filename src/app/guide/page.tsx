import Link from 'next/link'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'UK Capital Gains Tax Guide for Investors',
  description: 'A plain-English guide to UK Capital Gains Tax rules for self-directed investors. Learn about the Section 104 pool, 30-day bed and breakfast rule, annual exempt amounts, and how to report on your SA108 self-assessment.',
  openGraph: {
    title: 'UK Capital Gains Tax Guide for Investors',
    description: 'A plain-English guide to UK Capital Gains Tax rules for self-directed investors.',
  }
}

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <PublicNav />

      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-500 font-medium mb-6 inline-flex items-center">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to home
        </Link>

        <div className="flex items-center mb-2 mt-4">
          <BookOpen className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-4xl font-extrabold text-gray-900">UK Capital Gains Tax Guide</h1>
        </div>
        <p className="text-lg text-gray-600 mb-12">
          A plain-English explanation of how CGT works for UK self-directed investors.
        </p>

        {/* Section 1 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What is Capital Gains Tax?</h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              Capital Gains Tax (CGT) is a tax on the profit when you sell (or &quot;dispose of&quot;) an asset that has increased in value. It&apos;s the <strong>gain</strong> you make — not the total amount of money you receive — that is taxed.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              For UK investors, this applies to the sale of shares, ETFs, and other investments held <strong>outside</strong> of a tax-sheltered account (like an ISA or pension). Anything inside an ISA is completely exempt from CGT.
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6">
              <p className="text-sm text-blue-900">
                <strong>Key point:</strong> You only pay CGT when you <em>sell</em> shares. Simply holding shares that have gone up in value does not trigger a CGT event — the gain is &quot;unrealised&quot; until you sell.
              </p>
            </div>
            <p className="text-gray-700 leading-relaxed">
              The UK tax year runs from <strong>6 April</strong> to <strong>5 April</strong> the following year. For 2025-26, you have a <strong>£3,000 annual exempt amount</strong> — the first £3,000 of gains each year are tax-free.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Section 104 Pool</h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              When you buy the same share on multiple occasions, HMRC doesn&apos;t let you pick which specific shares you&apos;re selling. Instead, all your purchases of the same share are pooled together into a <strong>Section 104 pool</strong>.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              The pool tracks two things: the <strong>total number of shares</strong> and the <strong>total cost</strong> (including all broker fees). The allowable cost per share is simply the total cost divided by total shares.
            </p>

            <div className="bg-gray-50 border rounded-lg p-6 my-6">
              <h4 className="font-bold text-gray-900 mb-3">Example</h4>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li>• <strong>January:</strong> Buy 100 shares of TSCO at £3.00 each = £300 cost</li>
                <li>• <strong>March:</strong> Buy 50 shares of TSCO at £3.50 each = £175 cost</li>
                <li>• <strong>Pool:</strong> 150 shares, total cost £475, average cost £3.17 per share</li>
                <li>• <strong>June:</strong> Sell 80 shares at £4.00 each = £320 proceeds</li>
                <li>• <strong>Allowable cost:</strong> 80 × £3.17 = £253.33</li>
                <li>• <strong>Gain:</strong> £320 − £253.33 = <strong className="text-green-600">£66.67</strong></li>
                <li>• <strong>Pool now:</strong> 70 shares, total cost £221.67</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The 30-Day Rule (Bed & Breakfast)</h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              The 30-day rule prevents you from selling shares at a loss and immediately buying them back to claim the tax benefit. If you sell shares and <strong>repurchase the same shares within 30 days</strong>, the disposal is matched against the new purchase — not the Section 104 pool.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              This is formally known as the &quot;bed and breakfast&quot; rule. It was introduced to stop investors &quot;selling before bed and buying back at breakfast&quot;.
            </p>

            <div className="bg-gray-50 border rounded-lg p-6 my-6">
              <h4 className="font-bold text-gray-900 mb-3">Example</h4>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li>• <strong>1 June:</strong> Buy 100 shares of AAPL at £100 each = £10,000</li>
                <li>• <strong>1 September:</strong> Sell 100 shares of AAPL at £80 each = £8,000 (apparent loss: £2,000)</li>
                <li>• <strong>15 September:</strong> Buy 100 shares of AAPL at £85 each = £8,500</li>
                <li>• Because the repurchase is within 30 days, the sale is matched to the £8,500 buy</li>
                <li>• <strong>Actual allowable cost:</strong> £8,500 (not £10,000)</li>
                <li>• <strong>Actual loss:</strong> £8,000 − £8,500 = <strong className="text-red-600">−£500</strong> (not −£2,000)</li>
              </ul>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg my-6">
              <p className="text-sm text-amber-900">
                <strong>Tax-loss harvesting tip:</strong> If you want to genuinely crystallise a loss, you must wait at least 30 full days before repurchasing the same shares.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Same-Day Rule</h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              If you buy and sell the same shares on the <strong>same day</strong>, those transactions are matched together first, before any other matching rule applies. This takes priority over both the 30-day rule and the Section 104 pool.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Annual Exempt Amount</h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              Everyone gets a tax-free allowance for capital gains each year. For the 2025-26 tax year, this is <strong>£3,000</strong>. Only gains above this threshold are taxed.
            </p>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Tax Year</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Exempt Amount</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Basic Rate</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Higher Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr><td className="px-4 py-2">2021-22</td><td className="px-4 py-2">£12,300</td><td className="px-4 py-2">10%</td><td className="px-4 py-2">20%</td></tr>
                  <tr><td className="px-4 py-2">2022-23</td><td className="px-4 py-2">£12,300</td><td className="px-4 py-2">10%</td><td className="px-4 py-2">20%</td></tr>
                  <tr><td className="px-4 py-2">2023-24</td><td className="px-4 py-2">£6,000</td><td className="px-4 py-2">10%</td><td className="px-4 py-2">20%</td></tr>
                  <tr><td className="px-4 py-2">2024-25</td><td className="px-4 py-2">£3,000</td><td className="px-4 py-2">18%*</td><td className="px-4 py-2">24%*</td></tr>
                  <tr className="bg-blue-50"><td className="px-4 py-2 font-medium">2025-26</td><td className="px-4 py-2 font-medium">£3,000</td><td className="px-4 py-2 font-medium">18%</td><td className="px-4 py-2 font-medium">24%</td></tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-2">* For 2024-25, rates were 10%/20% before 30 October 2024, then 18%/24% after the Autumn Budget.</p>
            </div>
          </div>
        </section>

        {/* Section 6 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How to Report on Self-Assessment</h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              If your total proceeds from disposals exceed <strong>4 × the annual exempt amount</strong> (£12,000 for 2025-26), or if you have taxable gains, you must report them on your self-assessment tax return.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              You&apos;ll need to complete the <strong>SA108 supplementary page</strong> (Capital Gains). The key boxes to fill are:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li><strong>Number of disposals</strong> — how many sell transactions you made</li>
              <li><strong>Total disposal proceeds</strong> — the total amount received from all sales</li>
              <li><strong>Total allowable costs</strong> — the total cost basis of the shares sold</li>
              <li><strong>Gains in the year before losses</strong> — total of all individual gains</li>
              <li><strong>Losses in the year</strong> — total of all individual losses</li>
            </ul>
            <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-r-lg my-6">
              <p className="text-sm text-green-900">
                <strong>CGT Tracker can help:</strong> Use our <Link href="/dashboard/reports" className="underline font-medium">Reports</Link> page to download a pre-filled SA108 reference sheet with all these figures calculated for you.
              </p>
            </div>
            <p className="text-gray-700 leading-relaxed">
              The self-assessment deadline is <strong>31 January</strong> following the end of the tax year (e.g., 31 January 2027 for the 2025-26 tax year).
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-blue-50 rounded-2xl p-8 text-center mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to calculate your CGT?</h2>
          <p className="text-gray-600 mb-6">Upload your broker CSV and get your exact tax position in minutes.</p>
          <Link href="/signup" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-blue-700">
            Start free trial
          </Link>
          <p className="text-sm text-gray-500 mt-3">14-day free trial. No credit card required.</p>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} CGT Tracker. For guidance only. Please consult a qualified tax advisor.</p>
      </footer>
    </div>
  )
}

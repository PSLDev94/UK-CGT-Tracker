import Link from 'next/link'
import { Metadata } from 'next'
import { GuideLayout } from '@/components/guide-layout'

export const metadata: Metadata = {
  title: 'How to Fill in SA108 for Shares and Investments',
  description: 'Step-by-step guide to completing the HMRC SA108 supplementary page for capital gains from shares. Which boxes to fill, what figures to use, and the 31 January deadline.',
  alternates: { canonical: 'https://www.cgttracker.com/guide/sa108-how-to-fill-in' },
}

export default function SA108GuidePage() {
  return (
    <GuideLayout
      title="How to Fill in SA108 for Shares and Investments"
      breadcrumb="SA108 Guide"
      relatedGuides={[
        { href: '/guide/section-104-pool', title: 'What is a Section 104 Pool?' },
        { href: '/guide/cgt-rates-2025-26', title: 'UK CGT Rates 2025-26' },
        { href: '/guide/bed-and-breakfast-rule', title: 'The 30-Day Bed & Breakfast Rule' },
      ]}
    >
      <p>
        The <strong>SA108</strong> is the Capital Gains supplementary page of the HMRC Self Assessment tax return. If you have sold shares, ETFs, or other investments during the tax year and need to report capital gains, this is the form you need to complete. This guide walks you through each relevant box with plain-English explanations.
      </p>

      <h2>When Must You Report?</h2>
      <p>
        You must complete the SA108 if any of the following apply:
      </p>
      <ul>
        <li>Your total <strong>disposal proceeds</strong> exceed four times the annual exempt amount (4 × £3,000 = <strong>£12,000</strong> for 2025-26)</li>
        <li>You have <strong>chargeable gains</strong> that exceed the annual exempt amount (£3,000)</li>
        <li>You want to <strong>claim an allowable loss</strong> against gains in the current or future years</li>
        <li>You have already registered for Self Assessment and have disposals to report</li>
      </ul>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg my-6 not-prose">
        <p className="text-sm text-amber-900">
          <strong>Common mistake:</strong> Many investors think they only need to report if they have a tax liability. This is not true — you must report if your proceeds exceed £12,000, even if your gains are within the annual exempt amount and no tax is due.
        </p>
      </div>

      <h2>The SA108 Boxes Explained</h2>
      <p>
        The SA108 form has many boxes, but for shares and securities, only certain boxes are relevant. Here is a walkthrough of each one you are likely to need:
      </p>

      <h3>Box 3 — Number of Disposals</h3>
      <p>
        Enter the total number of sell transactions you made during the tax year. If you sold 5 different holdings, enter 5. If you made multiple sales of the same share on different dates, each sale counts as a separate disposal.
      </p>

      <h3>Box 4 — Disposal Proceeds</h3>
      <p>
        Enter the total amount of money you received from all disposals combined. This is the gross proceeds before deducting any costs. For example, if you sold £3,000 of Vodafone and £5,000 of Barclays, enter £8,000.
      </p>

      <h3>Box 5 — Allowable Costs (including Purchase Price)</h3>
      <p>
        Enter the total allowable cost of all disposals. This includes the original purchase price of the shares sold (calculated using the <Link href="/guide/section-104-pool">Section 104 pool</Link>, same-day, or <Link href="/guide/bed-and-breakfast-rule">30-day B&amp;B matching</Link>), plus any incidental costs of acquisition and disposal (broker fees, stamp duty).
      </p>

      <h3>Box 6 — Gains in the Year Before Losses</h3>
      <p>
        Add up <strong>only the gains</strong> from individual disposals where you made a profit. Do not net off losses here — report them separately. For example, if you had gains of £2,000, £500, and a loss of £300, enter £2,500 (only the gains).
      </p>

      <h3>Box 34 — Total Losses of the Year</h3>
      <p>
        Enter the total of all individual losses from disposals in the tax year. Using the example above, enter £300. Losses are offset against gains automatically by HMRC.
      </p>

      <h3>Box 35 — Losses Brought Forward and Used Against Gains</h3>
      <p>
        If you have capital losses from previous tax years that you want to use this year, enter the amount here. You can only use enough losses to reduce your net gains to the annual exempt amount — you cannot create an artificial loss by over-claiming.
      </p>

      <h3>Box 36 — Net Gains (after Losses and Annual Exempt Amount)</h3>
      <p>
        This is Box 6 minus Box 34 minus Box 35 minus the annual exempt amount (£3,000). This is the amount on which CGT is payable. If this figure is zero or negative, no tax is due.
      </p>

      <h3>Boxes 37 and 38 — CGT Due</h3>
      <p>
        These boxes split your taxable gain between the basic rate portion (18%) and the higher rate portion (24%). The split depends on how much of the basic rate band remains after your income. See our <Link href="/guide/cgt-rates-2025-26">CGT rates guide</Link> for a detailed worked example.
      </p>

      <h2>The 31 January Deadline</h2>
      <p>
        The Self Assessment filing deadline is <strong>31 January</strong> following the end of the tax year. For the 2025-26 tax year (ending 5 April 2026), the filing and payment deadline is <strong>31 January 2027</strong>.
      </p>
      <p>
        If you file online, HMRC will calculate the tax due for you based on the figures you enter. However, it is your responsibility to ensure the figures are correct. Late filing attracts an automatic £100 penalty, with additional penalties for continued delays.
      </p>

      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6 not-prose">
        <p className="text-sm text-blue-900">
          <strong>Paper vs Online:</strong> If you file by paper, the deadline is earlier — 31 October following the end of the tax year. For 2025-26, this would be 31 October 2026. We strongly recommend filing online.
        </p>
      </div>

      <h2>How CGT Tracker Helps with SA108</h2>
      <p>
        CGT Tracker calculates all the figures you need for the SA108 automatically from your broker CSV. The Reports section generates a PDF reference sheet with the exact values for Boxes 3, 4, 5, 6, 34, and your net gain or loss — ready to copy directly into the HMRC online form.
      </p>

      <h2>Summary Checklist</h2>
      <ul>
        <li>✅ Calculate your total number of disposals → Box 3</li>
        <li>✅ Sum all disposal proceeds → Box 4</li>
        <li>✅ Sum all allowable costs → Box 5</li>
        <li>✅ Sum gains only (not net of losses) → Box 6</li>
        <li>✅ Sum losses only → Box 34</li>
        <li>✅ Deduct losses and annual exempt amount → Box 36</li>
        <li>✅ Split taxable gain by CGT rate → Boxes 37/38</li>
        <li>✅ File online by 31 January 2027</li>
      </ul>
    </GuideLayout>
  )
}

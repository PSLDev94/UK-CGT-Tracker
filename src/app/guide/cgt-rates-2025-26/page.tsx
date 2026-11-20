import styles from "@/components/public-pages.module.css";
import Link from "next/link";
import { Metadata } from "next";
import { adjustment2024Url } from "@/domain/reports/filing-guidance";
import { GuideLayout } from "@/components/guide-layout";

export const metadata: Metadata = {
  title: "UK Capital Gains Tax Rates 2025-26 on Shares",
  description:
    "UK CGT rates on shares for 2025-26: 18% basic rate, 24% higher rate. Includes the October 2024 budget changes and how to calculate your bill.",
  alternates: {
    canonical: "https://www.cgttracker.com/guide/cgt-rates-2025-26",
  },
};

export default function CGTRatesPage() {
  return (
    <GuideLayout
      slug="cgt-rates-2025-26"
      edition="Tax year 2025–26"
      lastUpdated="November 2026"
      nextStep={{ href: "/tools/cgt-allowance-checker", title: "Try the 2025–26 allowance example" }}
      title="UK Capital Gains Tax Rates 2025-26 on Shares"
      breadcrumb="CGT Rates 2025-26"
      relatedGuides={[
        {
          href: "/guide/section-104-pool",
          title: "What is a Section 104 Pool?",
        },
        { href: "/guide/sa108-how-to-fill-in", title: "How to Fill in SA108" },
        {
          href: "/tools/cgt-allowance-checker",
          title: "CGT Allowance Checker",
        },
      ]}
    >
      <p>
        Capital Gains Tax rates on shares and investments in the UK have changed
        significantly over the past few years. The October 2024 Autumn Budget
        introduced the latest changes, increasing rates for disposals from 30
        October 2024 onwards. This guide covers the 2025-26 tax year
        rates, the historical progression, and exactly how your income level
        determines which rate you pay.
      </p>

      <h2 id="current-cgt-rates-for-2025-26">CGT Rates for 2025-26</h2>
      <p>
        For the tax year 6 April 2025 to 5 April 2026, the CGT rates on shares,
        where the main rates apply are:
      </p>
      <ul>
        <li>
          <strong>Gains within any unused basic-rate band:</strong> 18%
        </li>
        <li>
          <strong>Gains above the available basic-rate band:</strong> 24%
        </li>
      </ul>
      <p>
        For eligible individuals the <strong>annual exempt amount</strong> in
        2025–26 is <strong>£3,000</strong>. A claim for the foreign income and
        gains regime or Overseas Workday Relief removes the allowance for that
        year.{" "}
        <a href="https://www.gov.uk/guidance/capital-gains-tax-rates-and-allowances">
          Check HMRC’s eligibility rules
        </a>.
      </p>

      <h2>Historical Rate Table</h2>
      <div
        className="overflow-x-auto my-6 not-prose"
        tabIndex={0}
        role="region"
        aria-label="Worked example"
      >
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-semibold text-gray-700">
                Tax Year
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">
                Annual Exempt Amount
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">
                Basic Rate
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">
                Higher Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="px-4 py-2">2021-22</td>
              <td className="px-4 py-2">£12,300</td>
              <td className="px-4 py-2">10%</td>
              <td className="px-4 py-2">20%</td>
            </tr>
            <tr>
              <td className="px-4 py-2">2022-23</td>
              <td className="px-4 py-2">£12,300</td>
              <td className="px-4 py-2">10%</td>
              <td className="px-4 py-2">20%</td>
            </tr>
            <tr>
              <td className="px-4 py-2">2023-24</td>
              <td className="px-4 py-2">£6,000</td>
              <td className="px-4 py-2">10%</td>
              <td className="px-4 py-2">20%</td>
            </tr>
            <tr>
              <td className="px-4 py-2">2024-25 (before 30 Oct)</td>
              <td className="px-4 py-2">£3,000</td>
              <td className="px-4 py-2">10%</td>
              <td className="px-4 py-2">20%</td>
            </tr>
            <tr>
              <td className="px-4 py-2">2024-25 (from 30 Oct)</td>
              <td className="px-4 py-2">£3,000</td>
              <td className="px-4 py-2">18%</td>
              <td className="px-4 py-2">24%</td>
            </tr>
            <tr className="bg-blue-50 font-medium">
              <td className="px-4 py-2">2025-26</td>
              <td className="px-4 py-2">£3,000</td>
              <td className="px-4 py-2">18%</td>
              <td className="px-4 py-2">24%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        The annual exempt amount fell from £12,300 in 2022–23 to £3,000 in
        2024–25. The main rates on share gains rose from 10% to 18% and from
        20% to 24% on 30 October 2024.
      </p>

      <h2>The October 2024 Mid-Year Rate Change</h2>
      <p>
        The 2024-25 tax year is uniquely complicated because the Autumn Budget
        on 30 October 2024 increased CGT rates <em>during</em> the tax year.
        Ordinary share disposals before 30 October 2024 use the old main rates (10%/20%),
        while disposals on or after 30 October 2024 are taxed at the new rates
        (18%/24%).
      </p>
      <p>
        Keep gains on each side of 30 October separate using the dates in your
        disposal evidence. Even if every sale was after the change, the 2024–25
        Self Assessment calculation can need a tax adjustment in SA108 box 51.
        Check your filing software and your eligibility for{" "}
        <a href={adjustment2024Url}>HMRC’s 2024–25 adjustment calculator</a>.
      </p>

      <h2>How Your Income Determines Your CGT Rate</h2>
      <p>
        For 2025–26, start with your taxable income after your Personal
        Allowance and any applicable income tax reliefs. If your tax
        calculation already gives you taxable income, use that figure directly.
        If you start with gross income, deduct the allowances and reliefs you
        actually qualify for once. The standard Personal Allowance was £12,570,
        but your allowance can differ.
      </p>
      <ol>
        <li>Find the part of your basic-rate band left after taxable income.
          The standard band was £37,700 for 2025–26.</li>
        <li>Work out your taxable gains after allowable losses and any annual
          exempt amount you qualify for.</li>
        <li>Apply 18% to taxable share gains that fit in the remaining band
          and 24% to the balance. <a href="https://www.gov.uk/capital-gains-tax/rates">
            Check HMRC’s Capital Gains Tax rates</a>.</li>
      </ol>
      <p>
        For example, £36,000 of already-taxable income leaves £1,700 of the
        standard band. With £10,000 of taxable share gains, the tax is
        £306 on the first £1,700 and £1,992 on the remaining £8,300,
        giving £2,298.
      </p>

      <h3>Worked Example: Mixed Rate Calculation</h3>
      <p>
        David starts with a gross salary of £45,000 and share gains of £10,000
        in 2025–26. He qualifies for the standard Personal Allowance and the
        £3,000 annual exempt amount and has no other income, reliefs or losses.
      </p>
      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>
            • <strong>Taxable income:</strong> £45,000 − £12,570 = £32,430
          </li>
          <li>
            • <strong>Basic rate band remaining:</strong> £37,700 − £32,430 ={" "}
            <strong>£5,270</strong>
          </li>
          <li>
            • <strong>Capital gains after exemption:</strong> £10,000 − £3,000 ={" "}
            <strong>£7,000</strong> taxable
          </li>
          <li>
            • <strong>First £5,270 of gains:</strong> taxed at 18% ={" "}
            <strong>£948.60</strong>
          </li>
          <li>
            • <strong>Remaining £1,730 of gains:</strong> taxed at 24% ={" "}
            <strong>£415.20</strong>
          </li>
          <li>
            • <strong>Total CGT due:</strong> £948.60 + £415.20 ={" "}
            <strong>£1,363.80</strong>
          </li>
        </ul>
      </div>
      <p>
        If David were entirely a higher rate taxpayer (income above £50,270),
        the entire £7,000 taxable gain would be taxed at 24% = £1,680. Being a
        mixed-rate taxpayer saves him £316.20.
      </p>

      <h2>Allowances, losses and reliefs</h2>
      <p>Check which allowances and reliefs you qualify for before using a rate estimate.</p>

      <h3>1. Use Your Annual Exempt Amount</h3>
      <p>
        Each eligible spouse or civil partner has their own allowance. Check
        each person’s eligibility and ownership of the shares when working out
        their gains.
      </p>

      <h3>2. Bed and ISA</h3>
      <p>
        A sale in a taxable account counts as a disposal even if you then buy
        shares in an ISA. Gains on the ISA holding are exempt from UK CGT. Read more about this
        and other strategies in our{" "}
        <Link href="/guide/bed-and-breakfast-rule">
          bed and breakfast rule guide
        </Link>
        .
      </p>

      <h3>3. Offset Losses</h3>
      <p>
        Claim an allowable loss with HMRC, usually within four years after the
        end of the tax year in which you made it. Deduct claimed losses from
        gains in the same year first. If gains still exceed your annual exempt
        amount, use claimed losses brought forward only to reduce gains to that
        amount. Carry unused claimed losses forward.{" "}
        <a href="https://www.gov.uk/capital-gains-tax/losses">Read HMRC’s guidance on claiming losses</a>.
      </p>

      <h3>4. Time Your Disposals</h3>
      <p>
        A sale on 5 April and a sale on 6 April fall into different tax years.
        A qualifying repurchase in April or May can still change the cost of
        shares sold in the previous tax year.
      </p>

      <h3>5. Pension Contributions</h3>
      <p>
        How a contribution affects your tax calculation depends on how the pension
        receives relief. For example, qualifying relief-at-source contributions
        can extend your basic-rate band. Check your tax computation before
        using the allowance checker, which assumes the standard band.
      </p>

      <div className={`${styles.referenceBox} my-8 not-prose`}>
        <p className="text-sm text-green-900">
          <strong>Know your position:</strong> Use our free{" "}
          <Link
            href="/tools/cgt-allowance-checker"
            className="underline font-medium"
          >
            CGT allowance checker
          </Link>{" "}
          to instantly see how much of your £3,000 exemption remains and what
          your estimated tax bill looks like.
        </p>
      </div>
    </GuideLayout>
  );
}

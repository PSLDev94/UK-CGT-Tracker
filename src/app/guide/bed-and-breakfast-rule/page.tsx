import styles from "@/components/public-pages.module.css";
import Link from "next/link";
import { Metadata } from "next";
import { GuideLayout } from "@/components/guide-layout";

export const metadata: Metadata = {
  title: "The 30-Day Bed & Breakfast Rule: UK CGT Guide 2025-26",
  description:
    "Sold shares and bought them back within 30 days? HMRC's bed and breakfast rule changes how your gain is calculated. Full guide with examples.",
  alternates: {
    canonical: "https://www.cgttracker.com/guide/bed-and-breakfast-rule",
  },
};

export default function BedAndBreakfastRulePage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the 30-day bed and breakfast rule?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Same-day purchases take priority. Then match eligible purchases of the same class in the same company in the next 30 days, earliest first. The Section 104 pool provides the cost for shares still outstanding where a holding is available.",
        },
      },
      {
        "@type": "Question",
        name: "Does the bed and breakfast rule apply to ISA shares?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "ISA holdings are outside taxable share matching. Selling shares in a taxable account remains a disposal, but a purchase inside an ISA is not matched to it under the 30-day rule. ISA eligibility and subscription limits still apply.",
        },
      },
      {
        "@type": "Question",
        name: "How do I avoid triggering the bed and breakfast rule?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A repurchase on day 31 is outside the 30-day window for that sale. The rule looks at beneficial ownership, the capacity in which the shares are held and UK residence when the shares are acquired. Changing the broker or the name on an account does not by itself change the owner.",
        },
      },
    ],
  };

  return (
    <GuideLayout
      slug="bed-and-breakfast-rule"
      edition="Share matching"
      nextStep={{ href: "/tools/bed-and-breakfast-calculator", title: "Check a sale and repurchase" }}
      title="The 30-Day Bed & Breakfast Rule: UK CGT Guide 2025-26"
      breadcrumb="Bed & Breakfast Rule"
      relatedGuides={[
        {
          href: "/guide/section-104-pool",
          title: "What is a Section 104 Pool?",
        },
        { href: "/guide/cgt-rates-2025-26", title: "UK CGT Rates 2025-26" },
        {
          href: "/tools/bed-and-breakfast-calculator",
          title: "Free B&B Calculator",
        },
      ]}
      jsonLd={[faqLd]}
    >
      <p>
        A sale is still a disposal if you buy the same shares back within 30 days.
        The repurchase can change the cost used to work out your gain or loss.
        The <strong>30-day bed and breakfast rule</strong>{" "}
        (formally known as the &ldquo;identification rule&rdquo;) overrides the
        normal <Link href="/guide/section-104-pool">Section 104 pool</Link>{" "}
        matching and instead matches your sale against the repurchase. This
        fundamentally changes how your gain or loss is calculated.
      </p>

      <h2>Why Does the Rule Exist?</h2>
      <p>
        The name &ldquo;bed and breakfast&rdquo; comes from a practice that was
        common before 1998: an investor would sell shares just before the end of
        the tax year (&ldquo;put them to bed&rdquo;) to crystallise a loss and
        reduce their CGT bill, then buy the same shares back the next morning
        (&ldquo;at breakfast&rdquo;). The investor&apos;s economic position was
        unchanged — they still owned the same shares — but they&apos;d claimed a
        tax loss.
      </p>
      <p>
        HMRC closed this loophole by introducing the 30-day rule. If you sell
        and repurchase within 30 calendar days, the disposal cost is set to the{" "}
        <strong>repurchase price</strong>, not the original pool cost. This
        typically eliminates the artificial loss.
      </p>

      <div className={`${styles.referenceBox} my-6 not-prose`}>
        <p className="text-sm text-amber-900">
          <strong>Key point:</strong> The 30-day window starts from the day{" "}
          <em>after</em> the sale. If you sell on 1 June, the rule applies to
          an eligible repurchase between 2 June and 1 July (inclusive). A repurchase on
          2 July would be outside the window.
        </p>
      </div>

      <h2>How the Rule Works — Step by Step</h2>
      <ol>
        <li>Start with shares sold that are still unmatched after checking same-day purchases.</li>
        <li>
          Check purchases of the same class in the same company by the same
          person in the same capacity during the next 30 calendar days, earliest
          first. UK residence at the time of the purchase matters. Include
          purchases at other taxable brokers.{" "}
          <a href="https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560">See HMRC’s matching rules</a>.
        </li>
        <li>
          Use each purchase to match as many outstanding shares as it covers.
          Its acquisition cost applies to that matched quantity.
        </li>
        <li>
          After checking all eligible purchases, use the Section 104 pool for
          the remaining shares where you have a holding.
        </li>
      </ol>

      <h2>Example 1: A Loss Being Reduced</h2>
      <p>
        James owns 500 shares of Vodafone (VOD) in his{" "}
        <Link href="/guide/section-104-pool">Section 104 pool</Link> with a
        total cost of £1,250 (average cost £2.50 per share). He decides to sell
        and rebuy:
      </p>

      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <h4 className="font-bold text-gray-900 mb-3">Timeline</h4>
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>
            • <strong>1 March:</strong> James sells 500 shares at £2.00 each =
            £1,000 proceeds
          </li>
          <li>
            • <strong>Without B&amp;B rule:</strong> Gain = £1,000 − £1,250 ={" "}
            <strong className="text-red-600">−£250 loss</strong>
          </li>
          <li>
            • <strong>15 March:</strong> James buys 500 shares at £2.10 each =
            £1,050 cost
          </li>
          <li>
            • <strong>With B&amp;B rule:</strong> The sale is matched to the 15
            March purchase
          </li>
          <li>
            • <strong>Actual gain:</strong> £1,000 − £1,050 ={" "}
            <strong className="text-red-600">−£50 loss</strong>
          </li>
        </ul>
      </div>
      <p>
        The B&amp;B rule has reduced James&apos;s loss from £250 to just £50.
        This is exactly what HMRC intends — James&apos;s economic position
        barely changed (he sold at £2.00 and rebought at £2.10), so the tax
        relief should reflect the true economic movement, not the artificial
        comparison to his original cost.
      </p>

      <h2>Example 2: A Gain Being Affected</h2>
      <p>
        Emma owns 200 shares of Barclays (BARC) with a pool cost of £600 (£3.00
        per share). She sells and rebuys at a lower price:
      </p>

      <div className="bg-gray-50 border rounded-lg p-6 my-6 not-prose">
        <h4 className="font-bold text-gray-900 mb-3">Timeline</h4>
        <ul className="space-y-2 text-gray-700 text-sm">
          <li>
            • <strong>10 July:</strong> Emma sells 200 shares at £5.00 each =
            £1,000 proceeds
          </li>
          <li>
            • <strong>Without B&amp;B rule:</strong> Gain = £1,000 − £600 ={" "}
            <strong className="text-green-700">£400 gain</strong>
          </li>
          <li>
            • <strong>25 July:</strong> Emma buys 200 shares at £4.50 each =
            £900 cost
          </li>
          <li>
            • <strong>With B&amp;B rule:</strong> The sale is matched to the 25
            July purchase
          </li>
          <li>
            • <strong>Actual gain:</strong> £1,000 − £900 ={" "}
            <strong className="text-green-700">£100 gain</strong>
          </li>
        </ul>
      </div>
      <p>
        In this case, the B&amp;B rule actually <em>reduces</em> Emma&apos;s
        gain (from £400 to £100) because she repurchased at a lower price. The
        remaining pool cost of £600 is preserved for future disposals. That cost will be available for a later sale matched to the pool.
      </p>

      <h2>
        ISAs, pensions and shares owned by a spouse
      </h2>
      <p>
        The tax treatment depends on who beneficially owns each holding and
        whether it is in a taxable account.
      </p>

      <h3>Bed and ISA</h3>
      <p>
        A sale in your general investment account remains a taxable disposal.
        A purchase inside your Stocks &amp; Shares ISA is outside personal taxable
        share matching. Check any other purchases in your taxable accounts.
      </p>

      <h3>Bed and SIPP</h3>
      <p>
        A purchase inside a registered pension falls outside your personal
        taxable share pool. Contribution relief and pension withdrawals have
        separate rules. Include the sale made through your taxable account.
      </p>

      <h3>Bed and Spouse</h3>
      <p>
        A sale by one person and a genuine purchase by their spouse is different
        from the same person selling and buying back. Simply transferring shares
        to a spouse who then sells and repurchases does not avoid their own
        30-day matching. Ownership, transfer and connected-person rules matter;
        get advice before arranging a transaction.
      </p>

      <div className={`${styles.referenceBox} my-6 not-prose`}>
        <p className="text-sm text-blue-900">
          <strong>Want to check if the B&amp;B rule applies?</strong> Use our
          free{" "}
          <Link
            href="/tools/bed-and-breakfast-calculator"
            className="underline font-medium"
          >
            bed and breakfast rule calculator
          </Link>{" "}
          to compare one sale with one repurchase and see the gain or loss
          before fees on the matched quantity.
        </p>
      </div>

      <h2>Key Points to Remember</h2>
      <ul>
        <li>
          The 30-day window is <strong>calendar days</strong>, not business days
          — weekends and bank holidays count.
        </li>
        <li>
          The rule applies per security — selling Vodafone and buying Barclays
          within 30 days does <strong>not</strong> trigger the rule.
        </li>
        <li>
          If one purchase covers only part of the sale, check every other
          eligible purchase within the 30-day window before using the Section
          104 pool.
        </li>
        <li>
          The same-day rule takes priority over the 30-day rule. If you buy and
          sell on the same day, those are matched first.
        </li>
        <li>
          B&amp;B matched acquisitions are <strong>not</strong> added to the
          Section 104 pool — they are entirely consumed by the match.
        </li>
      </ul>

      <h2>How CGT Tracker Handles This</h2>
      <p>
        CGT Tracker automatically detects bed and breakfast matches when
        processing your broker CSV. The engine applies HMRC&apos;s matching
        rules in the correct priority order: same-day first, then 30-day
        B&amp;B, then Section 104 pool. Each matched disposal is clearly
        labelled in your tax report, so you can verify exactly how each gain or
        loss was calculated.
      </p>
    </GuideLayout>
  );
}

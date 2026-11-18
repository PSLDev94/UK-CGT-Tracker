import Link from "next/link";
import { Metadata } from "next";
import { GuideLayout } from "@/components/guide-layout";
import { CgtReportingGuidance } from "@/components/cgt-reporting-guidance";

export const metadata: Metadata = {
  title: "How to Fill in SA108 for Shares and Investments",
  description:
    "Step-by-step guide to completing the HMRC SA108 supplementary page for capital gains from shares. Which boxes to fill, what figures to use, and the 31 January deadline.",
  alternates: {
    canonical: "https://www.cgttracker.com/guide/sa108-how-to-fill-in",
  },
};

export default function SA108GuidePage() {
  return (
    <GuideLayout
      slug="sa108-how-to-fill-in"
      edition="Tax year 2025–26"
      lastUpdated="November 2026"
      nextStep={{ href: "/dashboard/reports", title: "View your saved reports" }}
      title="How to Fill in SA108 for Shares and Investments"
      breadcrumb="SA108 Guide"
      relatedGuides={[
        {
          href: "/guide/section-104-pool",
          title: "What is a Section 104 Pool?",
        },
        { href: "/guide/cgt-rates-2025-26", title: "UK CGT Rates 2025-26" },
        {
          href: "/guide/bed-and-breakfast-rule",
          title: "The 30-Day Bed & Breakfast Rule",
        },
      ]}
    >
      <p>
        The <strong>SA108</strong> is the Capital Gains supplementary page of
        the HMRC Self Assessment tax return. If you have sold shares, ETFs, or
        other investments during the tax year and need to report capital gains,
        this is the form you need to complete. This guide walks you through each
        relevant box with plain-English explanations.
      </p>

      <h2>When Must You Report?</h2>
      <CgtReportingGuidance />
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg my-6 not-prose">
        <p className="text-sm text-amber-900">
          This guide describes the 2025–26 form. Use the form and notes for the
          year you are filing. Different assets, reliefs and residence rules can
          require different sections.
        </p>
      </div>
      <h2>The SA108 Boxes Explained</h2>
      <p>
        On the 2025–26 form, ordinary listed shares use the listed shares
        section. Boxes 23 to 27 cover disposal counts, sale proceeds, permitted
        costs, positive gains and losses respectively. Report gains and losses
        separately. Retain the matching computations behind the figures.
      </p>
      <h3>Choose the Correct Asset Section</h3>
      <p>
        Unlisted shares and securities have their own section, beginning at box
        31. Residential property uses a separate section. Claims and elections
        may change which section applies; follow the notes rather than copying a
        portfolio total into every box.
      </p>
      <h3>Losses and Adjustments</h3>
      <p>
        Earlier-year losses used this year belong in box 45; losses available
        for later years belong in box 47. Review eligibility and the ordering of
        losses before calculating the taxable amount.
      </p>
      <h3>Supporting Calculations</h3>
      <p>
        Keep an explanation of same-day, 30-day and{" "}
        <Link href="/guide/section-104-pool">Section 104 matching</Link>. The
        form requires computations as well as the summary. CGT Tracker’s preview
        is not a completed return.
      </p>
      <p>
        <a href="https://www.gov.uk/government/publications/self-assessment-capital-gains-summary-sa108">
          Download the official SA108 form and year-specific notes
        </a>
        .
      </p>
      <h2>The 31 January Deadline</h2>
      <p>
        The Self Assessment filing deadline is <strong>31 January</strong>{" "}
        following the end of the tax year. For the 2025-26 tax year (ending 5
        April 2026), the filing and payment deadline is{" "}
        <strong>31 January 2027</strong>.
      </p>
      <p>
        If you file online, HMRC will calculate the tax due for you based on the
        figures you enter. However, it is your responsibility to ensure the
        figures are correct. Late filing attracts an automatic £100 penalty,
        with additional penalties for continued delays.
      </p>

      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg my-6 not-prose">
        <p className="text-sm text-blue-900">
          <strong>Paper vs Online:</strong> If you file by paper, the deadline
          is earlier — 31 October following the end of the tax year. For
          2025-26, this would be 31 October 2026. We strongly recommend filing
          online.
        </p>
      </div>

      <h2>How CGT Tracker Helps with SA108</h2>
      <p>
        Download the disposal and share-matching evidence as a free CSV. The
        annual subscription also includes a summary PDF and a detailed evidence
        PDF. Use these records with the current HMRC form and notes for your
        tax year to complete your own return.
      </p>

      <h2>Summary Checklist</h2>
      <ul>
        <li>Use the correct tax-year form and asset section.</li>
        <li>Reconcile disposals, proceeds and costs with your records.</li>
        <li>Keep gains and losses separate and check reliefs.</li>
        <li>Attach the required computations.</li>
        <li>Check the filing and payment deadlines.</li>
      </ul>
    </GuideLayout>
  );
}

import styles from "@/components/public-pages.module.css";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "UK Capital Gains Tax Guide for Investors",
  description:
    "A plain-English guide to UK Capital Gains Tax rules for self-directed investors. Learn about the Section 104 pool, 30-day bed and breakfast rule, annual exempt amounts, and how to report on your SA108 self-assessment.",
  alternates: { canonical: "https://www.cgttracker.com/guide" },
};

const GUIDE_PAGES = [
  {
    href: "/guide/section-104-pool",
    title: "What is a Section 104 Pool?",
    description:
      "How HMRC pools your share purchases into a single cost basis — with worked examples.",
  },
  {
    href: "/guide/bed-and-breakfast-rule",
    title: "The 30-Day Bed & Breakfast Rule",
    description:
      "Sold and rebought within 30 days? This anti-avoidance rule changes how your gain is calculated.",
  },
  {
    href: "/guide/cgt-rates-2025-26",
    title: "UK CGT Rates 2025-26",
    description:
      "Rates and annual exempt amounts for the 2025–26 tax year, with worked examples.",
  },
  {
    href: "/guide/sa108-how-to-fill-in",
    title: "How to Fill in SA108",
    description:
      "Step-by-step walkthrough of the HMRC SA108 supplementary page for capital gains from shares.",
  },
  {
    href: "/guide/trading-212-cgt",
    title: "Trading 212 CGT Guide",
    description:
      "How to export your Trading 212 transaction history and calculate your capital gains tax.",
  },
  {
    href: "/guide/hargreaves-lansdown-cgt",
    title: "Hargreaves Lansdown CGT Guide",
    description:
      "Export HL transactions and verify price units and fees with contract notes.",
  },
  {
    href: "/guide/freetrade-cgt",
    title: "Freetrade CGT Guide",
    description:
      "Step-by-step guide to exporting your Freetrade CSV and calculating CGT correctly.",
  },
];

export default function GuidePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://www.cgttracker.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "CGT Guide",
        item: "https://www.cgttracker.com/guide",
      },
    ],
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicNav />

      <main id="main" tabIndex={-1} className={styles.frame}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/" className="hover:text-gray-900 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-900 font-medium">CGT Guide</span>
        </nav>

        <h1 className={styles.taskHeading}>
          UK Capital Gains Tax Guide
        </h1>
        <p className={styles.intro}>
          A plain-English guide to CGT for UK self-directed investors. Click any
          topic below for worked examples, or <Link className="text-blue-700 underline" href="/supported-brokers">find the export instructions for your broker</Link>.
        </p>
        <p className={styles.edition}>Last updated: April 2026</p>

        <ul className={styles.index} aria-label="Guide topics">
          {GUIDE_PAGES.map((page) => (
            <li key={page.href}>
              <Link href={page.href}>
                <h2>{page.title}</h2>
                <p>{page.description}</p>
                <span>Read guide <ArrowRight size={16} aria-hidden="true" /></span>
              </Link>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <section className={styles.callToAction}>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Ready to calculate your CGT?
          </h2>
          <p className="text-gray-600 mb-6">
            Review a supported broker CSV and trace the share-matching evidence.
          </p>
          <Link
            href="/signup"
            className={styles.action}
          >
            Create a free account
          </Link>
          <p className="text-sm text-gray-600 mt-3">
            Relaunch preview. No live payments.
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

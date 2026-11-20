import styles from "@/components/public-pages.module.css";
import { Children, cloneElement, isValidElement } from "react";
import Link from "next/link";
import { ChevronRight, ArrowRight } from "lucide-react";
import { PublicNav } from "./public-nav";
import { PublicFooter } from "./public-footer";

interface RelatedGuide {
  href: string;
  title: string;
}

interface GuideLayoutProps {
  title: string;
  slug: string;
  nextStep: RelatedGuide;
  edition: string;
  breadcrumb: string;
  lastUpdated?: string;
  relatedGuides: RelatedGuide[];
  children: React.ReactNode;
  jsonLd?: object[];
}

export function GuideLayout({
  title,
  slug,
  nextStep,
  edition,
  breadcrumb,
  lastUpdated = "April 2026",
  relatedGuides,
  children,
  jsonLd = [],
}: GuideLayoutProps) {
  const contents: { id: string; title: string }[] = [];
  const article = Children.map(children, (child) => {
    if (
      !isValidElement<{ children: unknown; id?: string; className?: string }>(
        child,
      ) ||
      child.type !== "h2" ||
      typeof child.props.children !== "string"
    )
      return child;
    const title = child.props.children.trim();
    const id =
      child.props.id ??
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-$/, "");
    contents.push({ id, title });
    return cloneElement(child, { id, className: "scroll-mt-20" });
  });
  const breadcrumbLd = {
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
      {
        "@type": "ListItem",
        position: 3,
        name: breadcrumb,
        item: `https://www.cgttracker.com/guide/${slug}`,
      },
    ],
  };

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    datePublished: "2026-04-01",
    dateModified: "2026-11-18",
    author: { "@type": "Organization", name: "CGT Tracker" },
    publisher: {
      "@type": "Organization",
      name: "CGT Tracker",
      url: "https://www.cgttracker.com",
    },
  };

  return (
    <div className={styles.page}>
      {[breadcrumbLd, articleLd, ...jsonLd].map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}
      <PublicNav />

      <main id="main" tabIndex={-1} className={`${styles.frame} ${styles.articleWrap}`}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/" className="hover:text-gray-900 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/guide" className="hover:text-gray-900 transition-colors">
            CGT Guide
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-900 font-medium">{breadcrumb}</span>
        </nav>

        <h1 className={styles.articleTitle}>
          {title}
        </h1>
        <p className={styles.edition}>
          {edition} · Article edition {lastUpdated}
        </p>

        <div className={styles.referenceBox}>
          {nextStep.href.startsWith("/supported-brokers#") ? (
            <Link href={nextStep.href} className="underline">{nextStep.title}</Link>
          ) : (
            <Link href="/supported-brokers" className="underline">Check current broker support</Link>
          )}
          . Check the share matching rules for your tax year with{" "}
          <a
            className="underline"
            href="https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet/hs284-shares-and-capital-gains-tax-2026"
          >
            HMRC HS284
          </a>
          .
        </div>
        <details className={`guide-contents ${styles.contents}`}>
          <summary className="cursor-pointer font-semibold">
            On this page
          </summary>
          <ul className="mt-3 space-y-1 text-blue-700">
            {contents.map((section) => (
              <li key={section.id}>
                <a
                  className="inline-block py-1 underline"
                  href={`#${section.id}`}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
        <article className={`guide-article ${styles.article}`}>{article}</article>

        {/* Related Guides */}
        {relatedGuides.length > 0 && (
          <section className={styles.related}>
            <h2 className={styles.subheading}>Related Guides</h2>
            <ul>
              {relatedGuides.map((g) => (
                <li key={g.href}>
                  <Link href={g.href}>
                    {g.title} <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTA */}
        <section className={styles.callToAction}>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Put this guide into practice
          </h2>
          <Link
            href={nextStep.href}
            className={styles.action}
          >
            {nextStep.title}
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

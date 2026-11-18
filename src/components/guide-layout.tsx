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
    <div className="min-h-screen bg-white">
      {[breadcrumbLd, articleLd, ...jsonLd].map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}
      <PublicNav />

      <main id="main" className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-500 mb-8 flex-wrap">
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

        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3 leading-tight">
          {title}
        </h1>
        <p className="text-sm text-gray-500 mb-10">
          {edition} · Article edition {lastUpdated}
        </p>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 text-sm text-blue-900">
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
        <details className="mb-8 rounded-xl border border-gray-200 px-5 py-3">
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
        <article className="guide-article">{article}</article>

        {/* Related Guides */}
        {relatedGuides.length > 0 && (
          <section className="mt-16 pt-8 border-t border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Related Guides
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {relatedGuides.map((g) => (
                <Link
                  key={g.href}
                  href={g.href}
                  className="group flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors border border-gray-100"
                >
                  <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    {g.title}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="mt-12 bg-blue-50 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Put this guide into practice
          </h2>
          <Link
            href={nextStep.href}
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
          >
            {nextStep.title}
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

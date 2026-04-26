import Link from 'next/link'
import { ChevronRight, ArrowRight } from 'lucide-react'
import { PublicNav } from './public-nav'
import { PublicFooter } from './public-footer'

interface RelatedGuide {
  href: string
  title: string
}

interface GuideLayoutProps {
  title: string
  breadcrumb: string
  lastUpdated?: string
  relatedGuides: RelatedGuide[]
  children: React.ReactNode
  jsonLd?: object[]
}

export function GuideLayout({ title, breadcrumb, lastUpdated = 'April 2026', relatedGuides, children, jsonLd = [] }: GuideLayoutProps) {
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.cgttracker.com' },
      { '@type': 'ListItem', position: 2, name: 'CGT Guide', item: 'https://www.cgttracker.com/guide' },
      { '@type': 'ListItem', position: 3, name: breadcrumb, item: `https://www.cgttracker.com/guide` },
    ],
  }

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    datePublished: '2026-04-01',
    dateModified: '2026-04-26',
    author: { '@type': 'Organization', name: 'CGT Tracker' },
    publisher: { '@type': 'Organization', name: 'CGT Tracker', url: 'https://www.cgttracker.com' },
  }

  return (
    <div className="min-h-screen bg-white">
      {[breadcrumbLd, articleLd, ...jsonLd].map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}
      <PublicNav />

      <main className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-8 flex-wrap">
          <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/guide" className="hover:text-gray-900 transition-colors">CGT Guide</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-900 font-medium">{breadcrumb}</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3 leading-tight">{title}</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: {lastUpdated}</p>

        <article className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-table:text-sm">
          {children}
        </article>

        {/* Related Guides */}
        {relatedGuides.length > 0 && (
          <section className="mt-16 pt-8 border-t border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Related Guides</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {relatedGuides.map((g) => (
                <Link key={g.href} href={g.href} className="group flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors border border-gray-100">
                  <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{g.title}</span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="mt-12 bg-blue-50 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to calculate your exact CGT position?</h2>
          <p className="text-gray-600 mb-6">Upload your broker CSV and get your SA108 figures in minutes.</p>
          <Link href="/signup" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors">
            Start free trial
          </Link>
          <p className="text-sm text-gray-500 mt-3">14-day free trial. No credit card required.</p>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

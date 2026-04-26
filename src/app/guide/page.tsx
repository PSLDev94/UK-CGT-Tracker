import Link from 'next/link'
import { BookOpen, ArrowRight, ChevronRight } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'UK Capital Gains Tax Guide for Investors',
  description: 'A plain-English guide to UK Capital Gains Tax rules for self-directed investors. Learn about the Section 104 pool, 30-day bed and breakfast rule, annual exempt amounts, and how to report on your SA108 self-assessment.',
  alternates: { canonical: 'https://www.cgttracker.com/guide' },
}

const GUIDE_PAGES = [
  {
    href: '/guide/section-104-pool',
    title: 'What is a Section 104 Pool?',
    description: 'How HMRC pools your share purchases into a single cost basis — with worked examples.',
    colour: 'from-blue-500 to-indigo-600',
  },
  {
    href: '/guide/bed-and-breakfast-rule',
    title: 'The 30-Day Bed & Breakfast Rule',
    description: 'Sold and rebought within 30 days? This anti-avoidance rule changes how your gain is calculated.',
    colour: 'from-amber-500 to-orange-600',
  },
  {
    href: '/guide/cgt-rates-2025-26',
    title: 'UK CGT Rates 2025-26',
    description: 'Current rates, annual exempt amounts, and the October 2024 Budget changes explained.',
    colour: 'from-green-500 to-emerald-600',
  },
  {
    href: '/guide/sa108-how-to-fill-in',
    title: 'How to Fill in SA108',
    description: 'Step-by-step walkthrough of the HMRC SA108 supplementary page for capital gains from shares.',
    colour: 'from-purple-500 to-violet-600',
  },
  {
    href: '/guide/trading-212-cgt',
    title: 'Trading 212 CGT Guide',
    description: 'How to export your Trading 212 transaction history and calculate your capital gains tax.',
    colour: 'from-cyan-500 to-blue-600',
  },
  {
    href: '/guide/hargreaves-lansdown-cgt',
    title: 'Hargreaves Lansdown CGT Guide',
    description: 'Export your HL transactions and handle the pence-to-pounds quirk automatically.',
    colour: 'from-blue-600 to-blue-800',
  },
  {
    href: '/guide/freetrade-cgt',
    title: 'Freetrade CGT Guide',
    description: 'Step-by-step guide to exporting your Freetrade CSV and calculating CGT correctly.',
    colour: 'from-pink-500 to-rose-600',
  },
]

export default function GuidePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.cgttracker.com' },
      { '@type': 'ListItem', position: 2, name: 'CGT Guide', item: 'https://www.cgttracker.com/guide' },
    ],
  }

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicNav />

      <main className="max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-900 font-medium">CGT Guide</span>
        </nav>

        <div className="flex items-center mb-3">
          <BookOpen className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-4xl font-extrabold text-gray-900">UK Capital Gains Tax Guide</h1>
        </div>
        <p className="text-lg text-gray-600 mb-4 max-w-3xl">
          A plain-English guide to CGT for UK self-directed investors. Click any topic below to read the full guide with worked examples.
        </p>
        <p className="text-sm text-gray-500 mb-12">Last updated: April 2026</p>

        {/* Guide grid */}
        <div className="grid sm:grid-cols-2 gap-6 mb-20">
          {GUIDE_PAGES.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="group relative bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden"
            >
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${page.colour}`} />
              <h2 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{page.title}</h2>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">{page.description}</p>
              <span className="text-sm font-semibold text-blue-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                Read guide <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <section className="bg-blue-50 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to calculate your CGT?</h2>
          <p className="text-gray-600 mb-6">Upload your broker CSV and get your exact tax position in minutes.</p>
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

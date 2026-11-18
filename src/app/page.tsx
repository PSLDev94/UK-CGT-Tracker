import Link from "next/link";
import { ReportPricing } from "@/components/report-pricing";
import { ANNUAL_REPORT_PRICE } from "@/domain/reports/access";
import { BROKERS, IMPORT_PATH_LABEL, type BrokerId } from "@/domain/imports/brokers";
import {
  ArrowRight,
  CheckCircle,
  Upload,
  Calculator,
  FileText,
  Shield,
  Zap,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import type { Metadata } from "next";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";

export const metadata: Metadata = {
  title: "UK CGT Calculator for Shares | CGT Tracker",
  description:
    "Calculate gains and losses on ordinary shares across taxable broker accounts. Review supported broker CSVs and trace share-matching evidence. Applies HMRC's Section 104, same-day and 30-day rules automatically. Relaunch preview.",
  alternates: { canonical: "https://www.cgttracker.com/" },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CGT Tracker",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "UK ordinary-share gains and losses for self-directed investors. Applies HMRC Section 104 pooling, same-day and 30-day bed and breakfast rules automatically.",
  url: "https://www.cgttracker.com",
};

const ACCENTS: Record<BrokerId, string> = {
  trading212: "from-blue-500 to-cyan-500",
  freetrade: "from-purple-500 to-pink-500",
  hl: "from-blue-700 to-blue-500",
  ii: "from-teal-500 to-emerald-500",
  ibkr: "from-red-500 to-red-400",
  ajbell: "from-green-600 to-green-400",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-blue-100 selection:text-blue-900">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* Navigation */}
      <PublicNav />

      <main id="main">
        {/* Premium Hero Section */}
        <section className="relative pt-12 pb-14 sm:pt-24 sm:pb-24 overflow-hidden px-4">
          {/* Background Gradients */}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white"></div>
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[600px] opacity-20 bg-gradient-to-br from-blue-200 to-indigo-100 blur-[100px] rounded-full mix-blend-multiply pointer-events-none"></div>
          <div className="absolute top-40 left-0 -translate-x-1/2 w-[600px] h-[600px] opacity-20 bg-gradient-to-tr from-cyan-100 to-blue-200 blur-[100px] rounded-full mix-blend-multiply pointer-events-none"></div>

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-1.5 rounded-full text-sm font-medium mb-8 shadow-sm">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Relaunch preview · Tax years through 2026-27
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-8 max-w-4xl mx-auto leading-[1.1]">
              Calculate gains on your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                share sales
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Bring together ordinary shares from your taxable broker accounts. See the proceeds, allowable cost and matching rule behind each gain or loss.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 mb-6">
              <Link
                href="/signup"
                className="group bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-all flex items-center justify-center shadow-xl shadow-blue-600/20 hover:shadow-blue-600/30"
              >
                Try the relaunch preview
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/supported-brokers"
                className="bg-white border border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 transition-all flex items-center justify-center shadow-sm"
              >
                Check my broker
              </Link>
            </div>

            <p className="text-sm text-gray-500 font-medium">
              Free calculations and CSV evidence. PDF reports {ANNUAL_REPORT_PRICE}/year in the sandbox preview. <a href="#preview" className="underline text-blue-700">See a sample calculation</a>.
            </p>
          </div>

          {/* Mock Dashboard UI Preview */}
          <div
            id="preview"
            className="mt-10 sm:mt-16 max-w-5xl mx-auto relative z-20 group perspective-1000"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 to-transparent rounded-2xl blur-xl scale-105 opacity-50 z-0"></div>

            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden relative z-10 ring-1 ring-black/5 transform transition-transform duration-500 hover:scale-[1.01]">
              {/* Mac-style Window header */}
              <div className="bg-gray-50 border-b px-6 py-4 flex justify-between items-center">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Illustrative Tax Year 2025-26 Overview
                </div>
                <div className="w-10"></div> {/* Spacer for symmetry */}
              </div>

              {/* Dashboard Content */}
              <div className="p-4 sm:p-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
                  <div className="bg-white border border-gray-100 rounded-xl p-3 sm:p-5 shadow-sm hover:border-gray-200 transition-colors">
                    <div className="text-sm text-gray-500 mb-1 font-medium">
                      Total Gains
                    </div>
                    <div className="text-lg sm:text-2xl font-bold text-green-700">
                      £2,350.00
                    </div>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-3 sm:p-5 shadow-sm hover:border-gray-200 transition-colors">
                    <div className="text-sm text-gray-500 mb-1 font-medium">
                      Total Losses
                    </div>
                    <div className="text-lg sm:text-2xl font-bold text-red-600">
                      £500.00
                    </div>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-3 sm:p-5 shadow-sm hover:border-gray-200 transition-colors">
                    <div className="text-sm text-gray-500 mb-1 font-medium">
                      Allowable costs
                    </div>
                    <div className="text-lg sm:text-2xl font-bold text-gray-900">
                      £11,950.00
                    </div>

                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-3 sm:p-5 shadow-sm">
                    <div className="text-sm text-blue-800 font-semibold mb-1">
                      Net gain
                    </div>
                    <div className="text-lg sm:text-2xl font-extrabold text-blue-900">
                      £1,850.00
                    </div>
                  </div>
                </div>

                {/* Transactions Table */}
                <div>
                  <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Matched Disposals
                  </h2>
                  <div tabIndex={0} role="region" aria-label="Illustrative matched disposals" className="overflow-x-auto rounded-lg border border-gray-100 shadow-sm">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3.5 font-medium">Date</th>
                          <th className="px-4 py-3.5 font-medium">Asset</th>
                          <th className="px-4 py-3.5 font-medium text-right">
                            Proceeds
                          </th>
                          <th className="px-4 py-3.5 font-medium text-right">
                            Allowable Cost
                          </th>
                          <th className="px-4 py-3.5 font-medium text-right">
                            Gain/Loss
                          </th>
                          <th className="px-4 py-3.5 font-medium">
                            Matching Rule
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white">
                        <tr className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-4 text-gray-600">
                            15 Oct 2025
                          </td>
                          <td className="px-4 py-4 font-semibold text-gray-900">
                            AAPL
                          </td>
                          <td className="px-4 py-4 text-right">£8,500.00</td>
                          <td className="px-4 py-4 text-right text-gray-500">
                            £6,200.00
                          </td>
                          <td className="px-4 py-4 text-right text-green-700 font-bold">
                            +£2,300.00
                          </td>
                          <td className="px-4 py-4">
                            <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">
                              Section 104 Pool
                            </span>
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-4 text-gray-600">
                            02 Nov 2025
                          </td>
                          <td className="px-4 py-4 font-semibold text-gray-900">
                            TSLA
                          </td>
                          <td className="px-4 py-4 text-right">£4,100.00</td>
                          <td className="px-4 py-4 text-right text-gray-500">
                            £4,600.00
                          </td>
                          <td className="px-4 py-4 text-right text-red-600 font-bold">
                            -£500.00
                          </td>
                          <td className="px-4 py-4">
                            <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium border border-blue-100">
                              Bed & Breakfast
                            </span>
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-4 text-gray-600">
                            10 Mar 2026
                          </td>
                          <td className="px-4 py-4 font-semibold text-gray-900">
                            LLOY
                          </td>
                          <td className="px-4 py-4 text-right">£1,200.00</td>
                          <td className="px-4 py-4 text-right text-gray-500">
                            £1,150.00
                          </td>
                          <td className="px-4 py-4 text-right text-green-700 font-bold">
                            +£50.00
                          </td>
                          <td className="px-4 py-4">
                            <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md text-xs font-medium border border-purple-100">
                              Same-Day Rule
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Supported Brokers */}
        <section className="py-16 px-4 bg-gray-50 border-y border-gray-200">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-3">
                Your broker accounts, together
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Documented layouts from all six brokers can be reviewed. Some need
                supporting details from contract notes; unknown layouts stay blocked.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {BROKERS.map((broker) => (
                <Link key={broker.id} href={`/supported-brokers#${broker.id}`} className="relative group">
                  <div className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-lg hover:border-gray-300 transition-all duration-300 hover:-translate-y-0.5">
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${ACCENTS[broker.id]} mx-auto mb-3 flex items-center justify-center shadow-sm`}
                    >
                      <span className="text-white font-bold text-sm">
                        {broker.name.charAt(0)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">
                      {broker.name}
                    </p>
                    <span className="block text-xs text-gray-500 mt-2">
                      {IMPORT_PATH_LABEL[broker.id]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 mt-6">
              <Link
                href="/supported-brokers"
                className="text-blue-600 underline"
              >
                Check broker support
              </Link>{" "}
              for exact formats, exclusions and the reviewed CSV template.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="py-12 sm:py-24 bg-white px-4 border-t border-gray-100">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
                Review your records with confidence
              </h2>
              <p className="text-lg text-gray-600">
                Review every row, investigate unsupported records and follow the
                calculation evidence before filing.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 px-2">
              <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform translate-x-4 -translate-y-4">
                  <Calculator className="w-32 h-32" />
                </div>
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm border border-gray-100 relative z-10">
                  <Calculator className="w-7 h-7 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 relative z-10">
                  Traceable Share Matching
                </h3>
                <p className="text-gray-600 leading-relaxed relative z-10">
                  Automatically applies the complex{" "}
                  <Link
                    href="/guide"
                    className="text-blue-600 underline hover:no-underline"
                  >
                    HMRC share matching algorithm
                  </Link>{" "}
                  — first Same-Day rule, then{" "}
                  <Link
                    href="/guide/bed-and-breakfast-rule"
                    className="text-blue-600 underline hover:no-underline"
                  >
                    30-Day Bed &amp; Breakfast rule
                  </Link>
                  , and finally{" "}
                  <Link
                    href="/tools/section-104-calculator"
                    className="text-blue-600 underline hover:no-underline"
                  >
                    Section 104 pools
                  </Link>{" "}
                  — strictly in order.
                </p>
              </div>

              <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-xl hover:shadow-green-900/5 transition-all duration-300 relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform translate-x-4 -translate-y-4">
                  <TrendingUp className="w-32 h-32" />
                </div>
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm border border-gray-100 relative z-10">
                  <TrendingUp className="w-7 h-7 text-green-700" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 relative z-10">
                  Tax-Loss Harvesting
                </h3>
                <p className="text-gray-600 leading-relaxed relative z-10">
                  Explore illustrative holding values using prices you enter and
                  saved pool snapshots. These scenarios are not disposal
                  calculations or tax-saving recommendations.
                </p>
              </div>

              <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-xl hover:shadow-indigo-900/5 transition-all duration-300 relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform translate-x-4 -translate-y-4">
                  <FileText className="w-32 h-32" />
                </div>
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm border border-gray-100 relative z-10">
                  <FileText className="w-7 h-7 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 relative z-10">
                  Preparing for SA108
                </h3>
                <p className="text-gray-600 leading-relaxed relative z-10">
                  Review saved calculations and export disposal evidence as CSV.
                  Download calculation summaries and matching evidence. SA108 filing guidance is available separately.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Free Tools Teaser */}
        <section className="py-12 sm:py-20 px-4 bg-white border-t border-gray-100">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-3">
                Free CGT Tools — No Signup Required
              </h2>
              <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                Use our free calculators to check individual transactions before
                committing to a full portfolio analysis.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <Link
                href="/tools/bed-and-breakfast-calculator"
                className="group bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-200 transition-colors">
                  <Calculator className="w-6 h-6 text-amber-700" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">
                  B&amp;B Rule Calculator
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Check if HMRC&apos;s 30-day bed &amp; breakfast rule applies
                  to your share sale.
                </p>
                <span className="text-sm font-semibold text-amber-700 group-hover:text-amber-800 flex items-center gap-1">
                  Try it free <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
              <Link
                href="/tools/section-104-calculator"
                className="group bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                  <BarChart3 className="w-6 h-6 text-blue-700" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">
                  Section 104 Pool Calculator
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Calculate your average cost basis across multiple share
                  purchases.
                </p>
                <span className="text-sm font-semibold text-blue-700 group-hover:text-blue-800 flex items-center gap-1">
                  Try it free <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
              <Link
                href="/tools/cgt-allowance-checker"
                className="group bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                  <CheckCircle className="w-6 h-6 text-green-700" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">
                  CGT Allowance Checker
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  See how much of your £3,000 annual exempt amount you&apos;ve
                  used.
                </p>
                <span className="text-sm font-semibold text-green-700 group-hover:text-green-800 flex items-center gap-1">
                  Try it free <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-12 sm:py-24 px-4 bg-slate-900 text-white relative overflow-hidden">
          {/* Background flares */}
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-blue-500/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-purple-500/20 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

          <div className="max-w-6xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
                From CSV to calculation in three simple steps
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-12 relative">
              {/* Connecting line */}
              <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0"></div>

              <div className="text-center relative">
                <div className="w-24 h-24 bg-slate-800 border border-slate-700 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl relative z-10">
                  <Upload className="w-10 h-10" />
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-blue-600 text-white font-bold rounded-full flex items-center justify-center border-4 border-slate-900">
                    1
                  </div>
                </div>
                <h3 className="font-bold text-xl mb-3">
                  Upload your statements
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Export your complete account history and check the supported
                  format before selecting your CSV.
                </p>
              </div>

              <div className="text-center relative">
                <div className="w-24 h-24 bg-slate-800 border border-slate-700 text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl relative z-10">
                  <Zap className="w-10 h-10" />
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-purple-600 text-white font-bold rounded-full flex items-center justify-center border-4 border-slate-900">
                    2
                  </div>
                </div>
                <h3 className="font-bold text-xl mb-3">Review your records</h3>
                <p className="text-slate-400 leading-relaxed">
                  Review included, excluded, duplicate and unresolved records
                  before saving any transactions.
                </p>
              </div>

              <div className="text-center relative">
                <div className="w-24 h-24 bg-slate-800 border border-slate-700 text-green-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl relative z-10">
                  <CheckCircle className="w-10 h-10" />
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-green-700 text-white font-bold rounded-full flex items-center justify-center border-4 border-slate-900">
                    3
                  </div>
                </div>
                <h3 className="font-bold text-xl mb-3">Review your result</h3>
                <p className="text-slate-400 leading-relaxed">
                  See your calculation, disposal evidence and historical pools.
                  PDF summaries and CSV evidence support your review; they are not completed tax returns.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust / Security */}
        <section className="py-12 sm:py-20 bg-gray-50 px-4 border-b border-gray-200">
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-white border border-gray-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              Private account access
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
              A private preview keeps your CSV available across devices for 24 hours. Saving or discarding the preview removes that draft. <Link className="underline" href="/privacy">Read how your data and backups are handled</Link>.
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-12 sm:py-24 px-4 bg-white" id="pricing">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-extrabold mb-6 text-gray-900">
              Simple, transparent pricing
            </h2>
            <p className="text-xl text-gray-600 mb-12 max-w-xl mx-auto">
              Start with free imports and calculations. Add PDF reports when you need them.
            </p>

            <ReportPricing heading="h3" />
            <p className="mt-5 text-sm text-gray-600">Staging checkout uses test payments. <Link href="/pricing" className="underline">View pricing details</Link>.</p>
          </div>
        </section>

        {/* FAQ */}
        <section
          className="py-12 sm:py-24 bg-gray-50 px-4 border-t border-gray-200"
          id="faq"
        >
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-extrabold text-center mb-12 text-gray-900">
              Frequently asked questions
            </h2>
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  How accurate are the calculations?
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Our engine implements all three HMRC matching rules (same-day,
                  30-day bed & breakfast, and Section 104 pool) in the strict
                  sequential order required by HMRC. We use highly precise
                  decimal arithmetic to avoid float rounding errors. That said,
                  this tool provides computation for your guidance — we always
                  recommend verifying figures with a qualified tax advisor if
                  you possess complex assets.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Is my data secure?
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Drafts contain your CSV and expire after 24 hours. Your saved transactions and calculation evidence stay in your workspace. <Link className="underline" href="/privacy">See the storage and backup details</Link>.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Which brokers are supported?
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  We support documented taxable-account layouts from {BROKERS.map((broker) => broker.name).join(", ")}. Some need details from your contract notes. <Link className="underline" href="/supported-brokers">Find the export for your broker</Link>.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  What happens if I have capital losses?
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Your report separates gains and losses on the ordinary-share disposals you imported and shows the net result for the selected tax year. Check your wider tax position separately.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Does it cover cryptocurrency?
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Not currently. The preview covers taxable ordinary shares.
                  Funds, ETFs, bonds, derivatives, crypto and corporate actions
                  remain outside the qualified scope.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-12 sm:py-24 bg-blue-600 text-white text-center px-4 relative overflow-hidden">
          {/* Background Pattern */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          ></div>

          <div className="max-w-3xl mx-auto relative z-10">
            <h2 className="text-4xl font-extrabold mb-6 tracking-tight">
              Ready to take control of your CGT?
            </h2>
            <p className="text-white mb-10 text-xl font-medium max-w-2xl mx-auto">
              Review your first supported CSV and follow the calculation
              evidence.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center bg-white text-blue-600 px-10 py-4 rounded-xl text-xl font-bold hover:bg-blue-50 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-900/30"
            >
              Try the preview <ArrowRight className="ml-3 w-6 h-6" />
            </Link>
          </div>
        </section>

        {/* Footer */}
      </main>
      <PublicFooter />
    </div>
  );
}

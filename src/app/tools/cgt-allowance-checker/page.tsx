'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'

const EXEMPT_AMOUNT = 3000
const BASIC_RATE = 0.18
const HIGHER_RATE = 0.24

export default function CGTAllowanceCheckerPage() {
  const [gains, setGains] = useState('')
  const [losses, setLosses] = useState('')
  const [taxBand, setTaxBand] = useState<'basic' | 'higher'>('basic')

  const totalGains = parseFloat(gains) || 0
  const totalLosses = parseFloat(losses) || 0
  const netGain = Math.max(0, totalGains - totalLosses)
  const exemptionUsed = Math.min(netGain, EXEMPT_AMOUNT)
  const exemptionRemaining = Math.max(0, EXEMPT_AMOUNT - netGain)
  const taxableGain = Math.max(0, netGain - EXEMPT_AMOUNT)
  const rate = taxBand === 'basic' ? BASIC_RATE : HIGHER_RATE
  const taxOwed = taxableGain * rate

  const hasInput = gains !== '' || losses !== ''

  // Traffic light
  const pctUsed = netGain / EXEMPT_AMOUNT
  const light: 'green' | 'amber' | 'red' =
    pctUsed <= 0.5 ? 'green' : pctUsed <= 1 ? 'amber' : 'red'

  const lightConfig = {
    green: { icon: CheckCircle, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', iconColor: 'text-green-600', label: 'Well within allowance' },
    amber: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconColor: 'text-amber-600', label: 'Approaching allowance limit' },
    red: { icon: XCircle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', iconColor: 'text-red-600', label: 'Over allowance — tax is due' },
  }
  const lc = lightConfig[light]
  const Icon = lc.icon

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <main className="max-w-3xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">UK CGT Allowance Checker 2025-26</h1>
        <p className="text-lg text-gray-600 mb-2 max-w-3xl leading-relaxed">
          Every UK taxpayer gets a <strong>£3,000 annual exempt amount</strong> for capital gains in 2025-26. This means the first £3,000 of net gains in the tax year is completely tax-free. Use this checker to see where you stand.
        </p>
        <p className="text-gray-600 mb-8 max-w-3xl leading-relaxed">
          Enter your total gains and losses so far this tax year to see how much of your exemption remains and your estimated CGT liability.
        </p>

        {/* Calculator */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
          <div className="h-1.5 bg-gradient-to-r from-green-400 to-emerald-500" />
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <label htmlFor="gains" className="block text-sm font-semibold text-gray-700 mb-1">Total gains so far this tax year (£)</label>
              <input id="gains" type="number" step="any" min="0" placeholder="e.g. 5000" value={gains} onChange={(e) => setGains(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <label htmlFor="losses" className="block text-sm font-semibold text-gray-700 mb-1">Total losses so far this tax year (£)</label>
              <input id="losses" type="number" step="any" min="0" placeholder="e.g. 1000" value={losses} onChange={(e) => setLosses(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
            </div>
            <div>
              <p className="block text-sm font-semibold text-gray-700 mb-2">Are you a basic or higher rate taxpayer?</p>
              <div className="flex gap-4">
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${taxBand === 'basic' ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="tax-band" value="basic" checked={taxBand === 'basic'} onChange={() => setTaxBand('basic')} className="sr-only" />
                  <span className="text-sm font-medium">Basic rate (18%)</span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${taxBand === 'higher' ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="tax-band" value="higher" checked={taxBand === 'higher'} onChange={() => setTaxBand('higher')} className="sr-only" />
                  <span className="text-sm font-medium">Higher rate (24%)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Results */}
          {hasInput && (
            <div className="bg-gray-50 border-t p-6 sm:p-8">
              {/* Traffic light */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border mb-6 ${lc.bg} ${lc.border}`}>
                <Icon className={`w-6 h-6 ${lc.iconColor} flex-shrink-0`} />
                <span className={`font-semibold ${lc.text}`}>{lc.label}</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">Net Gain</p>
                  <p className="text-2xl font-bold text-gray-900">£{netGain.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">Exemption Remaining</p>
                  <p className="text-2xl font-bold text-gray-900">£{exemptionRemaining.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">Taxable Gain</p>
                  <p className="text-2xl font-bold text-gray-900">£{taxableGain.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">Estimated Tax Owed</p>
                  <p className={`text-2xl font-bold ${taxOwed > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    £{taxOwed.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">at {(rate * 100).toFixed(0)}% {taxBand} rate</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>£0</span>
                  <span>£{EXEMPT_AMOUNT.toLocaleString()} exempt</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${light === 'green' ? 'bg-green-500' : light === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, pctUsed * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 text-right">
                  {Math.min(100, Math.round(pctUsed * 100))}% of allowance used
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <section className="bg-blue-50 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Know exactly where you stand with your full transaction history</h2>
          <p className="text-gray-600 mb-6">Upload your broker CSV and CGT Tracker will calculate your precise gains, losses, and tax position automatically.</p>
          <Link href="/signup" className="inline-flex items-center bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors">
            Upload your CSV free <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calculator, ArrowRight, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

interface CalcResult {
  matched: boolean
  daysBetween: number
  matchedCost: number
  proceeds: number
  gainLoss: number
  poolCost?: number
  poolGainLoss?: number
}

export default function FreeBBCalculator() {
  const [sellDate, setSellDate] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [sellQty, setSellQty] = useState('')
  const [buyDate, setBuyDate] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [buyQty, setBuyQty] = useState('')
  const [result, setResult] = useState<CalcResult | null>(null)

  const calculate = () => {
    const sd = new Date(sellDate)
    const bd = new Date(buyDate)
    const sp = parseFloat(sellPrice)
    const sq = parseFloat(sellQty)
    const bp = parseFloat(buyPrice)
    const bq = parseFloat(buyQty)

    if ([sd, bd].some(d => isNaN(d.getTime())) || [sp, sq, bp, bq].some(v => isNaN(v) || v <= 0)) return

    const diffMs = bd.getTime() - sd.getTime()
    const daysBetween = Math.round(diffMs / (1000 * 60 * 60 * 24))

    const matched = daysBetween >= 0 && daysBetween <= 30

    // Matched quantity = min of sold and re-bought
    const matchedQty = Math.min(sq, bq)
    const proceeds = matchedQty * sp
    const matchedCost = matchedQty * bp
    const gainLoss = proceeds - matchedCost

    setResult({
      matched,
      daysBetween,
      matchedCost: Math.round(matchedCost * 100) / 100,
      proceeds: Math.round(proceeds * 100) / 100,
      gainLoss: Math.round(gainLoss * 100) / 100,
    })
  }

  const formatGBP = (n: number) => `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <section className="py-24 px-4 bg-white border-t border-gray-100" id="free-calculator">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            <Calculator className="w-4 h-4" />
            Free Tool — No Signup Required
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
            Bed &amp; Breakfast Rule Calculator
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Sold shares and re-bought within 30 days? HMRC's Bed &amp; Breakfast rule forces you to use the re-purchase price as your cost basis. Check instantly below.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Gradient top bar */}
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

          <div className="p-6 sm:p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Sell side */}
              <div>
                <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  Disposal (Sell)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Sell Date</label>
                    <input
                      type="date"
                      value={sellDate}
                      onChange={e => setSellDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Sell Price (per share)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">£</span>
                      <input
                        type="number"
                        step="0.01"
                        value={sellPrice}
                        onChange={e => setSellPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of Shares Sold</label>
                    <input
                      type="number"
                      value={sellQty}
                      onChange={e => setSellQty(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    />
                  </div>
                </div>
              </div>

              {/* Buy side */}
              <div>
                <h3 className="text-sm font-bold text-green-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Re-purchase (Buy)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Re-buy Date</label>
                    <input
                      type="date"
                      value={buyDate}
                      onChange={e => setBuyDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Re-buy Price (per share)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">£</span>
                      <input
                        type="number"
                        step="0.01"
                        value={buyPrice}
                        onChange={e => setBuyPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of Shares Re-bought</label>
                    <input
                      type="number"
                      value={buyQty}
                      onChange={e => setBuyQty(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={calculate}
              disabled={!sellDate || !buyDate || !sellPrice || !sellQty || !buyPrice || !buyQty}
              className="w-full mt-8 bg-gray-900 text-white py-3.5 rounded-xl font-bold text-base hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <Calculator className="w-5 h-5" />
              Check Bed &amp; Breakfast Rule
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="border-t border-gray-200">
              {result.matched ? (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 sm:p-8">
                  <div className="flex items-start gap-3 mb-5">
                    <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-900 text-lg">Bed &amp; Breakfast Rule Applies</h4>
                      <p className="text-amber-700 text-sm mt-1">
                        The re-purchase was <strong>{result.daysBetween} day{result.daysBetween !== 1 ? 's' : ''}</strong> after the sale — within HMRC's 30-day window. The re-buy price must be used as the allowable cost.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-amber-200">
                      <div className="text-xs text-gray-500 font-medium mb-1">Proceeds</div>
                      <div className="text-lg font-bold text-gray-900">{formatGBP(result.proceeds)}</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-amber-200">
                      <div className="text-xs text-gray-500 font-medium mb-1">Allowable Cost (B&amp;B)</div>
                      <div className="text-lg font-bold text-gray-900">{formatGBP(result.matchedCost)}</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-amber-200">
                      <div className="text-xs text-gray-500 font-medium mb-1">Gain / Loss</div>
                      <div className={`text-lg font-bold ${result.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.gainLoss >= 0 ? '+' : '-'}{formatGBP(result.gainLoss)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 sm:p-8">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-green-900 text-lg">No Bed &amp; Breakfast Match</h4>
                      <p className="text-green-700 text-sm mt-1">
                        {result.daysBetween < 0
                          ? 'The re-purchase occurred before the sale. The B&B rule only applies to acquisitions within 30 days after a disposal.'
                          : `The re-purchase was ${result.daysBetween} days after the sale — outside the 30-day window. The standard Section 104 pool cost applies instead.`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 sm:p-8 text-white">
                <div className="max-w-2xl mx-auto text-center">
                  <p className="text-blue-100 text-lg font-semibold mb-2">
                    Calculating one trade is easy. Calculating 50 is a nightmare.
                  </p>
                  <p className="text-blue-200 text-sm mb-6">
                    Upload your broker CSV and let our engine map your entire portfolio instantly — applying Same-Day, B&amp;B, and Section 104 rules automatically.
                  </p>
                  <Link
                    href="/signup"
                    className="inline-flex items-center bg-white text-blue-600 px-8 py-3.5 rounded-xl font-bold text-base hover:bg-blue-50 transition-all hover:scale-105 active:scale-95 shadow-lg"
                  >
                    Start 14-Day Free Trial
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { BarChart3, Plus, Trash2, ArrowRight, Calculator } from 'lucide-react'
import Decimal from 'decimal.js'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'

interface PurchaseRow {
  id: number
  date: string
  quantity: string
  pricePerShare: string
  fees: string
}

export default function Section104CalculatorPage() {
  const [rows, setRows] = useState<PurchaseRow[]>([
    { id: 1, date: '', quantity: '', pricePerShare: '', fees: '' },
  ])
  const [sellQty, setSellQty] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [nextId, setNextId] = useState(2)

  const addRow = () => {
    setRows((prev) => [...prev, { id: nextId, date: '', quantity: '', pricePerShare: '', fees: '' }])
    setNextId((n) => n + 1)
  }

  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const updateRow = useCallback((id: number, field: keyof PurchaseRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }, [])

  // Calculate pool
  const poolRows = rows
    .filter((r) => r.quantity && r.pricePerShare)
    .map((r) => {
      const qty = new Decimal(r.quantity || 0)
      const price = new Decimal(r.pricePerShare || 0)
      const fees = new Decimal(r.fees || 0)
      const cost = qty.mul(price).plus(fees)
      return { ...r, decQty: qty, decCost: cost }
    })

  let runningShares = new Decimal(0)
  let runningCost = new Decimal(0)
  const poolState = poolRows.map((r) => {
    runningShares = runningShares.plus(r.decQty)
    runningCost = runningCost.plus(r.decCost)
    const avg = runningShares.isZero() ? new Decimal(0) : runningCost.div(runningShares)
    return {
      date: r.date,
      qty: r.decQty,
      cost: r.decCost,
      totalShares: new Decimal(runningShares),
      totalCost: new Decimal(runningCost),
      avgCost: avg,
    }
  })

  const totalPoolShares = runningShares
  const totalPoolCost = runningCost
  const avgCostPerShare = totalPoolShares.isZero() ? new Decimal(0) : totalPoolCost.div(totalPoolShares)

  // Disposal calc
  const hasSellData = sellQty && sellPrice && !totalPoolShares.isZero()
  let disposalResult: null | {
    qty: Decimal; proceeds: Decimal; allowableCost: Decimal; gainLoss: Decimal;
    remainingShares: Decimal; remainingCost: Decimal
  } = null

  if (hasSellData) {
    const sQty = new Decimal(sellQty)
    const sPrice = new Decimal(sellPrice)
    const effectiveQty = Decimal.min(sQty, totalPoolShares)
    const proceeds = effectiveQty.mul(sPrice)
    const allowableCost = effectiveQty.div(totalPoolShares).mul(totalPoolCost)
    const gainLoss = proceeds.minus(allowableCost)
    const remainingShares = totalPoolShares.minus(effectiveQty)
    const remainingCost = totalPoolCost.minus(allowableCost)
    disposalResult = { qty: effectiveQty, proceeds, allowableCost, gainLoss, remainingShares, remainingCost }
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <main className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Section 104 Pool Calculator</h1>
        <p className="text-lg text-gray-600 mb-2 max-w-3xl leading-relaxed">
          HMRC requires UK investors to use the <Link href="/guide/section-104-pool" className="text-blue-600 hover:underline">Section 104 pool</Link> to calculate the average cost of shares purchased over time. Each time you buy more of the same share, the pool&apos;s total cost and quantity increase. When you sell, the allowable cost is calculated proportionally from the pool.
        </p>
        <p className="text-gray-600 mb-8 max-w-3xl leading-relaxed">
          Enter your purchase history below to build your pool and see how the average cost changes with each acquisition. Then enter a disposal to calculate your gain or loss.
        </p>

        {/* Purchase rows */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <div className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" /> Purchases
            </h2>

            <div className="space-y-4">
              {rows.map((row, i) => (
                <div key={row.id} className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-3">
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>}
                    <input type="date" value={row.date} onChange={(e) => updateRow(row.id, 'date', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>}
                    <input type="number" step="any" min="0.01" placeholder="100" value={row.quantity} onChange={(e) => updateRow(row.id, 'quantity', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Price/share (£)</label>}
                    <input type="number" step="any" min="0.0001" placeholder="3.50" value={row.pricePerShare} onChange={(e) => updateRow(row.id, 'pricePerShare', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Fees (£)</label>}
                    <input type="number" step="any" min="0" placeholder="0" value={row.fees} onChange={(e) => updateRow(row.id, 'fees', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(row.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" aria-label="Remove row">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={addRow} className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
              <Plus className="w-4 h-4" /> Add purchase
            </button>
          </div>

          {/* Pool summary */}
          {poolState.length > 0 && (
            <div className="bg-blue-50 border-t p-6 sm:p-8">
              <h3 className="font-bold text-gray-900 mb-4">Pool Summary</h3>
              <div className="overflow-x-auto mb-6 not-prose">
                <table className="w-full text-sm border bg-white rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2 font-semibold text-gray-700">Date</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Qty</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Cost</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Pool Shares</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Pool Cost</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">Avg/Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {poolState.map((ps, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{ps.date || '—'}</td>
                        <td className="px-3 py-2 text-right">{ps.qty.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">£{ps.cost.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium">{ps.totalShares.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium">£{ps.totalCost.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">£{ps.avgCost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">Total Shares</p>
                  <p className="text-xl font-bold text-gray-900">{totalPoolShares.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">Total Cost</p>
                  <p className="text-xl font-bold text-gray-900">£{totalPoolCost.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">Avg Cost/Share</p>
                  <p className="text-xl font-bold text-gray-900">£{avgCostPerShare.toFixed(4)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Disposal section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-12">
          <div className="h-1.5 bg-gradient-to-r from-red-400 to-rose-500" />
          <div className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-red-600" /> Disposal
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sell-qty" className="block text-sm font-medium text-gray-700 mb-1">Quantity to sell</label>
                <input id="sell-qty" type="number" step="any" min="0.01" placeholder="e.g. 100" value={sellQty} onChange={(e) => setSellQty(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" />
              </div>
              <div>
                <label htmlFor="sell-price" className="block text-sm font-medium text-gray-700 mb-1">Sale price per share (£)</label>
                <input id="sell-price" type="number" step="any" min="0.0001" placeholder="e.g. 4.20" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" />
              </div>
            </div>
          </div>

          {disposalResult && (
            <div className="bg-gray-50 border-t p-6 sm:p-8">
              <h3 className="font-bold text-gray-900 mb-4">Disposal Result</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border">
                  <p className="text-xs text-gray-500 uppercase mb-1">Proceeds</p>
                  <p className="text-xl font-bold text-gray-900">£{disposalResult.proceeds.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border">
                  <p className="text-xs text-gray-500 uppercase mb-1">Allowable Cost</p>
                  <p className="text-xl font-bold text-gray-900">£{disposalResult.allowableCost.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border">
                  <p className="text-xs text-gray-500 uppercase mb-1">{disposalResult.gainLoss.gte(0) ? 'Gain' : 'Loss'}</p>
                  <p className={`text-xl font-bold ${disposalResult.gainLoss.gte(0) ? 'text-green-600' : 'text-red-600'}`}>
                    {disposalResult.gainLoss.gte(0) ? '+' : ''}£{disposalResult.gainLoss.toFixed(2)}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border">
                  <p className="text-xs text-gray-500 uppercase mb-1">Pool After Sale</p>
                  <p className="text-lg font-bold text-gray-900">{disposalResult.remainingShares.toFixed(2)} shares</p>
                  <p className="text-sm text-gray-500">£{disposalResult.remainingCost.toFixed(2)} cost</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Explanatory content */}
        <div className="prose prose-gray max-w-none mb-12">
          <h2>How the Section 104 Pool Calculator Works</h2>
          <p>
            This calculator uses <strong>precise decimal arithmetic</strong> (the same library as our main CGT engine) to avoid floating-point rounding errors that can affect gain calculations. Each purchase you add increases the pool&apos;s total shares and total cost. The average cost per share is recalculated after each addition.
          </p>
          <p>
            When you enter a disposal, the calculator deducts the proportional cost from the pool. The allowable cost for the disposal is: (shares sold ÷ total pool shares) × total pool cost. The gain or loss is simply the proceeds minus this allowable cost.
          </p>

          <h3>Worked Example</h3>
          <p>
            Imagine you bought 100 shares at £2.00 (cost: £200) and later 50 shares at £3.00 (cost: £150). Your pool is: 150 shares, £350 total cost, £2.3333 average. If you sell 60 shares at £4.00:
          </p>
          <ul>
            <li><strong>Proceeds:</strong> 60 × £4.00 = £240</li>
            <li><strong>Allowable cost:</strong> (60 ÷ 150) × £350 = £140</li>
            <li><strong>Gain:</strong> £240 − £140 = <strong>£100</strong></li>
            <li><strong>Remaining pool:</strong> 90 shares, £210 cost</li>
          </ul>
          <p>
            For the full rules on how the Section 104 pool interacts with same-day and 30-day matching, read our <Link href="/guide/section-104-pool">comprehensive Section 104 guide</Link>.
          </p>
        </div>

        {/* CTA */}
        <section className="bg-blue-50 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Tracking multiple securities?</h2>
          <p className="text-gray-600 mb-6">CGT Tracker handles your entire portfolio automatically — multiple securities, same-day rules, B&amp;B matching, and SA108 reports.</p>
          <Link href="/signup" className="inline-flex items-center bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors">
            Start free trial <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

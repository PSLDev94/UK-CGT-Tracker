'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calculator, TrendingDown, AlertCircle } from 'lucide-react'

export default function TaxLossHarvestingPage() {
  const [pools, setPools] = useState<any[]>([])
  const [computation, setComputation] = useState<any>(null)
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load active pools
      const { data: poolsData } = await supabase
        .from('section_104_pools')
        .select('*')
        .eq('user_id', user.id)
        .gt('total_shares', 0)

      setPools(poolsData || [])

      // Load current year's computation
      const { data: compData } = await supabase
        .from('cgt_computations')
        .select('*')
        .eq('user_id', user.id)
        .eq('tax_year', '2024-25')
        .single()
        
      if (compData) {
        setComputation(compData)
      }

      setLoading(false)
    }
    loadData()
  }, [])

  const handlePriceChange = (ticker: string, value: string) => {
    setPrices(prev => ({ ...prev, [ticker]: value }))
  }

  // Calculate harvesting opportunities based on manually entered prices
  const getOpportunities = () => {
    if (!computation || !pools) return []
    
    // We can offset up to our total taxable gain
    const taxableGainToOffset = computation.taxable_gain_gbp || 0
    const basicRate = 0.18 // simplified proxy or get from rule map

    const opps: any[] = []

    for (const pool of pools) {
      const currentPriceStr = prices[pool.ticker]
      if (!currentPriceStr) continue
      
      const currentPrice = parseFloat(currentPriceStr)
      if (isNaN(currentPrice)) continue

      const currentValue = currentPrice * pool.total_shares
      const unrealisedGainLoss = currentValue - pool.total_allowable_cost_gbp

      if (unrealisedGainLoss < 0 && taxableGainToOffset > 0) {
        // Limited by either the unrealised loss magnitude, or the taxable gain left
        const allowableLoss = Math.min(Math.abs(unrealisedGainLoss), taxableGainToOffset)
        const potentialTaxSaving = allowableLoss * basicRate

        opps.push({
          ticker: pool.ticker,
          shares: pool.total_shares,
          cost: pool.total_allowable_cost_gbp,
          currentValue,
          unrealisedLoss: Math.abs(unrealisedGainLoss),
          potentialTaxSaving
        })
      }
    }

    return opps.sort((a, b) => b.potentialTaxSaving - a.potentialTaxSaving)
  }

  const opportunities = getOpportunities()
  const totalPotentialSavings = opportunities.reduce((sum, opp) => sum + opp.potentialTaxSaving, 0)

  if (loading) {
     return <div className="p-8">Loading pools...</div>
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tax-Loss Harvesting</h1>
        <p className="text-gray-600 mt-1">Simulate selling losing positions to offset your current £{computation?.taxable_gain_gbp?.toLocaleString() || 0} taxable gain.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Calculator className="w-5 h-5 mr-2 text-blue-600" />
          Enter Current Market Prices
        </h3>
        <p className="text-sm text-gray-500 mb-6">Since we do not track live assets, please enter the current approximate market price for your holding per share to compute unrealised losses.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-2">Asset</th>
                <th>Shares Held</th>
                <th>Cost Per Share</th>
                <th>Enter Current Price (£)</th>
              </tr>
            </thead>
            <tbody>
              {pools.map(pool => (
                <tr key={pool.ticker} className="border-b last:border-0 border-gray-100">
                  <td className="py-3 font-medium">{pool.ticker}</td>
                  <td>{pool.total_shares}</td>
                  <td>£{(pool.total_allowable_cost_gbp / pool.total_shares).toFixed(2)}</td>
                  <td>
                    <input 
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="border rounded px-2 py-1 w-32 focus:ring-blue-500 focus:border-blue-500"
                      value={prices[pool.ticker] || ''}
                      onChange={(e) => handlePriceChange(pool.ticker, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {pools.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-gray-500">You don't have any active holdings (Section 104 pools) right now.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {opportunities.length > 0 && (
        <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-6">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-bold text-blue-900 flex items-center">
              <TrendingDown className="w-5 h-5 mr-2" />
              Harvesting Opportunities
            </h3>
            <div className="bg-white px-4 py-2 rounded-lg border shadow-sm">
              <span className="text-sm text-gray-500 block">Total Potential Tax Saving</span>
              <span className="text-xl font-bold text-green-600">£{totalPotentialSavings.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-4">
            {opportunities.map(opp => (
              <div key={opp.ticker} className="bg-white p-4 rounded-lg border border-blue-100 flex flex-col md:flex-row justify-between md:items-center">
                <div>
                  <h4 className="font-bold text-gray-900">{opp.ticker}</h4>
                  <p className="text-sm text-gray-600 mt-1">If you sell all {opp.shares} shares, you'd realise a loss of <strong className="text-red-500">£{opp.unrealisedLoss.toFixed(2)}</strong>.</p>
                </div>
                <div className="mt-4 md:mt-0 text-right">
                  <span className="block text-sm text-gray-500">Estimated Tax Saving</span>
                  <span className="text-xl font-bold text-green-600">£{opp.potentialTaxSaving.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-start bg-blue-100 p-4 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-800 mr-3 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900">
              <strong>Beware of the 30-day rule:</strong> To effectively harvest this loss and offset your gains, you must wait at least 30 full days before repurchasing these exact same shares. Otherwise, HMRC rules will match the repurchase to this disposal.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}

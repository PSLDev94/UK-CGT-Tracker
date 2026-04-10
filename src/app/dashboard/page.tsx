import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Download, RefreshCw } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const resolvedParams = await searchParams
  const selectedYear = resolvedParams.year || '2025-26'

  // Fetch Computations
  const { data: computations } = await supabase
    .from('cgt_computations')
    .select('*')
    .eq('user_id', user.id)

  const currentComputation = computations?.find((c: any) => c.tax_year === selectedYear) || {
    total_gain_gbp: 0,
    total_loss_gbp: 0,
    annual_exempt_amount_gbp: 3000,
    taxable_gain_gbp: 0,
    net_gain_gbp: 0,
  }

  // Fetch disposals
  const { data: disposals } = await supabase
    .from('disposals')
    .select('*')
    .eq('user_id', user.id)
    .eq('tax_year', selectedYear)
    .order('date', { ascending: false })

  // Fetch Pools
  const { data: pools } = await supabase
    .from('section_104_pools')
    .select('*')
    .eq('user_id', user.id)
    .gt('total_shares', 0)

  // Check for year-end alerts
  const now = new Date()
  const taxYearEnd = new Date('2026-04-05')
  const daysUntilEnd = Math.ceil((taxYearEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const showYearEndAlert = daysUntilEnd > 0 && daysUntilEnd <= 30

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tax Overview</h1>
          <p className="text-gray-600 mt-1">Review your capital gains tax position.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <form method="GET" action="/dashboard" className="flex items-center">
            <select 
              name="year" 
              defaultValue={selectedYear}
              className="px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 mr-3 text-sm"
            >
              <option value="2021-22">2021-22</option>
              <option value="2022-23">2022-23</option>
              <option value="2023-24">2023-24</option>
              <option value="2024-25">2024-25</option>
              <option value="2025-26">2025-26</option>
            </select>
            <button type="submit" className="px-3 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-50">Go</button>
          </form>
          <Link href="/dashboard/upload" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center text-sm">
            <Plus className="w-4 h-4 mr-2" /> Upload
          </Link>
          <Link href="/dashboard/reports" className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 flex items-center text-sm">
            <Download className="w-4 h-4 mr-2" /> Export
          </Link>
        </div>
      </div>

      {/* Year-end alert */}
      {showYearEndAlert && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start">
          <div className="text-amber-600 mr-3 mt-0.5">⏰</div>
          <div>
            <p className="font-medium text-amber-900">Tax year ends in {daysUntilEnd} day{daysUntilEnd !== 1 ? 's' : ''}</p>
            <p className="text-sm text-amber-700 mt-1">
              Review your positions and consider 
              <Link href="/dashboard/tax-loss-harvesting" className="underline font-medium ml-1">tax-loss harvesting</Link> before 5 April.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Gains</h3>
          <p className="text-2xl font-bold text-green-600">£{((currentComputation as any)?.total_gain_gbp || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Losses</h3>
          <p className="text-2xl font-bold text-red-600">£{((currentComputation as any)?.total_loss_gbp || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Annual Exemption</h3>
          <p className="text-2xl font-bold text-gray-900">£{((currentComputation as any)?.annual_exempt_amount_gbp || 3000).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm border-blue-200 bg-blue-50">
          <h3 className="text-sm font-medium text-blue-800 mb-1">Estimated Taxable Gain</h3>
          <p className="text-2xl font-bold text-blue-900">£{((currentComputation as any)?.taxable_gain_gbp || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Disposals ({selectedYear})</h3>
          <span className="text-sm text-gray-500">{disposals?.length || 0} transaction{(disposals?.length || 0) !== 1 ? 's' : ''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Asset</th>
                <th className="px-6 py-3 font-medium">Qty</th>
                <th className="px-6 py-3 font-medium">Proceeds</th>
                <th className="px-6 py-3 font-medium">Cost</th>
                <th className="px-6 py-3 font-medium">Gain/Loss</th>
                <th className="px-6 py-3 font-medium">Matching Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!disposals || disposals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="text-gray-400 mb-2">📊</div>
                    <p className="text-gray-500 font-medium">No disposals found for {selectedYear}</p>
                    <p className="text-sm text-gray-400 mt-1">Upload your broker CSV to get started.</p>
                    <Link href="/dashboard/upload" className="mt-4 inline-block text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Upload transactions →
                    </Link>
                  </td>
                </tr>
              ) : (
                disposals.map((d: any) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{d.ticker}</td>
                    <td className="px-6 py-4">{d.quantity}</td>
                    <td className="px-6 py-4">£{d.proceeds_gbp.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className="px-6 py-4">£{d.allowable_cost_gbp.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className={`px-6 py-4 font-medium ${d.gain_gbp >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {d.gain_gbp >= 0 ? '+' : ''}£{d.gain_gbp.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        d.matching_rule.includes('SAME_DAY') ? 'bg-purple-100 text-purple-700' :
                        d.matching_rule.includes('BED_AND_BREAKFAST') ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {d.matching_rule.includes('SAME_DAY') ? 'Same-Day' :
                         d.matching_rule.includes('BED_AND_BREAKFAST') ? 'B&B (30-Day)' :
                         'Section 104'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
         <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Current Section 104 Pools</h3>
        </div>
        <div className="overflow-x-auto">
           <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">Asset</th>
                <th className="px-6 py-3 font-medium">Total Shares</th>
                <th className="px-6 py-3 font-medium">Total Allowable Cost</th>
                <th className="px-6 py-3 font-medium">Cost Per Share</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!pools || pools.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No active holdings found.</td>
                </tr>
              ) : (
                pools.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{p.ticker}</td>
                    <td className="px-6 py-4">{Number(p.total_shares).toLocaleString(undefined, {maximumFractionDigits: 4})}</td>
                    <td className="px-6 py-4">£{p.total_allowable_cost_gbp.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className="px-6 py-4">
                      £{(p.total_allowable_cost_gbp / p.total_shares).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 text-center">
        This tool provides estimates for guidance only. Always consult a qualified tax advisor before submitting your self-assessment.
      </p>
    </div>
  )
}

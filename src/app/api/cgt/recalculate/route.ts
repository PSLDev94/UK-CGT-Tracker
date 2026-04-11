import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runCGTEngineCalculations, RawTransaction } from '@/lib/cgt-engine'

export async function POST(req: Request) {
  try {
    // Use untyped client for complex upsert/delete operations
    const supabase: any = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch ALL transactions for this user
    const { data: allTxnRows, error: fetchErr } = await supabase
      .from('transactions')
      .select('id, date, type, ticker, security_name, quantity, price_gbp, total_gbp, fees_gbp')
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    if (fetchErr) throw new Error(fetchErr.message)

    if (!allTxnRows || allTxnRows.length === 0) {
      return NextResponse.json({ message: 'No transactions found. Nothing to recalculate.' })
    }

    const engineInput: RawTransaction[] = allTxnRows.map((r: any) => ({
      id: r.id,
      date: r.date,
      type: r.type,
      ticker: r.ticker,
      securityName: r.security_name,
      quantity: r.quantity,
      priceGBP: r.price_gbp,
      totalGBP: r.total_gbp,
      feesGBP: r.fees_gbp || 0
    }))

    // Process all supported tax years
    const taxYearsToProcess = ['2021-22', '2022-23', '2023-24', '2024-25', '2025-26']
    let lastPools: any[] = []

    for (const year of taxYearsToProcess) {
      const clonedInput = JSON.parse(JSON.stringify(engineInput))
      const result = runCGTEngineCalculations(clonedInput, year)

      // Save computation summary
      await supabase.from('cgt_computations').upsert({
        user_id: user.id,
        tax_year: year,
        computed_at: new Date().toISOString(),
        total_proceeds_gbp: result.summary.totalProceeds,
        total_allowable_cost_gbp: result.summary.totalCost,
        total_gain_gbp: result.summary.totalGain,
        total_loss_gbp: result.summary.totalLoss,
        net_gain_gbp: result.summary.netGain,
        annual_exempt_amount_gbp: result.summary.annualExemptAmount,
        taxable_gain_gbp: result.summary.taxableGain
      }, { onConflict: 'user_id, tax_year' })

      // Clear old disposals for this year and re-insert
      await supabase.from('disposals').delete().match({ user_id: user.id, tax_year: year })

      if (result.disposals.length > 0) {
        const disposalInserts = result.disposals.map(d => ({
          user_id: user.id,
          tax_year: year,
          date: d.date,
          ticker: d.ticker,
          security_name: d.securityName,
          quantity: d.quantity,
          proceeds_gbp: d.proceedsGBP,
          allowable_cost_gbp: d.allowableCostGBP,
          gain_gbp: d.gainGBP,
          matching_rule: d.parts.map(p => p.rule).join(','),
          notes: JSON.stringify(d.parts)
        }))
        await supabase.from('disposals').insert(disposalInserts)
      }

      lastPools = result.pools
    }

    // Update S104 pools with the latest state (from last year processed)
    await supabase.from('section_104_pools').delete().match({ user_id: user.id })
    if (lastPools.length > 0) {
      const poolInserts = lastPools.map(p => ({
        user_id: user.id,
        ticker: p.ticker,
        total_shares: p.shares,
        total_allowable_cost_gbp: p.totalCost,
        last_updated: new Date().toISOString()
      }))
      await supabase.from('section_104_pools').insert(poolInserts)
    }

    return NextResponse.json({ success: true, yearsProcessed: taxYearsToProcess.length })
  } catch (error: any) {
    console.error('Recalculate error:', error)
    return NextResponse.json({ error: error.message || 'Recalculation failed' }, { status: 500 })
  }
}

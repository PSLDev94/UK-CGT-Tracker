import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Papa from 'papaparse'
import { parse } from 'date-fns'
import { runCGTEngineCalculations, RawTransaction } from '@/lib/cgt-engine'

function parseUKDate(dateStr: string, format: string | null): string | null {
  if (!dateStr) return null
  try {
    if (dateStr.includes('T')) {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    }
    
    const upperFormat = format ? format.toUpperCase() : ''
    const parts = dateStr.split(/[\/\-\s]/)
    
    if (parts.length >= 3) {
      let d: Date | null = null
      if (upperFormat === 'YYYY-MM-DD') d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      else if (upperFormat === 'MM/DD/YYYY' || upperFormat === 'MM-DD-YYYY') d = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]))
      else if (upperFormat === 'DD/MM/YYYY' || upperFormat === 'DD-MM-YYYY' || upperFormat === 'DD-MMM-YYYY') d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
      
      if (d && !isNaN(d.getTime())) {
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
      }
    }
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
    }
    return null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const supabase: any = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { csvContent, schema, filename } = await req.json()
    if (!csvContent || !schema) {
      return NextResponse.json({ error: 'Missing content or schema' }, { status: 400 })
    }

    // 1. Create upload record
    const { data: uploadEntry, error: uploadErr } = await supabase.from('uploads').insert({
      user_id: user.id,
      filename: filename || 'upload.csv',
      broker_detected: schema.broker_name,
      schema_mapping: schema,
      status: 'processing'
    }).select().single()

    if (uploadErr) throw new Error(uploadErr.message)

    // 2. Parse CSV
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true })
    const rows = parsed.data as any[]

    // --- BUG 1 FIX: Strict Server-Side Validation for US vs UK Dates ---
    if (schema.date_format === 'MM/DD/YYYY' || schema.date_format === 'MM-DD-YYYY') {
       let invalidUSCount = 0
       for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i]
          const dateStr = schema.date_column ? row[schema.date_column] : ''
          if (dateStr) {
             const parts = String(dateStr).split(/[\/\-\s]/)
             if (parts.length >= 3) {
                // If it claims to be MM/DD/YYYY, parts[0] is month. If > 12, it's statistically impossible.
                const putativeMonth = parseInt(parts[0], 10)
                if (putativeMonth > 12) {
                   invalidUSCount++
                }
             }
          }
       }
       if (invalidUSCount > 0) {
          // Force revert to UK Date Format because US interpretation is mathematically impossible
          schema.date_format = schema.date_format.includes('-') ? 'DD-MM-YYYY' : 'DD/MM/YYYY'
       }
    } else if (!schema.date_format || !schema.date_format.includes('YYYY')) {
       // Strong default to UK if undetermined
       schema.date_format = 'DD/MM/YYYY'
    }

    const transactions: RawTransaction[] = []

    for (const row of rows) {
      // Basic type inference
      let typeStr = ''
      if (schema.type_column && row[schema.type_column]) {
        typeStr = String(row[schema.type_column]).toUpperCase()
      } else if (schema.description_column && row[schema.description_column]) {
        typeStr = String(row[schema.description_column]).toUpperCase()
      }

      let type: string | null = null
      if (schema.buy_indicator && typeStr.includes(schema.buy_indicator.toUpperCase())) type = 'BUY'
      else if (schema.sell_indicator && typeStr.includes(schema.sell_indicator.toUpperCase())) type = 'SELL'
      else if (schema.dividend_indicator && typeStr.includes(schema.dividend_indicator.toUpperCase())) type = 'DIVIDEND'
      
      if (!type) {
        // Amount heuristic if no indicator matched perfectly
        if (schema.amount_column && row[schema.amount_column]) {
           const amt = parseFloat(String(row[schema.amount_column]).replace(/,/g, ''))
           if (amt < 0) type = 'BUY' // negative money means buy
           else if (amt > 0) type = 'SELL'
        }
      }
      
      if (!type) continue

      let ticker = schema.ticker_column ? row[schema.ticker_column] : ''
      if (!ticker && schema.description_column) {
         // simple extraction: first word of description
         ticker = String(row[schema.description_column]).split(' ')[0]
      }
      if (!ticker) continue

      let qty = 0
      if (schema.quantity_column) {
        qty = Math.abs(parseFloat(String(row[schema.quantity_column]).replace(/,/g, '')))
      }

      let price = 0
      if (schema.price_column) {
        price = Math.abs(parseFloat(String(row[schema.price_column]).replace(/,/g, '')))
      }

      let totalGBP = 0
      if (schema.amount_is_split) {
         if (type === 'BUY' && schema.debit_column) totalGBP = Math.abs(parseFloat(String(row[schema.debit_column]||'0').replace(/,/g, '')))
         if (type === 'SELL' && schema.credit_column) totalGBP = Math.abs(parseFloat(String(row[schema.credit_column]||'0').replace(/,/g, '')))
      } else if (schema.amount_column) {
         totalGBP = Math.abs(parseFloat(String(row[schema.amount_column]||'0').replace(/,/g, '')))
      }

      let fees = 0
      if (schema.fees_column) {
        fees = Math.abs(parseFloat(String(row[schema.fees_column]||'0').replace(/,/g, '')))
      }

      if (!price && qty > 0) price = totalGBP / qty

      const dateStr = schema.date_column ? row[schema.date_column] : ''
      const date = parseUKDate(dateStr, schema.date_format)

      if (!date || isNaN(qty) || isNaN(totalGBP) || qty <= 0) continue

      transactions.push({
        date,
        type,
        ticker: String(ticker).trim().toUpperCase(),
        securityName: schema.description_column ? String(row[schema.description_column]).substring(0, 255) : '',
        quantity: qty,
        priceGBP: price,
        totalGBP,
        feesGBP: fees
      })
    }

    // 3. Deduplicate and Insert Raw Transactions
    // Fetch existing transactions to prevent double counting
    const { data: existingTxns } = await supabase
      .from('transactions')
      .select('date, type, ticker, quantity, total_gbp')
      .eq('user_id', user.id)

    // Helper to generate a unique fingerprint for a transaction
    const getFingerprint = (t: any) => 
      `${t.date}-${t.type}-${t.ticker}-${Number(t.quantity || t.quantity).toFixed(4)}-${Number(t.totalGBP || t.total_gbp).toFixed(2)}`

    // Count frequencies of fingerprints in DB to handle identical transactions on the same day correctly
    const dbFrequencies: Record<string, number> = {}
    if (existingTxns) {
      for (const t of existingTxns) {
        const fp = getFingerprint(t)
        dbFrequencies[fp] = (dbFrequencies[fp] || 0) + 1
      }
    }

    // Filter parsed transactions to only include truly NEW ones
    const newDbTxns = []
    const newFrequencies: Record<string, number> = {}
    
    for (const t of transactions) {
      const fp = getFingerprint(t)
      newFrequencies[fp] = (newFrequencies[fp] || 0) + 1
      
      const currentInFile = newFrequencies[fp]
      const alreadyInDb = dbFrequencies[fp] || 0
      
      if (currentInFile > alreadyInDb) {
        // This is a new transaction missing from DB
        newDbTxns.push({
          user_id: user.id,
          upload_id: uploadEntry.id,
          date: t.date,
          type: t.type,
          ticker: t.ticker,
          security_name: t.securityName,
          quantity: t.quantity,
          price_gbp: t.priceGBP,
          total_gbp: t.totalGBP,
          fees_gbp: t.feesGBP,
          broker: schema.broker_name || 'Unknown'
        })
      }
    }

    // We can chunk this if very large, but usually < 1000 rows
    if (newDbTxns.length > 0) {
      const { error: txErr } = await supabase.from('transactions').insert(newDbTxns)
      if (txErr) throw new Error('Failed inserting transactions: ' + txErr.message)
    }

    // Update upload record
    await supabase.from('uploads').update({
      status: 'complete',
      row_count: rows.length,
      transactions_imported: newDbTxns.length
    }).eq('id', uploadEntry.id)

    // 4. Run CGT Engine
    // First, fetch ALL past and present transactions to build absolute pools
    const { data: allTxnRows } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: true })
    
    if (allTxnRows && allTxnRows.length > 0) {
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

      // Process all relevant tax years
      const taxYearsToProcess = ['2021-22', '2022-23', '2023-24', '2024-25', '2025-26']
      let lastPools: Array<{ ticker: string; shares: number; totalCost: number }> = []
      
      for (const year of taxYearsToProcess) {
        const clonedInput = JSON.parse(JSON.stringify(engineInput))
        const result = runCGTEngineCalculations(clonedInput, year)
        
        // Save computations
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
      
      // Update S104 pools with current state (from last year processed)
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
      
      // --- Bug 2: Missing Disposals Reconciliation ---
      const { count: totalSells } = await supabase.from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'SELL')
        
      const { count: totalDisposals } = await supabase.from('disposals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        
      if (totalSells !== null && totalDisposals !== null && totalDisposals < totalSells) {
         console.warn(`Reconciliation failure: ${totalSells} SELL rows but only ${totalDisposals} disposals created.`)
         await supabase.from('uploads').update({
           warning: `${totalSells - totalDisposals} sell transactions could not be matched. Please check your transaction history is complete or check logs for parsing errors.`
         }).eq('id', uploadEntry.id)
      }
    }

    return NextResponse.json({ success: true, count: newDbTxns.length })
  } catch (error: any) {
    console.error('Upload process error:', error)
    return NextResponse.json({ error: error.message || 'Processing failed' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Papa from 'papaparse'
import { runCGTEngineCalculations, RawTransaction } from '@/lib/cgt-engine'
import { parseBrokerDateToISO } from '@/lib/parse-broker-date'

interface SkipReason {
  row: number
  reason: string
  raw_value?: string
  column?: string
}

/**
 * Parse rows against a schema, returning transactions + skip reasons.
 * Shared between preview and full-import modes.
 */
function parseRows(
  rows: any[],
  schema: any,
  providedFxRates: Record<string, string>,
  maxRows?: number
) {
  const transactions: RawTransaction[] = []
  const skipReasons: SkipReason[] = []
  const missingFxRates: Array<{ date: string; currency: string }> = []
  const typeCounts: Record<string, number> = {}

  const rowsToProcess = maxRows ? rows.slice(0, maxRows) : rows

  for (let rowIndex = 0; rowIndex < rowsToProcess.length; rowIndex++) {
    const row = rowsToProcess[rowIndex]

    // 1. Check Metadata Skip (IBKR)
    if (schema.has_metadata_rows && schema.metadata_column && schema.metadata_exclusion_value) {
      const colVal = String(row[schema.metadata_column] || '').trim()
      if (colVal === schema.metadata_exclusion_value || colVal === 'Header' || colVal === 'SubTotal') {
        skipReasons.push({ row: rowIndex + 2, reason: 'metadata_row', raw_value: colVal, column: schema.metadata_column })
        typeCounts['METADATA'] = (typeCounts['METADATA'] || 0) + 1
        continue
      }
    }

    // 2. Determine Type
    let typeStr = ''
    if (schema.type_column && row[schema.type_column]) {
      typeStr = String(row[schema.type_column]).trim()
    } else if (schema.description_column && row[schema.description_column]) {
      typeStr = String(row[schema.description_column]).trim()
    }

    let type: string | null = null
    
    if (schema.type_source === 'quantity_sign' && schema.quantity_column) {
       const qtyRaw = parseFloat(String(row[schema.quantity_column]).replace(/,/g, ''))
       if (!isNaN(qtyRaw)) {
          if (qtyRaw < 0) type = 'SELL'
          else if (qtyRaw > 0) type = 'BUY'
       }
    } else {
       const tsUpper = typeStr.toUpperCase()
       if (schema.buy_indicator && tsUpper.includes(schema.buy_indicator.toUpperCase())) type = 'BUY'
       else if (schema.sell_indicator && tsUpper.includes(schema.sell_indicator.toUpperCase())) type = 'SELL'
       else if (schema.dividend_indicator && tsUpper.includes(schema.dividend_indicator.toUpperCase())) type = 'DIVIDEND'
       
       if (tsUpper === 'ORDER') {
          const explicitDir = String(row['Buy / Sell'] || '').toUpperCase()
          if (explicitDir.includes('BUY')) type = 'BUY'
          if (explicitDir.includes('SELL')) type = 'SELL'
       }

       if (!type && schema.amount_column && row[schema.amount_column]) {
          const amt = parseFloat(String(row[schema.amount_column]).replace(/,/g, ''))
          if (amt < 0) type = 'BUY'
          else if (amt > 0) type = 'SELL'
       }
    }
    
    if (!type) {
      skipReasons.push({
        row: rowIndex + 2,
        reason: 'type_not_detected',
        raw_value: typeStr || '(empty)',
        column: schema.type_column || schema.description_column || 'unknown'
      })
      typeCounts['SKIPPED'] = (typeCounts['SKIPPED'] || 0) + 1
      continue
    }

    typeCounts[type] = (typeCounts[type] || 0) + 1

    // 3. Ticker
    let ticker = schema.ticker_column && row[schema.ticker_column] ? String(row[schema.ticker_column]) : ''
    if (!ticker && schema.description_column && typeStr) {
       if (schema.ticker_from_description) {
          const regexStr = schema.ticker_regex || '^.+\\s+(\\S+)\\s+(Bought|Sold|Dividend|Buy|Sell)$'
          try {
             const regex = new RegExp(regexStr, 'i')
             const match = typeStr.match(regex)
             if (match && match[1]) {
                ticker = match[1]
             } else {
                const parts = typeStr.split(' ')
                const typeIdx = parts.findIndex((p: string) => 
                  p.toUpperCase().includes('BOUGHT') || p.toUpperCase().includes('SOLD') || p.toUpperCase().includes('BUY') || p.toUpperCase().includes('SELL')
                )
                if (typeIdx > 0) ticker = parts[typeIdx - 1]
             }
          } catch {
             ticker = typeStr.split(' ')[0]
          }
       } else {
          ticker = typeStr.split(' ')[0]
       }
    }
    if (!ticker) {
      skipReasons.push({
        row: rowIndex + 2,
        reason: 'ticker_not_found',
        raw_value: row[schema.description_column] || row[schema.ticker_column] || '(empty)',
        column: schema.ticker_column || schema.description_column || 'unknown'
      })
      typeCounts['SKIPPED'] = (typeCounts['SKIPPED'] || 0) + 1
      typeCounts[type] = (typeCounts[type] || 1) - 1
      continue
    }

    // 4. Quantities & Costs
    let qty = 0
    if (schema.quantity_column) {
      qty = Math.abs(parseFloat(String(row[schema.quantity_column]).replace(/,/g, '')))
    }

    let price = 0
    if (schema.price_column) {
      price = Math.abs(parseFloat(String(row[schema.price_column]).replace(/,/g, '')))
      if (schema.price_column.toLowerCase().includes('(p)') || schema.price_column.toLowerCase().includes('pence')) {
         price = price / 100
      }
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
    const date = parseBrokerDateToISO(dateStr)

    if (!date) {
      skipReasons.push({
        row: rowIndex + 2,
        reason: 'invalid_date',
        raw_value: dateStr || '(empty)',
        column: schema.date_column
      })
      typeCounts['SKIPPED'] = (typeCounts['SKIPPED'] || 0) + 1
      typeCounts[type] = (typeCounts[type] || 1) - 1
      continue
    }

    if (isNaN(qty) || qty <= 0) {
      // Dividends may legitimately have 0 quantity — skip silently only for BUY/SELL
      if (type !== 'DIVIDEND') {
        skipReasons.push({
          row: rowIndex + 2,
          reason: 'invalid_quantity',
          raw_value: String(row[schema.quantity_column] || '(empty)'),
          column: schema.quantity_column
        })
        typeCounts['SKIPPED'] = (typeCounts['SKIPPED'] || 0) + 1
        typeCounts[type] = (typeCounts[type] || 1) - 1
      }
      continue
    }

    // 5. FX Check
    let original_currency = 'GBP'
    if (schema.currency_column && row[schema.currency_column]) {
      original_currency = String(row[schema.currency_column]).toUpperCase().trim()
    } else if (schema.default_currency) {
      original_currency = schema.default_currency.toUpperCase().trim()
    }
    
    if (['GBX', 'GBP', '£', 'PENCE'].includes(original_currency)) {
      original_currency = 'GBP'
    }

    let fxRateAttr = null

    if (original_currency !== 'GBP') {
       const fxKey = `${date}-${original_currency}`
       if (providedFxRates[fxKey]) {
          fxRateAttr = parseFloat(providedFxRates[fxKey])
          totalGBP = totalGBP * fxRateAttr
          price = price * fxRateAttr
          fees = fees * fxRateAttr
       } else {
          missingFxRates.push({ date, currency: original_currency })
          skipReasons.push({
            row: rowIndex + 2,
            reason: 'missing_fx_rate',
            raw_value: `${original_currency} on ${date}`
          })
          continue
       }
    }

    transactions.push({
      date,
      type,
      ticker: String(ticker).trim().toUpperCase(),
      securityName: schema.description_column ? String(row[schema.description_column]).substring(0, 255) : '',
      quantity: qty,
      priceGBP: price,
      totalGBP,
      feesGBP: fees,
      originalCurrency: original_currency !== 'GBP' ? original_currency : undefined,
      fxRate: fxRateAttr || undefined
    })
  }

  return { transactions, skipReasons, missingFxRates, typeCounts }
}


export async function POST(req: Request) {
  try {
    const supabase: any = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const isPreview = url.searchParams.get('preview') === 'true'

    const { csvContent, schema, filename, fx_rates } = await req.json()
    if (!csvContent || !schema) {
      return NextResponse.json({ error: 'Missing content or schema' }, { status: 400 })
    }

    // Parse CSV
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true })
    const rows = parsed.data as any[]
    const providedFxRates: Record<string, string> = fx_rates || {}

    // ═══════════════════════════════════════════════
    // PREVIEW MODE — parse without inserting anything
    // ═══════════════════════════════════════════════
    if (isPreview) {
      const { transactions, skipReasons, typeCounts } = parseRows(rows, schema, providedFxRates)

      // Get sample date for display
      let sampleDate = null
      if (rows.length > 0 && schema.date_column) {
        const rawDate = rows[0][schema.date_column]
        const parsedDate = parseBrokerDateToISO(rawDate)
        if (rawDate && parsedDate) {
          const d = new Date(parsedDate)
          sampleDate = {
            raw: rawDate,
            parsed: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
          }
        }
      }

      return NextResponse.json({
        preview: true,
        parsed: transactions.slice(0, 10),
        skipReasons: skipReasons.slice(0, 20),
        typeCounts,
        totalRows: rows.length,
        detectedBroker: schema.broker_name || 'Unknown',
        sampleDate,
      })
    }

    // ═══════════════════════════════════════════════
    // FULL IMPORT MODE
    // ═══════════════════════════════════════════════

    // 1. Create upload record
    const { data: uploadEntry, error: uploadErr } = await supabase.from('uploads').insert({
      user_id: user.id,
      filename: filename || 'upload.csv',
      broker_detected: schema.broker_name,
      schema_mapping: schema,
      status: 'processing'
    }).select().single()

    if (uploadErr) throw new Error(uploadErr.message)

    // 2. Parse all rows
    const { transactions, skipReasons, missingFxRates, typeCounts } = parseRows(rows, schema, providedFxRates)

    // Log full skip reasons to server console
    if (skipReasons.length > 0) {
      console.warn(`[Upload ${uploadEntry.id}] ${skipReasons.length} rows skipped:`, JSON.stringify(skipReasons, null, 2))
    }
    
    if (missingFxRates.length > 0) {
       const uniqueMissing = missingFxRates.filter((v,i,a)=>a.findIndex(t=>(t.date === v.date && t.currency===v.currency))===i)
       return NextResponse.json({ require_fx: true, missing_rates: uniqueMissing }, { status: 400 })
    }

    // 3. Deduplicate and Insert Raw Transactions
    const { data: existingTxns } = await supabase
      .from('transactions')
      .select('date, type, ticker, quantity, total_gbp')
      .eq('user_id', user.id)

    const getFingerprint = (t: any) => 
      `${t.date}-${t.type}-${t.ticker}-${Number(t.quantity || t.quantity).toFixed(4)}-${Number(t.totalGBP || t.total_gbp).toFixed(2)}`

    const dbFrequencies: Record<string, number> = {}
    if (existingTxns) {
      for (const t of existingTxns) {
        const fp = getFingerprint(t)
        dbFrequencies[fp] = (dbFrequencies[fp] || 0) + 1
      }
    }

    const newDbTxns = []
    const newFrequencies: Record<string, number> = {}
    
    for (const t of transactions) {
      const fp = getFingerprint(t)
      newFrequencies[fp] = (newFrequencies[fp] || 0) + 1
      
      const currentInFile = newFrequencies[fp]
      const alreadyInDb = dbFrequencies[fp] || 0
      
      if (currentInFile > alreadyInDb) {
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

    if (newDbTxns.length > 0) {
      const { error: txErr } = await supabase.from('transactions').insert(newDbTxns)
      if (txErr) throw new Error('Failed inserting transactions: ' + txErr.message)
    }

    // 4. Determine upload status based on import results
    let uploadStatus = 'complete'
    let warningType: string | null = null

    if (newDbTxns.length === 0 && rows.length > 0) {
      uploadStatus = 'warning'
      warningType = 'zero_imports'
    } else if (newDbTxns.length < rows.length * 0.5 && rows.length > 5) {
      uploadStatus = 'warning'
      warningType = 'low_imports'
    }

    // Update upload record with results
    await supabase.from('uploads').update({
      status: uploadStatus,
      row_count: rows.length,
      transactions_imported: newDbTxns.length,
      warning_type: warningType,
      skip_reasons: skipReasons.slice(0, 20)
    }).eq('id', uploadEntry.id)

    // 5. Run CGT Engine
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

      const taxYearsToProcess = ['2021-22', '2022-23', '2023-24', '2024-25', '2025-26']
      let lastPools: Array<{ ticker: string; shares: number; totalCost: number }> = []
      
      for (const year of taxYearsToProcess) {
        const clonedInput = JSON.parse(JSON.stringify(engineInput))
        const result = runCGTEngineCalculations(clonedInput, year)
        
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
      
      // Reconciliation check
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

    return NextResponse.json({
      success: true,
      count: newDbTxns.length,
      totalRows: rows.length,
      warningType,
      skipReasons: skipReasons.slice(0, 20),
      typeCounts,
      filename: filename || 'upload.csv',
    })
  } catch (error: any) {
    console.error('Upload process error:', error)
    return NextResponse.json({ error: error.message || 'Processing failed' }, { status: 500 })
  }
}

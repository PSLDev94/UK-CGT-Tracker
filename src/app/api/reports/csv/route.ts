import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase: any = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const year = req.nextUrl.searchParams.get('year')

    // Build query — if year is specified, filter transactions to that tax year range
    let query = supabase
      .from('transactions')
      .select('date, type, ticker, security_name, quantity, price_gbp, total_gbp, fees_gbp, original_currency, fx_rate, broker')
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    const { data: transactions, error } = await query

    if (error) throw new Error(error.message)

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions found.' }, { status: 404 })
    }

    // Build CSV
    const headers = [
      'Date',
      'Type',
      'Ticker',
      'Security Name',
      'Quantity',
      'Price (GBP)',
      'Total (GBP)',
      'Fees (GBP)',
      'Original Currency',
      'FX Rate',
      'Broker',
    ]

    const csvRows: string[] = [headers.join(',')]

    for (const t of transactions) {
      const row = [
        t.date,
        t.type,
        t.ticker,
        `"${(t.security_name || '').replace(/"/g, '""')}"`,
        t.quantity,
        t.price_gbp,
        t.total_gbp,
        t.fees_gbp || 0,
        t.original_currency || 'GBP',
        t.fx_rate || 1,
        t.broker || '',
      ]
      csvRows.push(row.join(','))
    }

    const csvContent = csvRows.join('\n')
    const filename = year
      ? `CGT-Transactions-${year}.csv`
      : `CGT-Transactions-All.csv`

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('CSV export error:', error)
    return NextResponse.json({ error: error.message || 'Failed to export CSV' }, { status: 500 })
  }
}

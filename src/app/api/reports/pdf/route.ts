import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { CGTSummaryReport, SA108Report } from '@/lib/pdf-reports'

export async function GET(req: NextRequest) {
  try {
    const supabase: any = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const year = req.nextUrl.searchParams.get('year') || '2024-25'
    const type = req.nextUrl.searchParams.get('type') || 'summary'

    // Fetch computation for this tax year
    const { data: computation } = await supabase
      .from('cgt_computations')
      .select('*')
      .eq('user_id', user.id)
      .eq('tax_year', year)
      .single()

    if (!computation) {
      return NextResponse.json(
        { error: 'No CGT computation found for this tax year. Please upload transactions first.' },
        { status: 404 }
      )
    }

    // Fetch disposals for this tax year
    const { data: disposals } = await supabase
      .from('disposals')
      .select('*')
      .eq('user_id', user.id)
      .eq('tax_year', year)
      .order('date', { ascending: true })

    const disposalList = disposals || []

    let pdfBuffer: Buffer

    if (type === 'sa108') {
      pdfBuffer = await renderToBuffer(
        React.createElement(SA108Report, {
          taxYear: year,
          computation: {
            total_proceeds_gbp: computation.total_proceeds_gbp || 0,
            total_allowable_cost_gbp: computation.total_allowable_cost_gbp || 0,
            total_gain_gbp: computation.total_gain_gbp || 0,
            total_loss_gbp: computation.total_loss_gbp || 0,
            net_gain_gbp: computation.net_gain_gbp || 0,
            annual_exempt_amount_gbp: computation.annual_exempt_amount_gbp || 3000,
            taxable_gain_gbp: computation.taxable_gain_gbp || 0,
          },
          disposalCount: disposalList.length,
        }) as any
      )
    } else {
      pdfBuffer = await renderToBuffer(
        React.createElement(CGTSummaryReport, {
          taxYear: year,
          computation: {
            total_proceeds_gbp: computation.total_proceeds_gbp || 0,
            total_allowable_cost_gbp: computation.total_allowable_cost_gbp || 0,
            total_gain_gbp: computation.total_gain_gbp || 0,
            total_loss_gbp: computation.total_loss_gbp || 0,
            net_gain_gbp: computation.net_gain_gbp || 0,
            annual_exempt_amount_gbp: computation.annual_exempt_amount_gbp || 3000,
            taxable_gain_gbp: computation.taxable_gain_gbp || 0,
          },
          disposals: disposalList,
        }) as any
      )
    }

    const filename = type === 'sa108'
      ? `SA108-Reference-${year}.pdf`
      : `CGT-Summary-${year}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate PDF' }, { status: 500 })
  }
}

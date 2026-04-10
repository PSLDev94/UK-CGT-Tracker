import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// Register Inter font for PDF
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjQ.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf', fontWeight: 700 },
  ],
})

const colors = {
  primary: '#2563eb',
  green: '#16a34a',
  red: '#dc2626',
  dark: '#111827',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  border: '#e5e7eb',
  white: '#ffffff',
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 9,
    color: colors.dark,
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: colors.gray,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: colors.dark,
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryGrid: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.lightGray,
    borderRadius: 6,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 8,
    color: colors.gray,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 700,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    fontWeight: 600,
    fontSize: 8,
    color: colors.gray,
    textTransform: 'uppercase' as const,
  },
  tableCell: {
    fontSize: 8.5,
  },
  // Column widths for disposals table
  colDate: { width: '14%' },
  colAsset: { width: '14%' },
  colQty: { width: '10%' },
  colProceeds: { width: '16%' },
  colCost: { width: '16%' },
  colGain: { width: '16%' },
  colRule: { width: '14%' },
  // SA108 styles
  sa108Box: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    borderRadius: 4,
  },
  sa108Label: {
    flex: 2,
    backgroundColor: colors.lightGray,
    padding: 10,
    fontSize: 9,
    color: colors.dark,
  },
  sa108Value: {
    flex: 1,
    padding: 10,
    fontSize: 12,
    fontWeight: 700,
    color: colors.dark,
    textAlign: 'right',
  },
  disclaimer: {
    marginTop: 30,
    padding: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  disclaimerText: {
    fontSize: 7.5,
    color: '#92400e',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: colors.gray,
  },
})

function formatGBP(value: number): string {
  return `£${Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Friendlier matching rule labels
function ruleLabel(rule: string): string {
  if (rule.includes('SAME_DAY')) return 'Same-Day'
  if (rule.includes('BED_AND_BREAKFAST')) return 'B&B (30-Day)'
  if (rule.includes('SECTION_104')) return 'Section 104'
  return rule
}

// --------------- CGT Summary Report ---------------
interface CGTSummaryProps {
  taxYear: string
  computation: {
    total_proceeds_gbp: number
    total_allowable_cost_gbp: number
    total_gain_gbp: number
    total_loss_gbp: number
    net_gain_gbp: number
    annual_exempt_amount_gbp: number
    taxable_gain_gbp: number
  }
  disposals: Array<{
    date: string
    ticker: string
    security_name?: string | null
    quantity: number
    proceeds_gbp: number
    allowable_cost_gbp: number
    gain_gbp: number
    matching_rule: string
  }>
}

export function CGTSummaryReport({ taxYear, computation, disposals }: CGTSummaryProps) {
  const generatedDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Capital Gains Tax Summary</Text>
          <Text style={styles.subtitle}>Tax Year {taxYear} · Generated {generatedDate}</Text>
        </View>

        {/* Summary Cards */}
        <Text style={styles.sectionTitle}>Tax Position Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Proceeds</Text>
            <Text style={styles.summaryValue}>
              {formatGBP(computation.total_proceeds_gbp || 0)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Allowable Costs</Text>
            <Text style={styles.summaryValue}>
              {formatGBP(computation.total_allowable_cost_gbp || 0)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Gains</Text>
            <Text style={[styles.summaryValue, { color: colors.green }]}>
              {formatGBP(computation.total_gain_gbp || 0)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Losses</Text>
            <Text style={[styles.summaryValue, { color: colors.red }]}>
              {formatGBP(computation.total_loss_gbp || 0)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Annual Exempt Amount</Text>
            <Text style={styles.summaryValue}>
              {formatGBP(computation.annual_exempt_amount_gbp || 3000)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Taxable Gain</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              {formatGBP(computation.taxable_gain_gbp || 0)}
            </Text>
          </View>
        </View>

        {/* Disposals Table */}
        <Text style={styles.sectionTitle}>
          Disposals ({disposals.length} transaction{disposals.length !== 1 ? 's' : ''})
        </Text>
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDate]}>Date</Text>
            <Text style={[styles.tableHeaderText, styles.colAsset]}>Asset</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.colProceeds]}>Proceeds</Text>
            <Text style={[styles.tableHeaderText, styles.colCost]}>Cost</Text>
            <Text style={[styles.tableHeaderText, styles.colGain]}>Gain/Loss</Text>
            <Text style={[styles.tableHeaderText, styles.colRule]}>Rule</Text>
          </View>
          {/* Data Rows */}
          {disposals.map((d, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.tableCell, styles.colDate]}>{formatDate(d.date)}</Text>
              <Text style={[styles.tableCell, styles.colAsset]}>{d.ticker}</Text>
              <Text style={[styles.tableCell, styles.colQty]}>{d.quantity}</Text>
              <Text style={[styles.tableCell, styles.colProceeds]}>{formatGBP(d.proceeds_gbp)}</Text>
              <Text style={[styles.tableCell, styles.colCost]}>{formatGBP(d.allowable_cost_gbp)}</Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.colGain,
                  { color: d.gain_gbp >= 0 ? colors.green : colors.red },
                ]}
              >
                {d.gain_gbp >= 0 ? '+' : '-'}{formatGBP(d.gain_gbp)}
              </Text>
              <Text style={[styles.tableCell, styles.colRule]}>{ruleLabel(d.matching_rule)}</Text>
            </View>
          ))}
          {disposals.length === 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '100%', textAlign: 'center', color: colors.gray }]}>
                No disposals recorded for this tax year.
              </Text>
            </View>
          )}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This report is generated by CGT Tracker for guidance purposes only. It should not be
            considered professional tax advice. Always consult a qualified tax advisor before
            submitting your self-assessment tax return. CGT Tracker does not guarantee the accuracy
            of calculations — please verify all figures independently.
          </Text>
        </View>

        <Text style={styles.footer}>
          CGT Tracker · www.cgttracker.co.uk · Report generated {generatedDate}
        </Text>
      </Page>
    </Document>
  )
}

// --------------- SA108 Reference Sheet ---------------
interface SA108Props {
  taxYear: string
  computation: {
    total_proceeds_gbp: number
    total_allowable_cost_gbp: number
    total_gain_gbp: number
    total_loss_gbp: number
    net_gain_gbp: number
    annual_exempt_amount_gbp: number
    taxable_gain_gbp: number
  }
  disposalCount: number
}

export function SA108Report({ taxYear, computation, disposalCount }: SA108Props) {
  const generatedDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>SA108 Reference Sheet</Text>
          <Text style={styles.subtitle}>
            Tax Year {taxYear} · Self-Assessment Capital Gains Summary · Generated {generatedDate}
          </Text>
        </View>

        <View style={{ marginBottom: 16, padding: 12, backgroundColor: '#eff6ff', borderRadius: 4 }}>
          <Text style={{ fontSize: 9, color: '#1e40af', lineHeight: 1.5 }}>
            Transfer the figures below to the corresponding boxes on your HMRC Self-Assessment
            SA108 (Capital Gains) supplementary page. These values are based on your imported
            transaction data.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Section 1 — Listed shares and securities</Text>

        <View style={styles.sa108Box}>
          <Text style={styles.sa108Label}>Number of disposals</Text>
          <Text style={styles.sa108Value}>{disposalCount}</Text>
        </View>

        <View style={styles.sa108Box}>
          <Text style={styles.sa108Label}>Disposal proceeds (Box 3)</Text>
          <Text style={styles.sa108Value}>{formatGBP(computation.total_proceeds_gbp || 0)}</Text>
        </View>

        <View style={styles.sa108Box}>
          <Text style={styles.sa108Label}>Allowable costs (including purchase price) (Box 4)</Text>
          <Text style={styles.sa108Value}>{formatGBP(computation.total_allowable_cost_gbp || 0)}</Text>
        </View>

        <View style={styles.sa108Box}>
          <Text style={styles.sa108Label}>Gains in the year, before losses (Box 5)</Text>
          <Text style={[styles.sa108Value, { color: colors.green }]}>
            {formatGBP(computation.total_gain_gbp || 0)}
          </Text>
        </View>

        <View style={styles.sa108Box}>
          <Text style={styles.sa108Label}>Losses in the year (Box 6)</Text>
          <Text style={[styles.sa108Value, { color: colors.red }]}>
            {formatGBP(computation.total_loss_gbp || 0)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Section 2 — Summary</Text>

        <View style={styles.sa108Box}>
          <Text style={styles.sa108Label}>Total gains for the year (Box 34)</Text>
          <Text style={styles.sa108Value}>{formatGBP(computation.total_gain_gbp || 0)}</Text>
        </View>

        <View style={styles.sa108Box}>
          <Text style={styles.sa108Label}>Total losses for the year (Box 35)</Text>
          <Text style={styles.sa108Value}>{formatGBP(computation.total_loss_gbp || 0)}</Text>
        </View>

        <View style={styles.sa108Box}>
          <Text style={styles.sa108Label}>Net gains (gains minus losses) (Box 36)</Text>
          <Text style={styles.sa108Value}>
            {formatGBP(Math.max(0, (computation.net_gain_gbp || 0)))}
          </Text>
        </View>

        <View style={styles.sa108Box}>
          <Text style={styles.sa108Label}>Annual Exempt Amount (Box 37)</Text>
          <Text style={styles.sa108Value}>
            {formatGBP(computation.annual_exempt_amount_gbp || 3000)}
          </Text>
        </View>

        <View
          style={[
            styles.sa108Box,
            { borderColor: colors.primary, borderWidth: 2 },
          ]}
        >
          <Text style={[styles.sa108Label, { fontWeight: 700, backgroundColor: '#dbeafe' }]}>
            Taxable gains (Box 38) — amount subject to CGT
          </Text>
          <Text style={[styles.sa108Value, { color: colors.primary, fontSize: 14 }]}>
            {formatGBP(computation.taxable_gain_gbp || 0)}
          </Text>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This is a reference guide only. Box numbers are approximate and may vary by tax year.
            Always refer to the current HMRC SA108 form for exact field references. This tool
            provides estimates for guidance only — consult a qualified tax advisor before submitting
            your self-assessment.
          </Text>
        </View>

        <Text style={styles.footer}>
          CGT Tracker · www.cgttracker.co.uk · Report generated {generatedDate}
        </Text>
      </Page>
    </Document>
  )
}

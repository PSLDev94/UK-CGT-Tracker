'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Download, Table, Loader2 } from 'lucide-react'

export default function ReportsPage() {
  const [years, setYears] = useState<string[]>(['2024-25'])
  const [loading, setLoading] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadYears() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: computations } = await supabase
        .from('cgt_computations')
        .select('tax_year')
        .eq('user_id', user.id)
        .order('tax_year', { ascending: false })

      if (computations && computations.length > 0) {
        const uniqueYears = Array.from(new Set(computations.map((c: any) => c.tax_year)))
        setYears(uniqueYears)
      }
    }
    loadYears()
  }, [])

  const handleDownload = async (type: string, yearSelectId: string) => {
    const select = document.getElementById(yearSelectId) as HTMLSelectElement
    const year = select?.value || '2024-25'
    const key = `${type}-${year}`
    setLoading(key)

    try {
      let url: string
      let filename: string

      if (type === 'csv') {
        url = `/api/reports/csv?year=${year}`
        filename = `CGT-Transactions-${year}.csv`
      } else {
        url = `/api/reports/pdf?year=${year}&type=${type}`
        filename = type === 'sa108'
          ? `SA108-Reference-${year}.pdf`
          : `CGT-Summary-${year}.pdf`
      }

      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Download failed')
      }

      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (err: any) {
      alert(err.message || 'Failed to download report')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports & Exports</h1>
        <p className="text-gray-600 mt-1">Download your tax summaries and full transaction history.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* CGT Summary PDF */}
        <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4">
             <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">CGT Summary PDF</h3>
          <p className="text-sm text-gray-600 mb-6 flex-1">
            A complete breakdown of your capital gains position, disposals, and matched rules for a specific tax year. Suitable for your accountant.
          </p>
          
          <div className="flex items-center gap-3">
             <select id="year-summary" className="border rounded-md px-3 py-2 flex-1 text-sm">
               {years.map(y => <option key={y} value={y}>{y}</option>)}
             </select>
             <button
               onClick={() => handleDownload('summary', 'year-summary')}
               disabled={loading === 'summary-' + (document.getElementById('year-summary') as HTMLSelectElement)?.value}
               className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center text-sm disabled:opacity-50 whitespace-nowrap"
             >
               {loading?.startsWith('summary') ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
               Download
             </button>
          </div>
        </div>

        {/* SA108 Reference */}
        <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-4">
             <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">SA108 Reference Guide</h3>
          <p className="text-sm text-gray-600 mb-6 flex-1">
            A simplified 1-pager containing only the specific boxes you need to fill out on your HMRC self-assessment tax return.
          </p>
          
          <div className="flex items-center gap-3">
             <select id="year-sa108" className="border rounded-md px-3 py-2 flex-1 text-sm">
               {years.map(y => <option key={y} value={y}>{y}</option>)}
             </select>
             <button
               onClick={() => handleDownload('sa108', 'year-sa108')}
               disabled={loading?.startsWith('sa108')}
               className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 flex items-center text-sm disabled:opacity-50 whitespace-nowrap"
             >
               {loading?.startsWith('sa108') ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
               Download
             </button>
          </div>
        </div>

        {/* CSV Export */}
        <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mb-4">
             <Table className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Transaction Export (CSV)</h3>
          <p className="text-sm text-gray-600 mb-6 flex-1">
            Export all your imported transactions as a CSV file for audit purposes or use in spreadsheets.
          </p>
          
          <div className="flex items-center gap-3">
             <select id="year-csv" className="border rounded-md px-3 py-2 flex-1 text-sm">
               <option value="">All years</option>
               {years.map(y => <option key={y} value={y}>{y}</option>)}
             </select>
             <button
               onClick={() => handleDownload('csv', 'year-csv')}
               disabled={loading?.startsWith('csv')}
               className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 flex items-center text-sm disabled:opacity-50 whitespace-nowrap"
             >
               {loading?.startsWith('csv') ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
               Download
             </button>
          </div>
        </div>

      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
        <strong>Disclaimer:</strong> These reports are generated for guidance only. Always consult a qualified tax advisor before submitting your self-assessment.
      </div>
    </div>
  )
}

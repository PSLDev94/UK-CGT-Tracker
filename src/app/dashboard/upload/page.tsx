'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, File, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

type Status = 'idle'|'uploading'|'detected'|'manual_mapping'|'previewing'|'fx_prompt'|'processing'|'complete'|'warning'|'error'

interface PreviewData {
  parsed: any[]
  skipReasons: any[]
  typeCounts: Record<string, number>
  totalRows: number
  detectedBroker: string
  sampleDate: { raw: string; parsed: string } | null
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [schema, setSchema] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [missingRates, setMissingRates] = useState<{date: string, currency: string}[]>([])
  const [fxInputs, setFxInputs] = useState<Record<string, string>>({})
  const [confidence, setConfidence] = useState(100)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [showSkipDetails, setShowSkipDetails] = useState(false)
  // Manual mapping state
  const [manualMap, setManualMap] = useState({
    date_column: '', type_column: '', ticker_column: '', quantity_column: '',
    price_column: '', amount_column: '', fees_column: '',
    buy_indicator: 'BUY', sell_indicator: 'SELL', dividend_indicator: 'DIVIDEND',
  })
  const [manualTypeValues, setManualTypeValues] = useState<string[]>([])

  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setStatus('idle')
      setErrorMsg('')
      setMissingRates([])
      setFxInputs({})
      setPreview(null)
      setImportResult(null)
    }
  }

  const handleDetect = async () => {
    if (!file) return
    setStatus('uploading')
    try {
      const slice = file.slice(0, 4096)
      const text = await slice.text()
      const res = await fetch('/api/upload/detect-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvSample: text })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to detect schema') }
      const data = await res.json()

      setConfidence(data.confidence ?? 50)
      setValidationErrors(data.validation_errors || [])
      setValidationWarnings(data.validation_warnings || [])
      setCsvHeaders(data.headers || [])

      if (data.confidence < 40 || (data.validation_errors && data.validation_errors.length > 0)) {
        // Trigger manual mapping
        setSchema(data.schema)
        if (data.schema) {
          setManualMap({
            date_column: data.schema.date_column || '',
            type_column: data.schema.type_column || '',
            ticker_column: data.schema.ticker_column || '',
            quantity_column: data.schema.quantity_column || '',
            price_column: data.schema.price_column || '',
            amount_column: data.schema.amount_column || '',
            fees_column: data.schema.fees_column || '',
            buy_indicator: data.schema.buy_indicator || 'BUY',
            sell_indicator: data.schema.sell_indicator || 'SELL',
            dividend_indicator: data.schema.dividend_indicator || 'DIVIDEND',
          })
        }
        setStatus('manual_mapping')
      } else {
        setSchema(data.schema)
        setStatus('detected')
      }
    } catch (err: any) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  const handlePreview = async (schemaToUse?: any) => {
    if (!file) return
    setStatus('previewing')
    try {
      const text = await file.text()
      const s = schemaToUse || schema
      const res = await fetch('/api/upload/process?preview=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text, schema: s, filename: file.name })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Preview failed') }
      const data = await res.json()
      setPreview(data)
      setSchema(s)
      setStatus('detected')
    } catch (err: any) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  const handleManualConfirm = () => {
    const built: any = {
      ...schema,
      date_column: manualMap.date_column || null,
      type_column: manualMap.type_column || null,
      ticker_column: manualMap.ticker_column || null,
      quantity_column: manualMap.quantity_column || null,
      price_column: manualMap.price_column || null,
      amount_column: manualMap.amount_column || null,
      fees_column: manualMap.fees_column || null,
      buy_indicator: manualMap.buy_indicator || null,
      sell_indicator: manualMap.sell_indicator || null,
      dividend_indicator: manualMap.dividend_indicator || null,
      date_format: 'DD/MM/YYYY',
      broker_name: schema?.broker_name || null,
    }
    handlePreview(built)
  }

  // Extract unique values from the selected type column for the manual mapping helper
  const loadTypeValues = async (col: string) => {
    if (!file || !col) { setManualTypeValues([]); return }
    try {
      const text = await file.slice(0, 8192).text()
      const Papa = (await import('papaparse')).default
      const p = Papa.parse(text, { header: true, skipEmptyLines: true })
      const vals = [...new Set((p.data as any[]).map(r => String(r[col] || '').trim()).filter(Boolean))]
      setManualTypeValues(vals)
    } catch { setManualTypeValues([]) }
  }

  const handleProcess = async () => {
    if (!file || !schema) return
    setStatus('processing')
    setErrorMsg('')
    try {
      const text = await file.text()
      const res = await fetch('/api/upload/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text, schema, filename: file.name, fx_rates: fxInputs })
      })
      if (!res.ok) {
        const d = await res.json()
        if (d.require_fx) { setMissingRates(d.missing_rates); setStatus('fx_prompt'); return }
        throw new Error(d.error || 'Failed to process file')
      }
      const data = await res.json()
      setImportResult(data)
      if (data.warningType) {
        setStatus('warning')
        setTimeout(() => { router.push('/dashboard'); router.refresh() }, 5000)
      } else {
        setStatus('complete')
        setTimeout(() => { router.push('/dashboard'); router.refresh() }, 2000)
      }
    } catch (err: any) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  const colOption = (val: string) => <option key={val} value={val}>{val}</option>
  const headerOptions = csvHeaders.map(h => colOption(h))

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Upload Transactions</h1>
      <div className="bg-white rounded-xl shadow-sm border p-8">

        {/* Step 1: File Selection */}
        {(status === 'idle' || status === 'uploading' || status === 'error') && (
          <div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:bg-gray-50 transition cursor-pointer relative">
              <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Upload a CSV file</h3>
              <p className="mt-1 text-sm text-gray-500">Drag and drop or click to select from your broker</p>
              {file && <p className="mt-4 font-medium text-blue-600 flex items-center justify-center"><File className="w-4 h-4 mr-2"/>{file.name}</p>}
            </div>
            {errorMsg && <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">{errorMsg}</div>}
            <div className="mt-6 flex justify-end">
              <button disabled={!file || status === 'uploading'} onClick={handleDetect} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center">
                {status === 'uploading' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Analyse Format
              </button>
            </div>
          </div>
        )}

        {/* Step 1.5: Manual Column Mapping */}
        {status === 'manual_mapping' && (
          <div>
            <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h3 className="text-lg font-semibold text-amber-800 flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5" /> Manual Column Mapping Required
              </h3>
              <p className="text-amber-700 text-sm">
                We&apos;re not fully confident we&apos;ve read this file correctly (confidence: {confidence}%).
                Please verify or correct the column mappings below.
              </p>
              {validationErrors.length > 0 && (
                <ul className="mt-2 text-sm text-red-700 list-disc pl-5">
                  {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>

            <div className="space-y-4 mb-6">
              {[
                { key: 'date_column', label: 'Date', required: true },
                { key: 'type_column', label: 'Transaction Type', required: false },
                { key: 'ticker_column', label: 'Ticker / Symbol', required: false },
                { key: 'quantity_column', label: 'Quantity', required: true },
                { key: 'price_column', label: 'Price per Share', required: false },
                { key: 'amount_column', label: 'Total Amount', required: false },
                { key: 'fees_column', label: 'Fees', required: false },
              ].map(field => (
                <div key={field.key} className="flex items-center gap-4">
                  <label className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">
                    {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <select
                    value={(manualMap as any)[field.key]}
                    onChange={e => {
                      setManualMap({ ...manualMap, [field.key]: e.target.value })
                      if (field.key === 'type_column') loadTypeValues(e.target.value)
                    }}
                    className="flex-1 border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">— Not in this file —</option>
                    {headerOptions}
                  </select>
                </div>
              ))}

              {manualTypeValues.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-md border text-sm">
                  <p className="font-medium text-gray-700 mb-1">Unique values in &quot;{manualMap.type_column}&quot;:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {manualTypeValues.map(v => (
                      <span key={v} className="px-2 py-0.5 bg-white border rounded text-xs text-gray-700">{v}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 pt-2">
                {['buy_indicator', 'sell_indicator', 'dividend_indicator'].map(key => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                    <input
                      value={(manualMap as any)[key]}
                      onChange={e => setManualMap({ ...manualMap, [key]: e.target.value })}
                      className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setStatus('idle')} className="px-6 py-2 border rounded-md hover:bg-gray-50 text-gray-700">Go Back</button>
              <button
                onClick={handleManualConfirm}
                disabled={!manualMap.date_column || !manualMap.quantity_column}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Preview Import
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation + Preview */}
        {(status === 'detected' || status === 'processing' || status === 'previewing') && schema && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                Format Detected
              </h3>
              <p className="text-gray-600 mt-1">
                Broker: <strong className="text-gray-900">{schema.broker_name || 'Unknown'}</strong>
                {confidence < 70 && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">Confidence: {confidence}%</span>}
              </p>
            </div>

            {/* Schema mapping */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
              <h4 className="font-semibold mb-2 text-sm text-gray-700">Column mapping:</h4>
              <ul className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                <li><span className="font-medium text-gray-800">Date:</span> {schema.date_column} <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{schema.date_format}</span></li>
                <li><span className="font-medium text-gray-800">Type:</span> {schema.type_column || 'from description'}</li>
                <li><span className="font-medium text-gray-800">Ticker:</span> {schema.ticker_column || (schema.description_column ? schema.description_column + ' (parsed)' : '—')}</li>
                <li><span className="font-medium text-gray-800">Quantity:</span> {schema.quantity_column}</li>
                <li><span className="font-medium text-gray-800">Price:</span> {schema.price_column || '—'}</li>
                <li><span className="font-medium text-gray-800">Amount:</span> {schema.amount_column || '—'}</li>
              </ul>
              {validationWarnings.length > 0 && (
                <div className="mt-3 text-xs text-amber-700">
                  {validationWarnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
                </div>
              )}
            </div>

            {/* Preview results */}
            {preview && (
              <div className="mb-6 space-y-4">
                {preview.sampleDate && (
                  <p className="text-sm text-gray-600">
                    Date example: <span className="font-mono text-gray-800">&quot;{preview.sampleDate.raw}&quot;</span> → <strong>{preview.sampleDate.parsed}</strong>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(preview.typeCounts).map(([type, count]) => (
                    <span key={type} className={`px-3 py-1 rounded-full text-xs font-medium ${
                      type === 'SKIPPED' ? 'bg-red-100 text-red-700' :
                      type === 'BUY' ? 'bg-green-100 text-green-700' :
                      type === 'SELL' ? 'bg-blue-100 text-blue-700' :
                      type === 'DIVIDEND' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{type}: {count}</span>
                  ))}
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Total rows: {preview.totalRows}</span>
                </div>

                {(preview.skipReasons?.length || 0) > 0 && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <button onClick={() => setShowSkipDetails(!showSkipDetails)} className="flex items-center gap-2 text-sm font-medium text-amber-800 w-full">
                      <AlertTriangle className="w-4 h-4" />
                      {preview.skipReasons.length} row{preview.skipReasons.length !== 1 ? 's' : ''} could not be parsed and will be skipped
                      {showSkipDetails ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                    </button>
                    {showSkipDetails && (
                      <div className="mt-3 max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="text-left text-gray-500"><th className="pr-3 pb-1">Row</th><th className="pr-3 pb-1">Reason</th><th className="pb-1">Value</th></tr></thead>
                          <tbody>
                            {preview.skipReasons.map((sr: any, i: number) => (
                              <tr key={i} className="border-t border-amber-100">
                                <td className="pr-3 py-1 text-gray-700">{sr.row}</td>
                                <td className="pr-3 py-1 text-amber-700">{sr.reason}</td>
                                <td className="py-1 font-mono text-gray-600 truncate max-w-[200px]">{sr.raw_value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Preview table */}
                {preview.parsed.length > 0 && (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50"><tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Ticker</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Total £</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {preview.parsed.map((t: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5">{t.date}</td>
                            <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs ${t.type === 'BUY' ? 'bg-green-100 text-green-700' : t.type === 'SELL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{t.type}</span></td>
                            <td className="px-3 py-1.5 font-medium">{t.ticker}</td>
                            <td className="px-3 py-1.5 text-right">{t.quantity}</td>
                            <td className="px-3 py-1.5 text-right">£{t.totalGBP?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!preview && status !== 'previewing' && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-800">
                Click &quot;Preview Import&quot; to see a breakdown of transactions before importing.
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => { setStatus('idle'); setPreview(null) }} disabled={status === 'processing' || status === 'previewing'} className="px-6 py-2 border rounded-md hover:bg-gray-50 text-gray-700 disabled:opacity-50">Go Back</button>
              {!preview ? (
                <button onClick={() => handlePreview()} disabled={status === 'previewing'} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center">
                  {status === 'previewing' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Preview Import
                </button>
              ) : (
                <button onClick={handleProcess} disabled={status === 'processing'} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center">
                  {status === 'processing' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : `Import ${preview.parsed.length} Transactions`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* FX Missing Rates */}
        {status === 'fx_prompt' && (
          <div>
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Foreign Currency Detected</h3>
              <p className="text-yellow-700 text-sm">Please enter GBP exchange rates for these transactions.</p>
            </div>
            <div className="space-y-4 mb-6">
              {missingRates.map((rate, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border rounded-md">
                  <span className="font-medium text-gray-700">{rate.date}</span>
                  <div className="flex items-center">
                    <span className="mr-2 text-sm text-gray-500">1 {rate.currency} = </span>
                    <input type="number" step="0.0001" className="border rounded px-3 py-1 w-24 text-right focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="£ GBP"
                      value={fxInputs[`${rate.date}-${rate.currency}`] || ''}
                      onChange={e => setFxInputs({...fxInputs, [`${rate.date}-${rate.currency}`]: e.target.value})}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setStatus('detected')} className="px-6 py-2 border rounded-md hover:bg-gray-50 text-gray-700">Cancel</button>
              <button onClick={handleProcess} disabled={missingRates.some(r => !fxInputs[`${r.date}-${r.currency}`] || parseFloat(fxInputs[`${r.date}-${r.currency}`]) <= 0)} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">Confirm Rates &amp; Import</button>
            </div>
          </div>
        )}

        {/* Complete */}
        {status === 'complete' && (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Transactions Imported Successfully</h2>
            <p className="text-gray-600">{importResult?.count || 0} transactions imported. Redirecting to dashboard...</p>
          </div>
        )}

        {/* Warning (zero/low imports) */}
        {status === 'warning' && importResult && (
          <div className="py-8">
            <div className="flex items-start gap-4 p-6 bg-amber-50 rounded-xl border border-amber-200 mb-6">
              <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                {importResult.warningType === 'zero_imports' ? (
                  <>
                    <h2 className="text-xl font-bold text-amber-900 mb-2">0 transactions imported</h2>
                    <p className="text-amber-800">We couldn&apos;t import any transactions from <strong>{importResult.filename}</strong>. This usually means the column format wasn&apos;t recognised correctly. Please try uploading again — if the problem persists, email <a href="mailto:support@cgttracker.com" className="underline font-medium">support@cgttracker.com</a> with your CSV attached and we&apos;ll add support for your broker within 24 hours.</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-amber-900 mb-2">Only {importResult.count} of {importResult.totalRows} rows imported</h2>
                    <p className="text-amber-800">Some transactions may be missing. This can happen when transaction types aren&apos;t recognised or data is incomplete.</p>
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500 text-center">Redirecting to dashboard...</p>
          </div>
        )}

      </div>
    </div>
  )
}

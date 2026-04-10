'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, File, CheckCircle } from 'lucide-react'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle'|'uploading'|'detected'|'processing'|'complete'|'error'>('idle')
  const [schema, setSchema] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setStatus('idle')
      setErrorMsg('')
    }
  }

  const handleDetect = async () => {
    if (!file) return
    setStatus('uploading')
    
    try {
      // Read a slice of the file (first ~4KB is plenty for 15 rows)
      const slice = file.slice(0, 4096)
      const text = await slice.text()
      
      const res = await fetch('/api/upload/detect-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvSample: text })
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to detect schema')
      }

      const data = await res.json()
      setSchema(data.schema)
      setStatus('detected')
    } catch (err: any) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  const handleProcess = async () => {
    if (!file || !schema) return
    setStatus('processing')

    try {
      // Read entire file now (spec says max 10MB)
      const text = await file.text()
      
      const res = await fetch('/api/upload/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text, schema, filename: file.name })
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to process file')
      }

      setStatus('complete')
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 2000)
    } catch (err: any) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Upload Transactions</h1>
      
      <div className="bg-white rounded-xl shadow-sm border p-8">
        
        {/* Step 1: File Selection */}
        {status === 'idle' || status === 'uploading' || status === 'error' ? (
          <div>
             <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:bg-gray-50 transition cursor-pointer relative">
               <input 
                 type="file" 
                 accept=".csv" 
                 onChange={handleFileChange}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
               />
               <Upload className="mx-auto h-12 w-12 text-gray-400" />
               <h3 className="mt-2 text-sm font-semibold text-gray-900">Upload a CSV file</h3>
               <p className="mt-1 text-sm text-gray-500">Drag and drop or click to select from your broker</p>
               {file && <p className="mt-4 font-medium text-blue-600 flex items-center justify-center"><File className="w-4 h-4 mr-2"/> {file.name}</p>}
             </div>
             
             {errorMsg && (
               <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
                 {errorMsg}
               </div>
             )}

             <div className="mt-6 flex justify-end">
               <button
                 disabled={!file || status === 'uploading'}
                 onClick={handleDetect}
                 className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
               >
                 {status === 'uploading' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                 Analyze Format
               </button>
             </div>
          </div>
        ) : null}

        {/* Step 2: Confirmation */}
        {(status === 'detected' || status === 'processing') && schema ? (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                Format Detected
              </h3>
              <p className="text-gray-600 mt-1">We've analysed your file. Broker identified as: <strong className="text-gray-900">{schema.broker_name || 'Unknown'}</strong>.</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
              <h4 className="font-semibold mb-2 text-sm text-gray-700">Schema mapping identified:</h4>
              <ul className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                <li><span className="font-medium text-gray-800">Date:</span> {schema.date_column} ({schema.date_format})</li>
                <li><span className="font-medium text-gray-800">Ticker:</span> {schema.ticker_column ? schema.ticker_column : schema.description_column + ' (parsed)'}</li>
                <li><span className="font-medium text-gray-800">Quantity:</span> {schema.quantity_column}</li>
                <li><span className="font-medium text-gray-800">Price/Amount:</span> {schema.price_column || schema.amount_column}</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3">
               <button
                 onClick={() => setStatus('idle')}
                 disabled={status === 'processing'}
                 className="px-6 py-2 border rounded-md hover:bg-gray-50 text-gray-700 disabled:opacity-50"
               >
                 Go Back
               </button>
               <button
                 onClick={handleProcess}
                 disabled={status === 'processing'}
                 className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
               >
                 {status === 'processing' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : 'Import & Compute CGT'}
               </button>
            </div>
          </div>
        ) : null}

        {/* Step 3: Complete */}
        {status === 'complete' && (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Transactions Imported Successfully</h2>
            <p className="text-gray-600">Your Capital Gains Tax has been updated. Redirecting to dashboard...</p>
          </div>
        )}

      </div>
    </div>
  )
}

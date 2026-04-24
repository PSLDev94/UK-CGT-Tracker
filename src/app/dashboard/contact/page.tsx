'use client'

import { useState } from 'react'
import { Send, CheckCircle, AlertCircle, Mail, User, MessageSquare } from 'lucide-react'

export default function DashboardContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }

      setStatus('success')
      setName('')
      setEmail('')
      setMessage('')
    } catch (err: any) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Contact Us</h1>
        <p className="text-gray-600 leading-relaxed">
          Have a question, feedback, or need help with your CGT calculations? Send us a message and we&apos;ll get back to you within 24 hours.
        </p>
      </div>

      {/* Success State */}
      {status === 'success' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-green-400 to-emerald-500"></div>
          <div className="p-8 sm:p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Message Sent Successfully</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Thank you for reaching out. We&apos;ll review your message and respond to your email address within 24 hours.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="px-6 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Send another message
            </button>
          </div>
        </div>
      ) : (
        /* Form */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* Error Banner */}
            {status === 'error' && errorMsg && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{errorMsg}</p>
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="dashboard-contact-name" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4 text-gray-400" />
                Full Name
              </label>
              <input
                id="dashboard-contact-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow placeholder:text-gray-400"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="dashboard-contact-email" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Mail className="w-4 h-4 text-gray-400" />
                Email Address
              </label>
              <input
                id="dashboard-contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow placeholder:text-gray-400"
              />
            </div>

            {/* Message */}
            <div>
              <label htmlFor="dashboard-contact-message" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                Message
              </label>
              <textarea
                id="dashboard-contact-message"
                required
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help you?"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-none placeholder:text-gray-400"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-sm"
            >
              {status === 'sending' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Message
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              We typically respond within 24 hours during business days.
            </p>
          </form>
        </div>
      )}
    </div>
  )
}

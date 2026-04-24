'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Send, CheckCircle, AlertCircle, ArrowLeft, PieChart, Mail, User, MessageSquare } from 'lucide-react'
import type { Metadata } from 'next'

export default function ContactPage() {
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
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Navigation */}
      <nav className="border-b sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm shadow-blue-200">
                <PieChart className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="text-xl font-bold tracking-tight text-gray-900">
                CGT<span className="text-blue-600">Tracker</span>
              </div>
            </Link>
            <div className="flex gap-1 sm:gap-4 items-center">
              <Link href="/guide" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 hidden sm:inline transition-colors">
                CGT Guide
              </Link>
              <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 hidden sm:inline transition-colors">
                Pricing
              </Link>
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 transition-colors">
                Log in
              </Link>
              <Link href="/signup" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-all shadow-sm hover:shadow active:scale-95">
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-16 px-4">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors group">
          <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">Contact Us</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Have a question, feedback, or need help with your CGT calculations? Send us a message and we&apos;ll get back to you within 24 hours.
          </p>
        </div>

        {/* Success State */}
        {status === 'success' ? (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-green-400 to-emerald-500"></div>
            <div className="p-8 sm:p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Message Sent Successfully</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Thank you for reaching out. We&apos;ll review your message and respond to your email address within 24 hours.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setStatus('idle')}
                  className="px-6 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Send another message
                </button>
                <Link
                  href="/"
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-center"
                >
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Form */
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
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
                <label htmlFor="contact-name" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <User className="w-4 h-4 text-gray-400" />
                  Full Name
                </label>
                <input
                  id="contact-name"
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
                <label htmlFor="contact-email" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  Email Address
                </label>
                <input
                  id="contact-email"
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
                <label htmlFor="contact-message" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  Message
                </label>
                <textarea
                  id="contact-message"
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

      {/* Footer */}
      <footer className="border-t py-12 text-center bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-900">CGTTracker</span>
          </div>
          <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} CGT Tracker. Data provided for guidance. Consult a qualified advisor.</p>
          <div className="flex gap-6 text-sm font-medium">
            <Link href="/guide" className="text-gray-500 hover:text-gray-900 transition-colors">Tax Guide</Link>
            <Link href="/pricing" className="text-gray-500 hover:text-gray-900 transition-colors">Pricing</Link>
            <Link href="/login" className="text-gray-500 hover:text-gray-900 transition-colors">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

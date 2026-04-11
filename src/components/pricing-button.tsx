'use client'

import { useState } from 'react'
import Link from 'next/link'

export function PricingButton({ userExists }: { userExists: boolean }) {
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.assign(data.url)
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create checkout session')
      setLoading(false)
    }
  }

  if (userExists) {
    return (
      <button 
        onClick={handleUpgrade}
        disabled={loading}
        className="block w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 text-center text-lg disabled:opacity-50"
      >
        {loading ? 'Redirecting...' : 'Buy Annual Subscription'}
      </button>
    )
  }

  return (
    <Link href="/signup" className="block w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 text-center text-lg">
      Start 14-day free trial
    </Link>
  )
}

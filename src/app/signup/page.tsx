'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Shield, CheckCircle } from 'lucide-react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [country, setCountry] = useState('United Kingdom')
  const [heardFrom, setHeardFrom] = useState('')
  
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `${firstName} ${lastName}`.trim(),
          first_name: firstName,
          last_name: lastName,
          country,
          heard_from: heardFrom
        },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex text-gray-900 bg-gray-50">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          <div>
            <Link href="/" className="text-sm text-blue-600 hover:text-blue-500 font-medium mb-6 inline-block">
              &larr; Back to home
            </Link>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Create your account</h2>
            <p className="mt-2 text-sm text-gray-600">Start your 14-day free trial. No credit card required.</p>
          </div>

          <form className="mt-8 space-y-5 border-t border-gray-200 pt-8" onSubmit={handleSignup}>
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm font-medium border border-red-100 flex items-start">
                <span>{error}</span>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="first-name">First name</label>
                <input
                  id="first-name"
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="last-name">Last name</label>
                <input
                  id="last-name"
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="country">Country of tax residence</label>
              <select
                id="country"
                className="appearance-none block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white transition-colors"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="United Kingdom">United Kingdom</option>
                <option value="United States">United States</option>
                <option value="Ireland">Ireland</option>
                <option value="Australia">Australia</option>
                <option value="Other">Other</option>
              </select>
              {country !== 'United Kingdom' && (
                <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 font-medium">
                  Note: This software is exclusively built to calculate Capital Gains Tax according to strict UK HMRC rules.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-gray-500">Must be at least 8 characters long.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="heard-from">How did you hear about us? <span className="text-gray-400 font-normal">(Optional)</span></label>
              <select
                id="heard-from"
                className="appearance-none block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white transition-colors"
                value={heardFrom}
                onChange={(e) => setHeardFrom(e.target.value)}
              >
                <option value="">Select an option</option>
                <option value="Google">Google Search</option>
                <option value="Accountant">My Accountant / Advisor</option>
                <option value="SocialMedia">Social Media</option>
                <option value="Friend">Friend / Colleague</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create secure account'}
              </button>
            </div>
            
            <div className="flex items-center justify-center mt-4 text-xs text-gray-500 gap-1.5">
              <Shield className="w-4 h-4 text-gray-400" />
              <span>We never sell your financial data. Bank-level encryption.</span>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
              Sign in securely
            </Link>
          </p>
        </div>
      </div>
      
      {/* Right side - Image/Testimonial */}
      <div className="hidden lg:block relative w-0 flex-1 bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 w-full h-full object-cover bg-gradient-to-br from-slate-800 to-slate-900" />
        {/* Subtle decorative circles */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px]" />
        
        <div className="absolute inset-0 flex flex-col justify-center px-16 text-white z-10">
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl max-w-lg">
            <h3 className="text-2xl font-bold mb-6 tracking-tight">"Saved me hours of spreadsheet agony."</h3>
            <p className="text-blue-100 text-lg leading-relaxed mb-8">
              Calculating the 30-day Bed & Breakfast rules manually was a nightmare. This software mapped my Trading 212 statements automatically and generated my SA108 figures perfectly. 
            </p>
            
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center font-bold text-xl">
                J
              </div>
              <div>
                <div className="font-bold">James T.</div>
                <div className="text-sm text-blue-200">Self-Directed Investor</div>
              </div>
            </div>
          </div>
          
          <div className="mt-16 space-y-4">
             <div className="flex items-center gap-3">
               <CheckCircle className="text-green-400 w-6 h-6" />
               <span className="text-lg font-medium">HMRC Compliant Algorithms</span>
             </div>
             <div className="flex items-center gap-3">
               <CheckCircle className="text-green-400 w-6 h-6" />
               <span className="text-lg font-medium">Section 104 Pooling Automatic</span>
             </div>
             <div className="flex items-center gap-3">
               <CheckCircle className="text-green-400 w-6 h-6" />
               <span className="text-lg font-medium">Tax-Loss Harvesting Alerts</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

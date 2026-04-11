import { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PricingButton } from '@/components/pricing-button'

export const metadata: Metadata = {
  title: 'Pricing | Simple £49/year',
  description: 'Unlimited transactions and HMRC-compliant CGT computations for one simple annual fee. Try it 14 days free.',
}

export default async function PricingPage() {
  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-20 px-4">
      <Link href="/" className="text-sm text-blue-600 hover:text-blue-500 font-medium mb-8">
        &larr; Back to home
      </Link>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-4xl font-extrabold text-gray-900 mb-6">Simple, transparent pricing</h2>
        <p className="text-xl text-gray-600 mb-10">Stop paying an accountant £300–£800 a year just to calculate your gains.</p>
        
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-md mx-auto">
          <div className="text-5xl font-extrabold text-gray-900 mb-2">£49<span className="text-xl text-gray-500 font-normal">/year</span></div>
          <p className="text-sm text-gray-500 mb-8">Billed annually. Cancel anytime.</p>
          
          <ul className="text-left space-y-4 mb-8">
            <li className="flex items-start">
              <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" /> 
              <span className="text-gray-700">Calculate total CGT using actual HMRC rules</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" /> 
              <span className="text-gray-700">Unlimited transactions & brokers via CSV upload</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" /> 
              <span className="text-gray-700">Automated smart CSV mapping</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" /> 
              <span className="text-gray-700">Tax-loss harvesting opportunity alerts</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" /> 
              <span className="text-gray-700">Generate Self-Assessment (SA108) ready PDF reports</span>
            </li>
          </ul>
          
          <PricingButton userExists={!!user} />
          <p className="mt-4 text-xs text-gray-500">No credit card required for trial.</p>
        </div>
      </div>
    </div>
  )
}

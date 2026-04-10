import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Calculator, Upload, Receipt, LogOut, Settings, FileText, TrendingDown } from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check subscription / trial status
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_end_date, subscription_end_date')
    .eq('id', user.id)
    .single()

  if (profile) {
    const now = new Date()
    const trialEnd = profile.trial_end_date ? new Date(profile.trial_end_date) : null
    const subStatus = profile.subscription_status || 'trialing'

    // Gate: if canceled or past_due AND trial has expired
    if (
      (subStatus === 'canceled' || subStatus === 'past_due') &&
      (!trialEnd || now > trialEnd)
    ) {
      redirect('/pricing')
    }

    // Gate: if trialing AND trial has expired AND not active subscriber
    if (
      subStatus === 'trialing' &&
      trialEnd &&
      now > trialEnd
    ) {
      redirect('/pricing')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-white border-r border-gray-200 shrink-0 h-auto md:min-h-screen flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between md:justify-start">
          <Link href="/" className="text-xl font-bold text-gray-900">CGT Tracker</Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/dashboard" className="flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors">
            <Calculator className="w-5 h-5 mr-3 text-gray-400" />
            Tax Overview
          </Link>
          <Link href="/dashboard/upload" className="flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors">
            <Upload className="w-5 h-5 mr-3 text-gray-400" />
            Upload CSV
          </Link>
          <Link href="/dashboard/tax-loss-harvesting" className="flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors">
            <TrendingDown className="w-5 h-5 mr-3 text-gray-400" />
            Tax-Loss Harvesting
          </Link>
          <Link href="/dashboard/reports" className="flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors">
            <FileText className="w-5 h-5 mr-3 text-gray-400" />
            Reports
          </Link>
          <Link href="/dashboard/settings" className="flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors">
            <Settings className="w-5 h-5 mr-3 text-gray-400" />
            Settings
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-100 mt-auto">
          <div className="text-sm font-medium text-gray-900 px-4 py-2 break-all">{user.email}</div>
          <form action="/api/auth/logout" method="POST">
             <button type="submit" className="flex w-full items-center px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
               <LogOut className="w-5 h-5 mr-3 text-gray-400" />
               Sign out
             </button>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

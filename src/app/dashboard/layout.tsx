import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardSidebar } from '@/components/dashboard-sidebar'

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
      <DashboardSidebar userEmail={user.email || ''} />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase: any = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete all user data in dependency order
    // 1. Disposals
    await supabase.from('disposals').delete().eq('user_id', user.id)

    // 2. CGT Computations
    await supabase.from('cgt_computations').delete().eq('user_id', user.id)

    // 3. Section 104 Pools
    await supabase.from('section_104_pools').delete().eq('user_id', user.id)

    // 4. Transactions
    await supabase.from('transactions').delete().eq('user_id', user.id)

    // 5. Uploads
    await supabase.from('uploads').delete().eq('user_id', user.id)

    // 6. Alerts
    await supabase.from('alerts').delete().eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete data error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

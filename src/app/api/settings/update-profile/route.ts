import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase: any = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { full_name } = await req.json()

    const { error } = await supabase
      .from('profiles')
      .update({ full_name })
      .eq('id', user.id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update profile error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

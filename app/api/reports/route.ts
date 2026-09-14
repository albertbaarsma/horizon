import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('life_reports').select('*')
    .eq('user_id', user.id).order('period_end', { ascending: false }).order('id', { ascending: false }).limit(20)

  return NextResponse.json({ reports: data ?? [] })
}

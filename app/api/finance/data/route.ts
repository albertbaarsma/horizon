import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Voor FinanceClient wanneer het embedded draait (binnen Inzicht, geen server-load
// vanuit app/finance/page.tsx) — dezelfde vier datasets, in één keer opgehaald.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: entries }, { data: transactions }, { data: allowanceEntries }, { data: allowanceGoals }] = await Promise.all([
    supabase.from('finance_entries')
      .select('*').eq('user_id', user.id).order('date', { ascending: false }).order('id', { ascending: false }),
    supabase.from('finance_transactions')
      .select('*').eq('user_id', user.id).order('date', { ascending: false }).order('id', { ascending: false }),
    supabase.from('allowance_entries')
      .select('*').eq('user_id', user.id).order('date', { ascending: false }).order('id', { ascending: false }),
    supabase.from('allowance_goals')
      .select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    entries: entries ?? [],
    transactions: transactions ?? [],
    allowanceEntries: allowanceEntries ?? [],
    allowanceGoals: allowanceGoals ?? [],
  })
}

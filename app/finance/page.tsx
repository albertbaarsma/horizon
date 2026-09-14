import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import FinanceClient from './FinanceClient'
import type { FinanceEntry, FinanceTransaction, AllowanceEntry, AllowanceGoal } from '@/lib/types'

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  return <FinanceClient userId={user.id}
    initialEntries={(entries ?? []) as FinanceEntry[]}
    initialTransactions={(transactions ?? []) as FinanceTransaction[]}
    initialAllowanceEntries={(allowanceEntries ?? []) as AllowanceEntry[]}
    initialAllowanceGoals={(allowanceGoals ?? []) as AllowanceGoal[]} />
}

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import type { DashboardData } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: categories },
    { data: projects },
    { data: tasks },
    { data: goals },
    { data: achievements },
    { data: weekItems },
    { data: recurringTasks },
    { data: xpEvents },
    { data: diaryEntries },
    { data: moodEntries },
    { data: shoppingItems },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('categories').select('*').eq('user_id', user.id),
    supabase.from('projects').select('*').eq('user_id', user.id).order('sort_order').order('name'),
    supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('goals').select('*').eq('user_id', user.id),
    supabase.from('achievements').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('week_items').select('*').eq('user_id', user.id).order('date').order('id'),
    supabase.from('recurring_tasks').select('*').eq('user_id', user.id).order('id'),
    supabase.from('xp_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
    supabase.from('diary_entries').select('*').eq('user_id', user.id).order('date', { ascending: false }).order('id', { ascending: false }).limit(300),
    // Ruimer venster dan voorheen: de mood-grafiek wil ook jaarpatronen (bijv.
    // een terugkerende zomerdip) kunnen laten zien, niet alleen de laatste maanden.
    supabase.from('mood_entries').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(400),
    supabase.from('shopping_items').select('*').eq('user_id', user.id).order('created_at'),
  ])

  const data: DashboardData = {
    profile: profile!,
    categories: categories ?? [],
    projects: projects ?? [],
    tasks: tasks ?? [],
    goals: goals ?? [],
    achievements: achievements ?? [],
    weekItems: weekItems ?? [],
    recurringTasks: recurringTasks ?? [],
    xpEvents: xpEvents ?? [],
    diaryEntries: diaryEntries ?? [],
    moodEntries: moodEntries ?? [],
    shoppingItems: shoppingItems ?? [],
  }

  return <DashboardClient data={data} userId={user.id} userEmail={user.email!} today={new Date().toISOString().slice(0, 10)} />
}

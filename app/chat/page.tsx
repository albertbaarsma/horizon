import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ChatClient from './ChatClient'

export const metadata = { title: 'Horizon AI — Chat' }

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tasks } = await supabase
    .from('tasks').select('*').eq('user_id', user.id).order('created_at')

  return <ChatClient tasks={tasks ?? []} />
}

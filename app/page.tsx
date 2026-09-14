import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import LandingPage from './LandingPage'

// Geen cookie = nieuwe/anonieme bezoeker → Engels als standaard. Jordan (of
// wie ooit op de NL-vlag klikte) krijgt zijn voorkeur terug via het cookie.
async function huidigeTaal() {
  const store = await cookies()
  return store.get('aos_lang')?.value === 'nl' ? 'nl' as const : 'en' as const
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await huidigeTaal()
  return lang === 'nl'
    ? {
        title: 'Horizon — je hele leven in één overzicht',
        description:
          'Gratis alpha. Visie, doelen, projecten, taken en week op één plek. Koppel Claude of een andere AI via MCP, plus je Google Agenda en Gmail, en laat je planning zichzelf bijhouden. Een hobbyproject van Acme Co.',
      }
    : {
        title: 'Horizon — your whole life, one overview',
        description:
          'Free alpha. Vision, goals, projects, tasks, and week in one place. Connect Claude or another AI via MCP, plus your Google Calendar and Gmail, and let your planning keep itself up to date. A hobby project by Acme Co.',
      }
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Wie al ingelogd is wil zijn dashboard, niet het verkoopverhaal
  if (user) redirect('/dashboard')
  const lang = await huidigeTaal()
  return <LandingPage lang={lang} />
}

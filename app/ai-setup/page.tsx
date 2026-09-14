import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { resolveLang } from '@/lib/lang'
import AiSetupClient from './AiSetupClient'

export default async function AiSetupPage({ searchParams }: { searchParams: Promise<{ pad?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('ai_token, language').eq('id', user.id).single()

  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${proto}://${host}`

  // ?pad=model laat deze pagina direct op de "eigen AI-model"-tab openen —
  // gebruikt door de ApiKeyNotice-link vanuit Rapport/Plansessie/etc.
  const { pad } = await searchParams
  const initialPad = pad === 'model' ? 'model' : undefined

  return <AiSetupClient token={profile!.ai_token} lang={resolveLang(profile!.language)} origin={origin} initialPad={initialPad} />
}

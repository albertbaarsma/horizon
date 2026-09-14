import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getGoogleToken, fetchGmailMessages } from '@/lib/google-api'

const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const CACHE_TTL = 24 * 60 * 60_000
const cache = new Map<string, { summaries: MailSummary[]; aiError: string | null; ts: number }>()
export function _resetCache() { cache.clear() }

export interface MailSummary {
  id: string
  subject: string
  from: string
  fromName: string
  date: string
  snippet: string
  priority: 'high' | 'medium' | 'low'
  actionRequired: boolean
  category: 'actie' | 'info' | 'nieuwsbrief' | 'financieel' | 'werk' | 'persoonlijk'
  oneLiner: string
  suggestedTask: string | null
  suggestedProject: string | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cached = cache.get(user.id)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ messages: cached.summaries, connected: true, aiError: cached.aiError ?? undefined })
  }

  const token = await getGoogleToken(supabase, user.id)
  if (!token) return NextResponse.json({ error: 'Google niet verbonden', connected: false }, { status: 400 })

  let messages: Awaited<ReturnType<typeof fetchGmailMessages>>
  try {
    messages = await fetchGmailMessages(token, 20)
  } catch (e) {
    const code = (e as Error).message
    if (code === 'GMAIL_SCOPE_MISSING')
      return NextResponse.json({ error: 'Gmail-scope niet toegestaan. Log opnieuw in met Google.', connected: false }, { status: 403 })
    if (code === 'GMAIL_TOKEN_INVALID')
      return NextResponse.json({ error: 'Google-token verlopen. Log opnieuw in.', connected: false }, { status: 401 })
    return NextResponse.json({ error: `Gmail-fout: ${code}`, connected: false }, { status: 500 })
  }
  if (!messages.length) return NextResponse.json({ messages: [], connected: true })

  // Ask Claude to analyze all emails at once
  const emailList = messages.map((m, i) =>
    `[${i + 1}] Van: ${m.from} | Onderwerp: ${m.subject} | Datum: ${m.date}\nPreview: ${m.snippet}`
  ).join('\n\n')

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from('profiles').select('ai_api_key').eq('id', user.id).single(),
    supabase.from('projects').select('id, name, emoji').eq('user_id', user.id).order('name'),
  ])
  const apiKey = profile?.ai_api_key || process.env.ANTHROPIC_API_KEY

  const projectList = (projects ?? []).map(p => `- ${p.emoji ?? ''} ${p.name}`.trim()).join('\n')

  const prompt = `Je bent een persoonlijke assistent van de gebruiker.
Analyseer deze ${messages.length} ongelezen mails en geef voor ELKE mail een JSON-object terug.

JOUW PROJECTEN (gebruik exact deze namen voor suggestedProject):
${projectList || '(geen projecten)'}

MAILS:
${emailList}

Geef een JSON-array terug (ALLEEN de array, geen uitleg). Elk object heeft:
- idx: number (1-based, overeenkomend met [N] hierboven)
- priority: "high" | "medium" | "low"
- actionRequired: boolean (moet de gebruiker iets doen?)
- category: "actie" | "info" | "nieuwsbrief" | "financieel" | "werk" | "persoonlijk"
- oneLiner: string (max 80 tekens, Nederlandse samenvatting van de kern)
- suggestedTask: string | null (als actionRequired=true: concrete taak voor de gebruiker, anders null)
- suggestedProject: string | null (naam van het meest passende project uit de lijst hierboven, of null als niet duidelijk)

Prioriteiten:
- high: directe actie vereist, deadline, financieel belangrijk, persoonlijk contact
- medium: actie gewenst maar niet urgent, informatief maar relevant
- low: nieuwsbrieven, marketing, automatische notificaties`

  const aiResp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey!, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  })

  let aiResults: { idx: number; priority: string; actionRequired: boolean; category: string; oneLiner: string; suggestedTask: string | null; suggestedProject: string | null }[] = []
  let aiError: string | null = null

  if (aiResp.ok) {
    const aiData = await aiResp.json()
    const content = (aiData.content as { type: string; text: string }[])?.find(b => b.type === 'text')?.text ?? ''
    try {
      const match = content.match(/\[[\s\S]*\]/)
      if (match) aiResults = JSON.parse(match[0])
      else aiError = 'AI kon de mails niet structureren'
    } catch { aiError = 'AI-analyse kon niet worden verwerkt' }
  } else {
    aiError = `AI-analyse mislukt (${aiResp.status})`
  }

  const fromName = (from: string) => {
    const match = from.match(/^"?([^"<]+)"?\s*(?:<.*>)?$/)
    return match ? match[1].trim() : from.split('@')[0]
  }

  const summaries: MailSummary[] = messages.map((m, i) => {
    const ai = aiResults.find(a => a.idx === i + 1)
    return {
      id: m.id,
      subject: m.subject,
      from: m.from,
      fromName: fromName(m.from),
      date: m.date,
      snippet: m.snippet,
      priority: (ai?.priority ?? 'low') as MailSummary['priority'],
      actionRequired: ai?.actionRequired ?? false,
      category: (ai?.category ?? 'info') as MailSummary['category'],
      oneLiner: ai?.oneLiner ?? m.snippet.slice(0, 80),
      suggestedTask: ai?.suggestedTask ?? null,
      suggestedProject: ai?.suggestedProject ?? null,
    }
  })

  // Sort: high first, then medium, then low
  const order = { high: 0, medium: 1, low: 2 }
  summaries.sort((a, b) => order[a.priority] - order[b.priority])

  cache.set(user.id, { summaries, aiError, ts: Date.now() })
  return NextResponse.json({ messages: summaries, connected: true, aiError: aiError ?? undefined })
}

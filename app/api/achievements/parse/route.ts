import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL             = 'claude-haiku-4-5-20251001'

export interface ParsedItem {
  text: string
  type: 'accomplishment' | 'magic_moment' | 'verbeterpunt'
  emoji: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text } = await req.json() as { text: string }
  if (!text?.trim()) return NextResponse.json({ items: [] })

  const { data: profile } = await supabase
    .from('profiles').select('ai_api_key').eq('id', user.id).single()

  const apiKey = (profile?.ai_api_key as string | null) || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Geen API key geconfigureerd' }, { status: 400 })

  const body = {
    model:      MODEL,
    max_tokens: 2048,
    system: `Je bent een helper die wekelijkse notities omzet naar gestructureerde achievements.

Categoriseer elk item als:
- "accomplishment": iets bereikt, gedaan of afgerond
- "magic_moment": een bijzonder, mooi of waardevol moment
- "verbeterpunt": een les, iets dat beter kon, of een reflectie

Geef ALLEEN een geldige JSON array terug. Geen andere tekst, uitleg of markdown.
Format: [{ "text": "...", "type": "accomplishment"|"magic_moment"|"verbeterpunt", "emoji": "🏆"|"✨"|"📝" }]

Regels:
- Gebruik 🏆 voor accomplishments, ✨ voor magic moments, 📝 voor verbeterpunten
- Eén bullet point of zin = één item
- Bewaar de taal van de invoer (NL blijft NL)
- Kopieer de tekst zo letterlijk mogelijk, maar verwijder opsommingstekens (-, *, •)
- Sla lege regels en sectiekoppen (zoals "ACCOMPLISHMENTS:") over`,
    messages: [{ role: 'user', content: text }],
  }

  const res = await fetch(ANTHROPIC_URL, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Anthropic error:', err)
    return NextResponse.json({ error: 'AI-fout' }, { status: 502 })
  }

  const data = await res.json() as { content: { type: string; text: string }[] }
  const raw  = data.content?.[0]?.type === 'text' ? data.content[0].text.trim() : ''

  // Extract JSON array (Claude may occasionally wrap in markdown fences)
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return NextResponse.json({ items: [] })

  try {
    const items = JSON.parse(jsonMatch[0]) as ParsedItem[]
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [], error: 'Parse-fout' })
  }
}

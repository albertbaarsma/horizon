import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { MOOD_MIN, MOOD_MAX } from '@/lib/mood'

const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL             = 'claude-haiku-4-5-20251001'

export interface MoodSuggestion {
  mood: number
  rationale: string
}

// Schat een stemmingscijfer (-10..+10) in op basis van een dagboektekst. Dit is
// een voorstel — de gebruiker beslist zelf of hij het overneemt. Nooit stil
// wegschrijven: bij bipolariteit bepaalt hij zelf hoe hij zich voelt, dit is
// hooguit een suggestie om die registratie makkelijker te maken.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text } = await req.json() as { text: string }
  if (!text?.trim()) return NextResponse.json({ suggestion: null })

  const { data: profile } = await supabase
    .from('profiles').select('ai_api_key').eq('id', user.id).single()

  const apiKey = (profile?.ai_api_key as string | null) || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Geen API key geconfigureerd' }, { status: 400 })

  const body = {
    model:      MODEL,
    max_tokens: 300,
    system: `Je schat, voor iemand die zijn stemming bijhoudt, in waar een dagboektekst op de schaal ${MOOD_MIN} (zwaar depressief/somber) tot ${MOOD_MAX} (zwaar manisch/opgejaagd) staat, met 0 als neutraal/stabiel.

Let op signalen als: energie en tempo van schrijven, slaap, prikkelbaarheid, impulsiviteit, concentratie, sociale terugtrekking versus juist overdrive, zelfbeeld, en expliciete uitspraken over hoe iemand zich voelt.

Geef ALLEEN geldige JSON terug, geen andere tekst: { "mood": <geheel getal ${MOOD_MIN} t/m ${MOOD_MAX}>, "rationale": "<één korte zin in het Nederlands, beschrijvend, geen diagnose>" }

Als de tekst geen bruikbare aanwijzing geeft, geef dan { "mood": 0, "rationale": "Geen duidelijke aanwijzing in de tekst." }`,
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

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ suggestion: null })

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { mood: number; rationale: string }
    const mood = Math.max(MOOD_MIN, Math.min(MOOD_MAX, Math.round(Number(parsed.mood))))
    if (!Number.isFinite(mood)) return NextResponse.json({ suggestion: null })
    const suggestion: MoodSuggestion = { mood, rationale: String(parsed.rationale ?? '').slice(0, 200) }
    return NextResponse.json({ suggestion })
  } catch {
    return NextResponse.json({ suggestion: null, error: 'Parse-fout' })
  }
}

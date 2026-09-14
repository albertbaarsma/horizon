import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL             = 'claude-haiku-4-5-20251001'

export interface ActionSuggestion {
  emoji:  string
  title:  string  // korte, direct in te plannen actie (max ~7 woorden)
  detail: string  // één zin uitleg
}

// Geeft 3-5 concrete, direct inplanbare ideeën bij een (vaak open) planningstaak.
// Voorbeeld: taak "Activiteit verzinnen voor Mika & zonen" → concrete uitjes.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { task, project } = await req.json() as {
    task?: string
    project?: { name: string; description?: string }
  }
  if (!task?.trim()) return NextResponse.json({ error: 'Geen taak opgegeven' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('ai_api_key').eq('id', user.id).single()
  const apiKey = (profile?.ai_api_key || process.env.ANTHROPIC_API_KEY) as string | undefined
  if (!apiKey) return NextResponse.json({ error: 'Geen API-sleutel geconfigureerd' }, { status: 403 })

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: 'Je bent een behulpzame planningsassistent. Bij een (vaak nog vage) taak bedenk je concrete, direct uitvoerbare opties waaruit de gebruiker er één kan kiezen. Elke optie moet zó specifiek zijn dat je hem direct in de weekplanning kunt zetten. Antwoord altijd in het Nederlands en uitsluitend als geldige JSON, zonder markdown of uitleg eromheen.',
      messages: [{
        role: 'user',
        content: `TAAK: "${task}"${project ? `
PROJECT-CONTEXT: dit hoort bij "${project.name}"${project.description ? ` — ${project.description}` : ''}.` : ''}

Geef 4 concrete, uiteenlopende ideeën/opties om deze taak in te vullen of uit te voeren. Praktisch en direct te doen.

Geef terug als JSON met exact deze structuur:
{
  "suggestions": [
    { "emoji": "één passend emoji", "title": "korte concrete actie, max 7 woorden", "detail": "één zin die het idee uitlegt" }
  ]
}`,
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: 'AI-aanroep mislukt', detail: err }, { status: 502 })
  }

  const json = await res.json()
  const raw  = (json.content?.[0]?.text ?? '') as string
  const stripped = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()

  const parse = (s: string) => {
    const obj = JSON.parse(s) as { suggestions?: ActionSuggestion[] }
    if (!Array.isArray(obj.suggestions)) throw new Error('geen suggestions')
    return obj.suggestions.filter(x => x?.title).slice(0, 6)
  }

  try {
    return NextResponse.json({ suggestions: parse(stripped) })
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/)
    if (match) {
      try { return NextResponse.json({ suggestions: parse(match[0]) }) } catch { /* val door */ }
    }
    return NextResponse.json({ error: 'Kon JSON niet parsen', raw }, { status: 422 })
  }
}

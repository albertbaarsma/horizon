import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL             = 'claude-haiku-4-5-20251001'

export interface ParsedProject {
  name:        string
  emoji:       string
  vision:      string
  description: string
  notes:       string
  // Alleen gezet wanneer er een currentProject is meegegeven:
  // false = de tekst gaat eigenlijk over een ander initiatief → stel sub-project voor
  past_bij_project?: boolean
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { text, currentProject } = await req.json() as {
    text?: string
    currentProject?: { name: string; description?: string }
  }
  if (!text?.trim()) return NextResponse.json({ error: 'Geen tekst opgegeven' }, { status: 400 })

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
      system: 'Je bent een assistent die projectteksten analyseert en de kernvelden extraheert. Geef altijd alleen geldige JSON terug, zonder markdown of uitleg.',
      messages: [{
        role: 'user',
        content: `Analyseer deze projectbeschrijving en extraheer de volgende velden.
${currentProject ? `
CONTEXT: de gebruiker plakt deze tekst in het bestaande project "${currentProject.name}"${currentProject.description ? ` (${currentProject.description})` : ''}.
Beoordeel eerst of de tekst ECHT over dit project gaat, of eigenlijk over een ander/nieuw initiatief (dan hoort het een apart (sub-)project te zijn).
` : ''}
TEKST:
${text}

Geef terug als JSON met exact deze structuur:
{${currentProject ? `
  "past_bij_project": true of false — gaat de tekst over "${currentProject.name}" zelf?,` : ''}
  "name": "korte projectnaam (max 6 woorden)",
  "emoji": "één passend emoji karakter",
  "vision": "het concrete gewenste eindresultaat — wat ga je bereiken? (2-4 zinnen)",
  "description": "waarom is dit project belangrijk, wat drijft je? (1-3 zinnen)",
  "notes": "stand van zaken, concrete actiestappen en aandachtspunten (als bulletpoints met •, max 8 bullets)"
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

  // Strip possible markdown fences
  const stripped = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    const parsed = JSON.parse(stripped) as ParsedProject
    return NextResponse.json(parsed)
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/)
    if (match) {
      try { return NextResponse.json(JSON.parse(match[0]) as ParsedProject) } catch { /* fall through */ }
    }
    return NextResponse.json({ error: 'Kon JSON niet parsen', raw }, { status: 422 })
  }
}

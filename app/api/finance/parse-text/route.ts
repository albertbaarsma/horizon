import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL             = 'claude-haiku-4-5-20251001'
const MAX_TEXT_CHARS    = 20000

export interface ParsedMoneyEntry {
  person: string
  /** Positief = deze persoon is de gebruiker dit schuldig, negatief = de gebruiker is deze persoon dit schuldig. */
  amount: number
  description: string
  /** De stap-voor-stap berekening — het model rekent zelf na, corrigeert rekenfouten uit de tekst. */
  reasoning: string
  date: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text } = await req.json() as { text?: string }
  if (!text?.trim()) return NextResponse.json({ error: 'Geen tekst ontvangen' }, { status: 400 })
  if (text.length > MAX_TEXT_CHARS) return NextResponse.json({ error: `Tekst te lang (max ${MAX_TEXT_CHARS} tekens)` }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles').select('ai_api_key').eq('id', user.id).single()

  const apiKey = (profile?.ai_api_key as string | null) || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Geen API key geconfigureerd' }, { status: 400 })

  const vandaag = new Date().toISOString().slice(0, 10)

  const body = {
    model:      MODEL,
    max_tokens: 4096,
    system: `Je bent een helper die een geplakt verhaal over geld — wie is wie wat schuldig, en waarom — omzet naar een lijst met bedragen per persoon.

Voor elke persoon die in de tekst genoemd wordt met een bedrag, geef één entry:
- "person": naam van de persoon
- "amount": bedrag als getal, POSITIEF als die persoon het aan de gebruiker schuldig is, NEGATIEF als de gebruiker het aan die persoon schuldig is
- "description": korte omschrijving (max ~8 woorden), bijv. "Pianolessen + benzine, min boodschappen"
- "reasoning": de VOLLEDIGE stap-voor-stap berekening, elke regel apart, zoals in de tekst genoemd — MAAR reken zelf na. Als een genoemd tussenbedrag of het eindtotaal niet klopt met de genoemde aantallen/tarieven, neem dan het WERKELIJK berekende bedrag als "amount" en zet in de reasoning expliciet een regel als "(let op: in de tekst stond hier €X, maar Y×Z is €<correct>)" — corrigeer, verzwijg de fout niet.
- "date": YYYY-MM-DD — gebruik een datum die letterlijk in de tekst staat, anders ${vandaag}

Geef ALLEEN een geldige JSON array terug, geen andere tekst, uitleg of markdown.
Format: [{ "person": "Valentijn", "amount": 205.00, "description": "...", "reasoning": "Pianolessen Mio: 13x €10 = €130\\n...", "date": "2026-09-08" }]

Regels:
- Reken elk bedrag zelf na — vertrouw nooit blind een genoemd eindtotaal
- Eén entry per persoon; als dezelfde persoon meerdere losse posten heeft, tel ze samen tot één bedrag met alle posten in de reasoning
- Als een bedrag in de tekst zelf al onzeker/geschat is (bijv. "weet niet meer precies"), noem dat expliciet in de reasoning
- Verzin geen personen of bedragen die niet in de tekst staan
- Geen bedrag te herleiden voor een genoemde persoon → laat die persoon weg`,
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
    return NextResponse.json({ error: 'AI-fout bij het lezen van de tekst' }, { status: 502 })
  }

  const data = await res.json() as { content: { type: string; text: string }[] }
  const raw  = data.content?.[0]?.type === 'text' ? data.content[0].text.trim() : ''

  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return NextResponse.json({ entries: [] })

  try {
    const entries = JSON.parse(jsonMatch[0]) as ParsedMoneyEntry[]
    return NextResponse.json({ entries })
  } catch {
    return NextResponse.json({ entries: [], error: 'Parse-fout' })
  }
}

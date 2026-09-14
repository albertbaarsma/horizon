import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { FINANCE_CATEGORIES } from '@/lib/finance-categories'

const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL             = 'claude-haiku-4-5-20251001'
const MAX_PDF_BYTES     = 8 * 1024 * 1024 // ruim onder de 32MB request-limiet van de Anthropic API, en veilig voor serverless body-limieten

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
  category: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Alleen PDF-bestanden worden ondersteund' }, { status: 400 })
  if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: `Bestand te groot (max ${MAX_PDF_BYTES / 1024 / 1024}MB) — probeer een kleiner afschrift, bijv. per maand` }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles').select('ai_api_key').eq('id', user.id).single()

  const apiKey = (profile?.ai_api_key as string | null) || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Geen API key geconfigureerd' }, { status: 400 })

  const bytes  = Buffer.from(await file.arrayBuffer())
  const base64 = bytes.toString('base64')

  const body = {
    model:      MODEL,
    max_tokens: 8192,
    system: `Je bent een helper die een bankafschrift (PDF) omzet naar een lijst met individuele transacties.

Voor elke transactieregel op het afschrift, geef:
- "date": datum in YYYY-MM-DD formaat
- "description": de omschrijving zoals op het afschrift staat (tegenpartij/mededeling), zonder overbodige witruimte
- "amount": bedrag als getal, POSITIEF voor bijschrijvingen/inkomsten, NEGATIEF voor afschrijvingen/uitgaven (let op de Af/Bij-kolom of +/- teken op het afschrift)
- "category": kies de best passende categorie uit exact deze lijst: ${FINANCE_CATEGORIES.join(', ')} — gebruik "Overig" als niets goed past

Geef ALLEEN een geldige JSON array terug, geen andere tekst, uitleg of markdown.
Format: [{ "date": "2026-08-03", "description": "...", "amount": -12.50, "category": "Boodschappen" }]

Regels:
- Neem ELKE transactieregel mee, sla er geen over
- Verzin geen transacties die er niet staan, en verzin geen bedragen
- Rond bedragen af op 2 decimalen zoals ze op het afschrift staan
- Saldo-regels (beginsaldo/eindsaldo) zijn GEEN transacties — sla die over`,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: 'Extraheer alle transacties uit dit bankafschrift volgens de instructies.' },
      ],
    }],
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
    return NextResponse.json({ error: 'AI-fout bij het lezen van het afschrift' }, { status: 502 })
  }

  const data = await res.json() as { content: { type: string; text: string }[] }
  const raw  = data.content?.[0]?.type === 'text' ? data.content[0].text.trim() : ''

  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return NextResponse.json({ transactions: [] })

  try {
    const transactions = JSON.parse(jsonMatch[0]) as ParsedTransaction[]
    return NextResponse.json({ transactions })
  } catch {
    return NextResponse.json({ transactions: [], error: 'Parse-fout' })
  }
}

// ─── Week-/maandrapport ─────────────────────────────────────────────────────
// Verzamelt mood/dagboek/achievements/afgeronde taken/actieve doelen over een
// vaste periode en laat Claude er een voor-te-lezen, direct rapport van
// schrijven (geen opsommingen — dit is bedoeld om hardop voorgelezen te
// worden). Wordt aangeroepen vanuit zowel de handmatige "Nu genereren"-knop
// (app/api/reports/generate) als de wekelijkse/maandelijkse Vercel Cron
// (app/api/reports/cron) — vandaar de losse module i.p.v. inline in één route.

const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL              = 'claude-sonnet-5'

export type ReportKind = 'week' | 'month'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportSupabase = any

function todayInAmsterdam(now: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(now)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Week = de 7 dagen tot en met vandaag. Maand = de vorige volledige kalendermaand
 *  (ook als er op de 1e handmatig gegenereerd wordt — dan krijg je "vorige maand",
 *  niet "deze maand tot nu toe", zodat de betekenis altijd hetzelfde is). */
export function periodRange(kind: ReportKind, now = new Date()): { start: string; end: string } {
  const today = todayInAmsterdam(now)
  if (kind === 'week') return { start: addDays(today, -6), end: today }

  const firstOfThisMonth = today.slice(0, 8) + '01'
  const lastOfPrevMonth  = addDays(firstOfThisMonth, -1)
  const firstOfPrevMonth = lastOfPrevMonth.slice(0, 8) + '01'
  return { start: firstOfPrevMonth, end: lastOfPrevMonth }
}

export async function generateLifeReport(
  supabase: ReportSupabase, userId: string, kind: ReportKind, apiKey: string,
): Promise<{ report: { id: number; user_id: string; kind: ReportKind; period_start: string; period_end: string; content: string; created_at: string } } | { error: string }> {
  const { start, end } = periodRange(kind)
  const endExclusive = addDays(end, 1)

  const [
    { data: moods },
    { data: diary },
    { data: achievements },
    { data: doneTasks },
    { data: goals },
    { data: categories },
    { data: projects },
  ] = await Promise.all([
    supabase.from('mood_entries').select('date, mood, energy, sleep_hours, note').eq('user_id', userId).gte('date', start).lte('date', end).order('date'),
    supabase.from('diary_entries').select('date, text').eq('user_id', userId).gte('date', start).lte('date', end).order('date'),
    supabase.from('achievements').select('date, text, emoji').eq('user_id', userId).gte('date', start).lte('date', end).order('date'),
    supabase.from('tasks').select('name, proj_id, updated_at').eq('user_id', userId).eq('status', 'done').gte('updated_at', start).lt('updated_at', endExclusive),
    supabase.from('goals').select('horizon, text, deadline, cat_id').eq('user_id', userId).eq('done', false).is('deleted_at', null),
    supabase.from('categories').select('id, name').eq('user_id', userId),
    supabase.from('projects').select('id, name, cat_id').eq('user_id', userId),
  ])

  const catName  = new Map<string, string>((categories ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
  const projInfo = new Map<string, { name: string; cat: string }>((projects ?? []).map((p: { id: string; name: string; cat_id: string }) => [p.id, { name: p.name, cat: catName.get(p.cat_id) ?? p.cat_id }]))

  const lines: string[] = [`Periode: ${start} t/m ${end}`]

  lines.push('', '=== Stemming (mood_entries, schaal -10 zwaar depressief tot +10 zwaar manisch, 0 neutraal) ===')
  if (!moods?.length) lines.push('Geen mood-metingen deze periode.')
  else for (const m of moods as { date: string; mood: number; energy: number | null; sleep_hours: number | null; note: string | null }[])
    lines.push(`${m.date}: mood ${m.mood}${m.energy != null ? `, energie ${m.energy}/5` : ''}${m.sleep_hours != null ? `, ${m.sleep_hours}u slaap` : ''}${m.note ? ` — "${m.note}"` : ''}`)

  lines.push('', '=== Dagboek ===')
  if (!diary?.length) lines.push('Geen dagboeknotities deze periode.')
  else for (const d of diary as { date: string; text: string }[]) lines.push(`${d.date}: ${d.text}`)

  lines.push('', '=== Achievements (inclusief gehaalde doelen — die staan er letterlijk zo bij, bijv. "Kwartaaldoel gehaald: ...") ===')
  if (!achievements?.length) lines.push('Geen achievements gelogd deze periode.')
  else for (const a of achievements as { date: string; text: string; emoji: string | null }[]) lines.push(`${a.date} ${a.emoji ?? ''} ${a.text}`)

  lines.push('', '=== Afgeronde taken ===')
  if (!doneTasks?.length) lines.push('Geen taken afgevinkt deze periode.')
  else for (const t of doneTasks as { name: string; proj_id: string | null }[]) {
    const p = t.proj_id ? projInfo.get(t.proj_id) : null
    lines.push(`${t.name}${p ? ` (project: ${p.name}, levensgebied: ${p.cat})` : ''}`)
  }

  lines.push('', '=== Actieve doelen (huidige stand, niet periode-gebonden — gebruik dit om te zien wat er speelt en wat blijft liggen) ===')
  if (!goals?.length) lines.push('Geen actieve doelen.')
  else for (const g of goals as { horizon: string; text: string; deadline: string | null; cat_id: string | null }[])
    lines.push(`[${g.horizon}] ${g.text}${g.deadline ? ` — deadline ${g.deadline}` : ''} (levensgebied: ${catName.get(g.cat_id ?? '') ?? 'onbekend'})`)

  const dataBlock = lines.join('\n')

  const reportLabel = kind === 'week' ? 'weekrapport' : 'maandrapport'
  const lengthHint  = kind === 'week' ? 'ongeveer 250-400 woorden' : 'ongeveer 400-650 woorden'

  const system = `Je schrijft een ${reportLabel} voor de gebruiker — een persoonlijk rapport dat die hardop laat voorlezen op de telefoon (tekst-naar-spraak). Baseer je UITSLUITEND op de data die je krijgt; verzin nooit cijfers, gebeurtenissen of doelen die er niet staan.

STIJL — dit wordt hardop voorgelezen:
- Vloeiende, doorlopende zinnen en alinea's. GEEN opsommingstekens, GEEN nummeringen, GEEN markdown-koppen of sterretjes — puur platte, gesproken taal.
- Spreek de gebruiker rechtstreeks aan met "je"/"jij".
- Toon: direct, energiek, eerlijk — in de geest van Tony Robbins. Vier een echte winst hard. Benoem scherp en zonder omhaal als iets al weken blijft liggen of als een patroon zich herhaalt — nooit aanvallend op de persoon, wel eerlijk over het gedrag. Geen therapeutische of voorzichtige taal ("het lijkt erop dat...", "je zou eventueel kunnen overwegen...") — zeg het recht voor z'n raap.
- Sluit altijd af met concrete, uitvoerbare vervolgstappen — geen vage aanmoediging zoals "blijf volhouden", maar iets als "plan deze week 2 uur in voor X, want dat ligt al 3 weken stil terwijl de deadline over 10 dagen is".

INHOUD, als lopend verhaal (geen kopjes):
1. Staat van zijn — wat de mood-cijfers en dagboeknotities vertellen, met concrete cijfers/trend waar mogelijk.
2. Wat je hebt neergezet — de achievements en afgeronde taken, specifiek benoemd.
3. Waar je echt aan hebt gewerkt, en wat blijft liggen — welke doelen zichtbaar aandacht kregen, en welke actieve doelen (vooral horizon 'nu'/'wk', of een naderende deadline) geen enkel signaal van voortgang laten zien. Noem doelen bij naam.
4. Advies — 2 tot 4 concrete vervolgstappen, specifiek aan wat je in de data ziet.

Is er weinig of geen data voor een onderdeel (bijv. geen mood-entries)? Benoem dat gewoon eerlijk, sla het niet stilzwijgend over en verzin niets.

Schrijf in het Nederlands. Lengte: ${lengthHint}.`

  const body = {
    model:      MODEL,
    // Sonnet 5 heeft adaptive thinking standaard aan — dat verbruikt ook budget uit
    // max_tokens, dus ruim boven de ~650 woorden tekst zelf begroten (anders komt er
    // bij een grotere maandrapport-databatch soms geen zichtbare tekst meer uit).
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: dataBlock }],
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
    console.error('Anthropic error (report):', err)
    return { error: 'AI-fout bij het schrijven van het rapport' }
  }

  const data = await res.json() as { content: { type: string; text: string }[] }
  // Sonnet 5 denkt standaard na vóór het antwoord — die thinking-blokken staan vóór
  // het tekstblok in de content-array, dus zoeken i.p.v. blind content[0] pakken.
  const textBlock = data.content?.find(b => b.type === 'text')
  const content = textBlock ? textBlock.text.trim() : ''
  if (!content) return { error: 'Leeg rapport ontvangen' }

  const { data: saved, error } = await supabase.from('life_reports').insert({
    user_id: userId, kind, period_start: start, period_end: end, content,
  }).select('*').single()
  if (error) return { error: `Fout bij opslaan: ${error.message}` }

  return { report: saved }
}

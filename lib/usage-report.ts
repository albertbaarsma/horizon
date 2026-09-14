// ─── Van meting naar conclusie ────────────────────────────────────────────────
// De ruwe regels uit usage_events zeggen weinig; dit maakt er uitspraken van
// waar je iets aan kunt veranderen. Alles is een pure functie, zodat het te
// testen is en overal hetzelfde antwoord geeft — ook in het weekrapport dat de
// AI meekrijgt.

import { TAB_LABELS, TRACKED_FEATURES, type FeatureDef, type UsageEvent } from '@/lib/usage'

export interface TabUse {
  tab: string
  label: string
  visits: number
  seconds: number
  /** Gemiddelde kijktijd per bezoek, afgerond. */
  avgSeconds: number
  lastUsed: string | null
  daysSince: number | null
}

export interface FeatureUse extends FeatureDef {
  clicks: number
  lastUsed: string | null
}

export type SuggestionKind = 'start-tab' | 'hide-tab' | 'drop-feature' | 'te-weinig-data'

export interface Suggestion {
  kind: SuggestionKind
  /** Wat we voorstellen, in gewone taal, met het cijfer erbij. */
  text: string
  /** Waarop dit voorstel rust — zodat je het kunt wegwuiven met kennis. */
  evidence: string
  /** Waar het voorstel over gaat (tab-sleutel of feature-sleutel). */
  target?: string
}

export interface UsageReport {
  from: string | null
  to: string | null
  days: number
  totalEvents: number
  tabs: TabUse[]
  features: FeatureUse[]
  unused: FeatureUse[]
  suggestions: Suggestion[]
}

const DAG = 86400000

function dagenSinds(iso: string | null, now: Date): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.floor((now.getTime() - t) / DAG)
}

/** Hoeveel dagen de meting beslaat (minimaal 1, anders deel je door nul). */
export function meetPeriode(events: UsageEvent[], now: Date): { from: string | null; to: string | null; days: number } {
  if (events.length === 0) return { from: null, to: null, days: 0 }
  const tijden = events.map(e => Date.parse(e.created_at)).filter(Number.isFinite)
  if (tijden.length === 0) return { from: null, to: null, days: 0 }
  const van = Math.min(...tijden), tot = Math.max(...tijden)
  return {
    from: new Date(van).toISOString(),
    to: new Date(tot).toISOString(),
    days: Math.max(1, Math.ceil((now.getTime() - van) / DAG)),
  }
}

export function tabUse(events: UsageEvent[], now: Date, tabs: string[] = Object.keys(TAB_LABELS)): TabUse[] {
  return tabs.map(tab => {
    const eigen = events.filter(e => e.kind === 'tab' && e.target === tab)
    const seconds = eigen.reduce((s, e) => s + (e.seconds ?? 0), 0)
    const laatste = eigen.map(e => e.created_at).sort().at(-1) ?? null
    return {
      tab, label: TAB_LABELS[tab] ?? tab,
      visits: eigen.length,
      seconds,
      avgSeconds: eigen.length ? Math.round(seconds / eigen.length) : 0,
      lastUsed: laatste,
      daysSince: dagenSinds(laatste, now),
    }
  }).sort((a, b) => b.seconds - a.seconds || b.visits - a.visits || a.label.localeCompare(b.label))
}

export function featureUse(events: UsageEvent[], features: FeatureDef[] = TRACKED_FEATURES): FeatureUse[] {
  return features.map(f => {
    const eigen = events.filter(e => e.kind === 'feature' && e.target === f.key)
    return { ...f, clicks: eigen.length, lastUsed: eigen.map(e => e.created_at).sort().at(-1) ?? null }
  }).sort((a, b) => b.clicks - a.clicks || a.label.localeCompare(b.label))
}

/**
 * Voorstellen op basis van de meting. Bewust voorzichtig: onder de twee weken
 * meten zegt één stille tab nog niets, en we stellen nooit voor iets weg te
 * gooien waar je deze week nog aan zat.
 */
export function suggestions(report: Omit<UsageReport, 'suggestions'>, minDays = 14): Suggestion[] {
  const out: Suggestion[] = []

  if (report.days < minDays || report.totalEvents < 30) {
    out.push({
      kind: 'te-weinig-data',
      text: `Nog te weinig gemeten om iets te durven zeggen — ${report.days} ${report.days === 1 ? 'dag' : 'dagen'}, ${report.totalEvents} regels.`,
      evidence: `Vanaf ${minDays} dagen en 30 regels komen hier echte voorstellen.`,
    })
    return out
  }

  const bezocht = report.tabs.filter(t => t.visits > 0)

  // 1. Openen waar je toch altijd begint
  const top = bezocht[0]
  if (top && bezocht.length > 1) {
    const tweede = bezocht[1]
    if (top.visits >= tweede.visits * 1.5) {
      out.push({
        kind: 'start-tab', target: top.tab,
        text: `Open de app standaard op ${top.label}.`,
        evidence: `${top.visits}× geopend tegen ${tweede.visits}× voor ${tweede.label}.`,
      })
    }
  }

  // 2. Tabs waar je nooit komt
  for (const t of report.tabs) {
    if (t.visits === 0) {
      out.push({
        kind: 'hide-tab', target: t.tab,
        text: `Verberg ${t.label} — in ${report.days} dagen niet één keer geopend.`,
        evidence: 'Geen enkel bezoek gemeten.',
      })
    } else if ((t.daysSince ?? 0) >= 30 && t.visits <= 2) {
      out.push({
        kind: 'hide-tab', target: t.tab,
        text: `Verberg ${t.label} — ${t.visits}× geopend, laatst ${t.daysSince} dagen terug.`,
        evidence: `${t.visits} bezoeken in ${report.days} dagen.`,
      })
    }
  }

  // 3. Onderdelen die niemand aanraakt
  for (const f of report.unused) {
    out.push({
      kind: 'drop-feature', target: f.key,
      text: `"${f.label}" (${TAB_LABELS[f.tab] ?? f.tab}) is nooit gebruikt — vereenvoudigen of weghalen?`,
      evidence: `0 kliks in ${report.days} dagen.`,
    })
  }

  return out
}

/** Het hele rapport in één keer. */
export function buildReport(events: UsageEvent[], now: Date, opties: { tabs?: string[]; features?: FeatureDef[]; minDays?: number } = {}): UsageReport {
  const periode = meetPeriode(events, now)
  const tabs = tabUse(events, now, opties.tabs)
  const features = featureUse(events, opties.features)
  const kern = {
    ...periode,
    totalEvents: events.length,
    tabs,
    features,
    unused: features.filter(f => f.clicks === 0),
  }
  return { ...kern, suggestions: suggestions(kern, opties.minDays) }
}

/** Het rapport als korte tekst — dit is wat de AI meekrijgt om mee te denken. */
export function reportAsText(r: UsageReport): string {
  const regels: string[] = []
  regels.push(`Gebruik over ${r.days} ${r.days === 1 ? 'dag' : 'dagen'} (${r.totalEvents} regels)`)
  regels.push('')
  regels.push('Tabs, meest gebruikt eerst:')
  for (const t of r.tabs) {
    regels.push(`  ${t.label}: ${t.visits}× · ${minuten(t.seconds)} · ${t.daysSince === null ? 'nooit' : `laatst ${t.daysSince}d terug`}`)
  }
  regels.push('')
  regels.push(r.unused.length ? `Nooit gebruikt (${r.unused.length}):` : 'Alles is minstens één keer gebruikt.')
  for (const f of r.unused) regels.push(`  ${f.label} (${TAB_LABELS[f.tab] ?? f.tab})`)
  regels.push('')
  regels.push('Voorstellen:')
  for (const s of r.suggestions) regels.push(`  - ${s.text} [${s.evidence}]`)
  return regels.join('\n')
}

export function minuten(seconden: number): string {
  if (seconden < 60) return `${seconden}s`
  const m = Math.round(seconden / 60)
  if (m < 60) return `${m}m`
  const u = Math.floor(m / 60)
  return `${u}u${String(m % 60).padStart(2, '0')}`
}

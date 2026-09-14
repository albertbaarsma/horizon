// ─── Mood tracker ─────────────────────────────────────────────────────────────
// Stemming (-10…+10), energie (1–5) en slaapuren per dag. Bewust beide kanten
// van de schaal: bij bipolariteit is zowel een dip als een piek relevant.
// Slaap staat erbij omdat een verandering daarin vaak het vroegste signaal is.
//
// Let op: dit is een zelf-registratie-hulpmiddel, geen diagnose-instrument.
// Alles hier beschrijft alleen wat er ingevuld is — het stelt niets vast, en
// gebruikt bewust geen klinische termen (geen "manisch"/"depressief" in de UI).

import type { MoodEntry } from '@/lib/types'

export const MOOD_MIN = -10
export const MOOD_MAX = 10

/** Zeven banden over de volle -10..+10 breedte — zelfde labels/kleuren als altijd, nu breder. */
const MOOD_BANDS: { max: number; label: string; emoji: string; color: string }[] = [
  { max: -7, label: 'Zwaar omlaag', emoji: '🌑', color: '#60a5fa' },
  { max: -3, label: 'Laag',         emoji: '🌘', color: '#7dd3fc' },
  { max: -1, label: 'Wat vlak',     emoji: '🌗', color: '#94a3b8' },
  { max: 0,  label: 'Neutraal',     emoji: '🌓', color: '#a3a3a3' },
  { max: 2,  label: 'Goed',         emoji: '🌖', color: '#4ade80' },
  { max: 6,  label: 'Erg goed',     emoji: '🌕', color: '#fbbf24' },
  { max: 10, label: 'Heel hoog',    emoji: '☀️', color: '#fb923c' },
]

export function moodMeta(mood: number): { label: string; emoji: string; color: string } {
  const m = Math.max(MOOD_MIN, Math.min(MOOD_MAX, Math.round(mood)))
  return MOOD_BANDS.find(b => m <= b.max) ?? MOOD_BANDS[MOOD_BANDS.length - 1]
}

/** Entries van nieuw naar oud, met de meest recente eerst. */
export function sortByDateDesc(entries: MoodEntry[]): MoodEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))
}

export function entryForDate(entries: MoodEntry[], date: string): MoodEntry | undefined {
  return entries.find(e => e.date === date)
}

/** De laatste n dagen aan entries (op datum, niet op aantal rijen). */
export function lastDays(entries: MoodEntry[], days: number, today: string): MoodEntry[] {
  const from = new Date(today + 'T12:00:00')
  from.setDate(from.getDate() - (days - 1))
  const fromStr = from.toISOString().slice(0, 10)
  return sortByDateDesc(entries.filter(e => e.date >= fromStr && e.date <= today))
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export interface MoodSummary {
  count: number
  avgMood: number | null
  avgEnergy: number | null
  avgSleep: number | null
  /** Hoeveel dagen achtereen (vanaf de meest recente entry) mood <= -2. */
  lowStreak: number
  /** Hoeveel dagen achtereen (vanaf de meest recente entry) mood >= 2. */
  highStreak: number
  /** Kortste en langste geregistreerde nacht in de periode. */
  minSleep: number | null
  maxSleep: number | null
  /** Verschil tussen het gemiddelde van de laatste 3 en de 3 daarvoor (mood). */
  trend: number | null
}

export function summarize(entries: MoodEntry[]): MoodSummary {
  const sorted = sortByDateDesc(entries)
  const moods  = sorted.map(e => e.mood)
  const energy = sorted.map(e => e.energy).filter((v): v is number => typeof v === 'number')
  const sleep  = sorted.map(e => e.sleep_hours).filter((v): v is number => typeof v === 'number')

  let lowStreak = 0
  for (const m of moods) { if (m <= -2) lowStreak++; else break }
  let highStreak = 0
  for (const m of moods) { if (m >= 2) highStreak++; else break }

  const recent = moods.slice(0, 3)
  const before = moods.slice(3, 6)
  const rAvg = avg(recent), bAvg = avg(before)

  return {
    count: sorted.length,
    avgMood: avg(moods),
    avgEnergy: avg(energy),
    avgSleep: avg(sleep),
    lowStreak,
    highStreak,
    minSleep: sleep.length ? Math.min(...sleep) : null,
    maxSleep: sleep.length ? Math.max(...sleep) : null,
    trend: rAvg !== null && bAvg !== null ? rAvg - bAvg : null,
  }
}

/**
 * Beschrijft feitelijk wat er in de data staat — geen diagnose, geen advies.
 * Bedoeld als spiegel: "dit heb je ingevuld", zodat patronen zichtbaar worden.
 */
export function describePattern(s: MoodSummary): string[] {
  const out: string[] = []
  if (s.count === 0) return ['Nog niets ingevuld.']

  if (s.avgMood !== null) {
    out.push(`Gemiddelde stemming over ${s.count} dag${s.count === 1 ? '' : 'en'}: ${s.avgMood.toFixed(1)} (${moodMeta(s.avgMood).label.toLowerCase()}).`)
  }
  if (s.lowStreak >= 3)  out.push(`${s.lowStreak} dagen op rij laag ingevuld.`)
  if (s.highStreak >= 3) out.push(`${s.highStreak} dagen op rij hoog ingevuld.`)
  if (s.avgSleep !== null) {
    out.push(`Gemiddeld ${s.avgSleep.toFixed(1)} uur slaap` +
      (s.minSleep !== null && s.maxSleep !== null ? ` (van ${s.minSleep} tot ${s.maxSleep} uur).` : '.'))
  }
  if (s.minSleep !== null && s.minSleep < 5) out.push(`Kortste nacht: ${s.minSleep} uur.`)
  if (s.trend !== null && Math.abs(s.trend) >= 1) {
    out.push(s.trend > 0
      ? `De laatste dagen hoger ingevuld dan daarvoor (+${s.trend.toFixed(1)}).`
      : `De laatste dagen lager ingevuld dan daarvoor (${s.trend.toFixed(1)}).`)
  }
  return out
}

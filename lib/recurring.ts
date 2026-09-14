// ─── Herhaaltaken: materialiseren i.p.v. virtueel berekenen ───────────────────
// Een herhaaltaak was ooit een aparte, "spookachtige" rij die WeekTab/DagTab/
// MonthView elk apart moesten uitrekenen (drie kopieën van dezelfde logica) en
// die niet meesleepte met de handmatige volgorde. Nu is elke bezetting gewoon
// een echte week_items-rij (met recur_id gezet) — precies zo'n normale taak
// als alle andere, dus afvinken/slepen/herschikken werkt vanzelf mee.
//
// Dit bestand rekent alleen uit WELKE (patroon × datum)-combinaties nog geen
// rij hebben — puur, geen I/O, makkelijk te testen. DashboardClient.tsx doet
// de daadwerkelijke insert en houdt de React-state bij.
import type { RecurringTask, WeekItem } from './types'
import { addDays } from './dates'

const DAY_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Hoeveel dagen vooruit we standaard materialiseren (~13 weken). Ruim genoeg
 *  voor "Meer weken laden" in de praktijk, klein genoeg om de tabel niet
 *  onnodig te laten groeien. */
export const MATERIALIZE_WINDOW_DAYS = 90

export interface NewOccurrence {
  date: string
  type: WeekItem['type']
  text: string
  proj_id: string | null
  recur_id: number
}

/** Welke bezettingen (patroon × datum) nog géén week_item hebben, voor `days`
 *  dagen vanaf (en met) `fromDate`. Sluit dezelfde datum uit als er al een rij
 *  bestaat met recur_id=patroon (op die datum, of — als de bezetting deze week
 *  al naar een andere dag versleept is — via moved_from). Alleen actieve
 *  patronen, en nooit een expliciet overgeslagen datum. */
export function computeMissingOccurrences(
  patterns: RecurringTask[],
  existingItems: WeekItem[],
  fromDate: string,
  days: number = MATERIALIZE_WINDOW_DAYS,
): NewOccurrence[] {
  const active = patterns.filter(p => p.active)
  if (active.length === 0) return []

  const out: NewOccurrence[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i)
    const dayEn = DAY_EN[new Date(date + 'T12:00:00').getDay()]
    for (const rt of active) {
      if (!rt.days.includes(dayEn)) continue
      if (rt.skip_dates?.includes(date)) continue
      const already = existingItems.some(w => w.recur_id === rt.id && (w.date === date || w.moved_from === date))
      if (already) continue
      out.push({ date, type: rt.type, text: rt.name, proj_id: rt.proj_id ?? null, recur_id: rt.id })
    }
  }
  return out
}

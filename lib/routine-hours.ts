// ─── Routine-uren: hoeveel tijd kosten je wekelijkse herhaaltaken? ───────────
// Rekenlogica staat los van de UI zodat het testbaar blijft.

import type { RecurringTask } from '@/lib/types'

export const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
export const DAY_LABELS_NL = ['ma','di','wo','do','vr','za','zo'] as const

/** Als een herhaaltaak geen duur heeft, rekenen we hiermee — anders valt alles op 0 uur. */
export const DEFAULT_DURATION_MIN = 30

/** Standaard aantal wakkere uren per dag; het "budget" waartegen we routines afzetten. */
export const DEFAULT_WAKING_HOURS = 16

export function minutesFor(rt: Pick<RecurringTask, 'duration_min'>): number {
  return rt.duration_min ?? DEFAULT_DURATION_MIN
}

/** Actieve herhaaltaken die op deze dag vallen (dag als 'monday' … 'sunday'). */
export function routinesOnDay(tasks: RecurringTask[], dayKey: string): RecurringTask[] {
  return tasks.filter(rt => rt.active && rt.days.includes(dayKey))
}

/** Minuten aan routines per dag, in ma→zo volgorde. */
export function minutesPerDay(tasks: RecurringTask[]): number[] {
  return DAY_KEYS.map(day =>
    routinesOnDay(tasks, day).reduce((sum, rt) => sum + minutesFor(rt), 0)
  )
}

export interface WeekLoad {
  /** Minuten per dag, ma→zo. */
  perDay: number[]
  /** Totaal aantal minuten routines deze week. */
  totalMin: number
  /** Aantal keren dat er een routine plaatsvindt (som over alle dagen). */
  occurrences: number
  /** Beschikbare minuten in de week op basis van wakkere uren per dag. */
  budgetMin: number
  /** Minuten die overblijven na de routines (kan negatief zijn bij overboeking). */
  freeMin: number
  /** Percentage van de week dat naar routines gaat (0–100, afgekapt op 100). */
  pctBusy: number
  /** De drukste dag (index 0=ma) en zijn minuten. */
  busiestDay: { index: number; min: number }
}

export function weekLoad(tasks: RecurringTask[], wakingHoursPerDay = DEFAULT_WAKING_HOURS): WeekLoad {
  const perDay = minutesPerDay(tasks)
  const totalMin = perDay.reduce((a, b) => a + b, 0)
  const occurrences = DAY_KEYS.reduce((n, day) => n + routinesOnDay(tasks, day).length, 0)
  const budgetMin = Math.max(0, Math.round(wakingHoursPerDay * 60 * 7))
  const busiestMin = Math.max(...perDay)
  return {
    perDay,
    totalMin,
    occurrences,
    budgetMin,
    freeMin: budgetMin - totalMin,
    pctBusy: budgetMin > 0 ? Math.min(100, Math.round((totalMin / budgetMin) * 100)) : 0,
    busiestDay: { index: perDay.indexOf(busiestMin), min: busiestMin },
  }
}

/** 90 → "1u 30m", 60 → "1u", 45 → "45m", 0 → "0m" */
export function formatMinutes(min: number): string {
  const neg = min < 0
  const abs = Math.abs(Math.round(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const parts = h > 0 && m > 0 ? `${h}u ${m}m` : h > 0 ? `${h}u` : `${m}m`
  return neg ? `-${parts}` : parts
}

/** Uren met één decimaal, voor compacte weergave: 155 → "2,6u" */
export function formatHours(min: number): string {
  return `${(min / 60).toFixed(1).replace('.', ',')}u`
}

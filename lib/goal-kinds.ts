// ─── Doelen en hobbydoelen ────────────────────────────────────────────────────
// Een hobbydoel is een echt doel: je mag het afvinken en het levert een
// prestatie op. Maar het hoort niet in je voortgangscijfer, want dan verwatert
// "66% van mijn doelen gehaald" zodra je een spel wil uitspelen. Daarom staan ze
// apart, met een eigen kleur.

import type { Goal, GoalKind } from '@/lib/types'

export const HOBBY: GoalKind = 'hobby'

export const KIND_META: Record<GoalKind, { label: string; color: string; emoji: string }> = {
  doel:  { label: 'Doel',      color: '#3fb950', emoji: '🎯' },
  hobby: { label: 'Hobbydoel', color: '#e879f9', emoji: '🎲' },
}

/** Standaard 'doel' — oude rijen zonder kind horen bij je gewone doelen. */
export function goalKind(goal: Pick<Goal, 'kind'>): GoalKind {
  return goal.kind === HOBBY ? HOBBY : 'doel'
}

export function isHobbyGoal(goal: Pick<Goal, 'kind'>): boolean {
  return goalKind(goal) === HOBBY
}

/** Doelen en hobbydoelen gescheiden, in dezelfde onderlinge volgorde. */
export function splitByKind<T extends Pick<Goal, 'kind'>>(goals: T[]): { doelen: T[]; hobbys: T[] } {
  return {
    doelen: goals.filter(g => !isHobbyGoal(g)),
    hobbys: goals.filter(g => isHobbyGoal(g)),
  }
}

export interface Progress { done: number; total: number; pct: number }

/** Voortgang over één lijst. Leeg = 0%, nooit een deling door nul. */
export function progressOf(goals: Pick<Goal, 'done'>[]): Progress {
  const total = goals.length
  const done = goals.filter(g => g.done).length
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/**
 * De voortgang die telt: alleen je gewone doelen. Hobbydoelen krijgen hun eigen
 * cijfer, zodat "een spel uitspelen" je jaardoelen niet oppoetst of verwatert.
 */
export function goalProgress(goals: Pick<Goal, 'done' | 'kind' | 'deleted_at'>[]): { doelen: Progress; hobbys: Progress } {
  const levend = goals.filter(g => !g.deleted_at)
  const { doelen, hobbys } = splitByKind(levend)
  return { doelen: progressOf(doelen), hobbys: progressOf(hobbys) }
}

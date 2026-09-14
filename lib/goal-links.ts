// ─── Wat hangt er allemaal aan een doel? ──────────────────────────────────────
// Een doel staat niet alleen in het doelen-overzicht: het duikt op in je visie,
// in de weekplanning, in de weekterugblik, in het zoekvenster, bij de AI, en het
// heeft XP en (als het gehaald is) een prestatie opgeleverd. Weggooien moet dat
// allemaal meenemen — anders blijf je een doel tegenkomen dat je net hebt
// weggegooid.

import type { Goal, Achievement, Project } from '@/lib/types'
import type { createClient } from '@/lib/supabase'
import { goalAchievementText, syncGoalAchievement } from '@/lib/goal-achievement'

type Supabase = ReturnType<typeof createClient>

/** XP die een doel oplevert bij aanmaken (de `trg_goal_xp`-trigger doet dit). */
export const GOAL_XP = 15

/** Precies de reden die de database erbij schrijft — nodig om hem terug te zetten. */
export function goalXpReason(goal: Pick<Goal, 'text'>): string {
  return `Doel toegevoegd: ${goal.text}`
}

/**
 * De doelen die nog meedoen. Alles buiten de prullenbak zelf moet hier langs,
 * zodat een weggegooid doel nergens meer opduikt.
 */
export function activeGoals<T extends { deleted_at?: string | null }>(goals: T[]): T[] {
  return goals.filter(g => !g.deleted_at)
}

/** Doelen in de prullenbak, nieuwste eerst. */
export function trashedGoals<T extends { deleted_at?: string | null }>(goals: T[]): T[] {
  return goals.filter(g => !!g.deleted_at)
    .sort((a, b) => String(b.deleted_at).localeCompare(String(a.deleted_at)))
}

/** Hoort deze prestatie bij dit doel? (De koppeling loopt via de tekst.) */
export function isGoalAchievement(achievement: Pick<Achievement, 'text'>, goal: Goal): boolean {
  return achievement.text === goalAchievementText(goal)
}

/**
 * Doel naar de prullenbak — inclusief alles wat eraan hangt: de XP die het
 * opleverde en de prestatie die eruit voortkwam. Herstelbaar: zie
 * `restoreGoalEverywhere`.
 */
export async function trashGoalEverywhere(supabase: Supabase, userId: string, goal: Goal, now = new Date().toISOString()) {
  const { error } = await supabase.from('goals')
    .update({ deleted_at: now }).eq('id', goal.id).eq('user_id', userId)
  if (error) return { ok: false as const, error }

  // XP van het aanmaken terugdraaien
  await supabase.from('xp_events').delete()
    .eq('user_id', userId).eq('source', 'goal').eq('ref_id', String(goal.id))

  // Prestatie die uit dit doel voortkwam (plus de XP daarvan) weghalen
  if (goal.done) await syncGoalAchievement(supabase, userId, goal, false, now.slice(0, 10))

  return { ok: true as const, deleted_at: now, achievementText: goal.done ? goalAchievementText(goal) : null }
}

/**
 * Doel terug uit de prullenbak, met de XP en de prestatie er weer bij — anders
 * kost weggooien-en-terughalen je stilletjes je voortgang.
 */
export async function restoreGoalEverywhere(supabase: Supabase, userId: string, goal: Goal, dateStr: string) {
  const { error } = await supabase.from('goals')
    .update({ deleted_at: null }).eq('id', goal.id).eq('user_id', userId)
  if (error) return { ok: false as const, error }

  // XP alleen terugzetten als hij er niet al staat (dubbel is erger dan niets)
  const { data: bestaand } = await supabase.from('xp_events')
    .select('id').eq('user_id', userId).eq('source', 'goal').eq('ref_id', String(goal.id)).limit(1)
  if (!bestaand?.length) {
    await supabase.from('xp_events').insert({
      user_id: userId, amount: GOAL_XP, reason: goalXpReason(goal),
      cat_id: goal.cat_id, source: 'goal', ref_id: String(goal.id), seen: true,
    })
  }

  const achievement = goal.done ? await syncGoalAchievement(supabase, userId, goal, true, dateStr) : null
  return { ok: true as const, achievement }
}

// ─── Hoe een doel met de rest van de app samenhangt ──────────────────────────

/**
 * Projecten in hetzelfde levensgebied als dit doel. Er is (bewust) geen aparte
 * koppeltabel — een doel en zijn projecten leven al in hetzelfde levensgebied,
 * en dat is de relatie die de 3D-graaf ook al gebruikt. Gearchiveerde projecten
 * tellen niet mee, dat is afgesloten werk.
 */
export function relatedProjectsFor(goal: Pick<Goal, 'cat_id'>, projects: Project[]): Project[] {
  if (!goal.cat_id) return []
  return projects.filter(p => p.cat_id === goal.cat_id && p.status !== 'archief')
}

export interface GegroepeerdDoel<T> {
  goal: T
  /** 0 = hoofddoel (of een sub-doel waarvan het hoofddoel hier niet in de lijst zit), 1 = zichtbaar genest sub-doel. */
  diepte: 0 | 1
}

/**
 * Zet een platte lijst doelen om in hoofddoel-met-zijn-subdoelen-erdirect-onder.
 * Werkt alleen binnen de meegegeven lijst: een sub-doel waarvan het hoofddoel
 * niet in diezelfde lijst zit (bijvoorbeeld een andere horizon-kolom) blijft
 * gewoon op zijn eigen plek staan, ongenest — de aanroeper kan dat geval apart
 * herkennen doordat `parent_id` gezet is maar `diepte` toch 0 is.
 */
export function groepeerMetSubdoelen<T extends { id: number; parent_id?: number | null }>(items: T[]): GegroepeerdDoel<T>[] {
  const ids = new Set(items.map(g => g.id))
  const kinderenVan = new Map<number, T[]>()
  const topNiveau: T[] = []
  for (const g of items) {
    if (g.parent_id != null && ids.has(g.parent_id) && g.parent_id !== g.id) {
      const lijst = kinderenVan.get(g.parent_id) ?? []
      lijst.push(g)
      kinderenVan.set(g.parent_id, lijst)
    } else {
      topNiveau.push(g)
    }
  }
  const uit: GegroepeerdDoel<T>[] = []
  for (const g of topNiveau) {
    uit.push({ goal: g, diepte: 0 })
    for (const kind of kinderenVan.get(g.id) ?? []) uit.push({ goal: kind, diepte: 1 })
  }
  return uit
}

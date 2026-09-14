// ─── Vrije skill-tree ─────────────────────────────────────────────────────────
// Vaardigheden die ontstaan zodra er XP naartoe gaat (sociaal, IT, muziek…),
// los van de vaste levenscategorieën. Aggregatie hier zodat het testbaar is.

import type { XpEvent } from '@/lib/types'
import { skillLevelForXp, skillProgress } from '@/lib/xp'

/** Namen normaliseren zodat "Sociaal", "sociaal " en "SOCIAAL" één skill zijn. */
export function normalizeSkill(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Netjes weergeven: eerste letter van elk woord een hoofdletter. */
export function displaySkill(name: string): string {
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export interface SkillStat {
  name: string      // genormaliseerd
  label: string     // weergavenaam
  xp: number
  level: number
  pct: number       // voortgang binnen het level (0–100)
  toNext: number    // XP tot het volgende level
  count: number     // aantal keren dat deze skill XP kreeg
  lastAt: string | null
}

/** Alle vrije skills uit de XP-log, aflopend op XP. */
export function skillsFromEvents(events: XpEvent[]): SkillStat[] {
  const byName = new Map<string, { xp: number; count: number; lastAt: string | null }>()

  for (const e of events) {
    if (!e.skill) continue
    const key = normalizeSkill(e.skill)
    if (!key) continue
    const cur = byName.get(key) ?? { xp: 0, count: 0, lastAt: null }
    cur.xp += e.amount
    cur.count += 1
    if (!cur.lastAt || (e.created_at && e.created_at > cur.lastAt)) cur.lastAt = e.created_at ?? null
    byName.set(key, cur)
  }

  return [...byName.entries()]
    .map(([name, v]) => {
      const prog = skillProgress(v.xp)
      return {
        name,
        label: displaySkill(name),
        xp: v.xp,
        level: skillLevelForXp(v.xp),
        pct: prog.pct,
        toNext: prog.toNext,
        count: v.count,
        lastAt: v.lastAt,
      }
    })
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
}

/** Bestaat deze skill al (genormaliseerd)? Voor hergebruik i.p.v. dubbele namen. */
export function findSkill(skills: SkillStat[], name: string): SkillStat | undefined {
  const key = normalizeSkill(name)
  return skills.find(s => s.name === key)
}

// ─── Levensgebieden mét hun vaardigheden ──────────────────────────────────────
// Levensgebieden en skills horen bij elkaar: een skill hoort onder het gebied
// waar zijn XP vandaan komt (het cat_id op het xp_event). Heeft een skill XP uit
// meerdere gebieden, dan valt hij onder het gebied waar hij het meeste XP haalde.

export const NO_AREA = '__none'

export interface AreaWithSkills {
  id: string          // cat_id, of NO_AREA
  name: string
  xp: number          // totale XP van dit levensgebied (alle bronnen)
  skills: SkillStat[] // vaardigheden die onder dit gebied vallen
}

export function areasWithSkills(
  events: XpEvent[],
  categories: { id: string; name: string }[],
  noAreaLabel = 'Overig',
): AreaWithSkills[] {
  // 1. XP per levensgebied (alles, niet alleen skills)
  const areaXp = new Map<string, number>()
  for (const e of events) {
    const key = e.cat_id ?? NO_AREA
    areaXp.set(key, (areaXp.get(key) ?? 0) + e.amount)
  }

  // 2. Per skill: hoeveel XP per gebied? Het zwaarste gebied wordt zijn thuis.
  const perSkillArea = new Map<string, Map<string, number>>()
  for (const e of events) {
    if (!e.skill) continue
    const skill = normalizeSkill(e.skill)
    if (!skill) continue
    const areas = perSkillArea.get(skill) ?? new Map<string, number>()
    const key = e.cat_id ?? NO_AREA
    areas.set(key, (areas.get(key) ?? 0) + e.amount)
    perSkillArea.set(skill, areas)
  }

  const homeArea = new Map<string, string>()
  for (const [skill, areas] of perSkillArea) {
    const best = [...areas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
    homeArea.set(skill, best?.[0] ?? NO_AREA)
  }

  // 3. Skills opbouwen en onder hun gebied hangen
  const skillsByArea = new Map<string, SkillStat[]>()
  for (const sk of skillsFromEvents(events)) {
    const area = homeArea.get(sk.name) ?? NO_AREA
    skillsByArea.set(area, [...(skillsByArea.get(area) ?? []), sk])
  }

  // 4. Gebieden samenstellen: alles met XP of met skills
  const ids = new Set<string>([...areaXp.keys(), ...skillsByArea.keys()])
  return [...ids]
    .map(id => ({
      id,
      name: id === NO_AREA ? noAreaLabel : (categories.find(c => c.id === id)?.name ?? id),
      xp: areaXp.get(id) ?? 0,
      skills: skillsByArea.get(id) ?? [],
    }))
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
}

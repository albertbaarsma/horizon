// ─── Klopt de boel nog met zichzelf? ──────────────────────────────────────────
// Hetzelfde stuk werk staat in Horizon soms op meer plekken: als doel, als
// project, als taak, in de weekplanning. Zolang de namen exact gelijk zijn kan
// de app die verbanden zelf leggen, maar "Lemon tree afronden met Lisette" en
// "Lemon Tree" zijn voor een computer twee losse dingen. Deze module zoekt zulke
// paren op en zegt wat er niet klopt — het besluit blijft aan de gebruiker.

import type { Goal, Project, Task, WeekItem, RecurringTask, Achievement } from '@/lib/types'
import { normalizeText, keywords, similarity } from '@/lib/task-freshness'

export type ItemKind = 'goal' | 'project' | 'task' | 'week' | 'recurring'

export interface Item {
  kind: ItemKind
  /** Sleutel binnen zijn eigen soort (id als tekst). */
  id: string
  name: string
  done: boolean
  /** Waar het item bij hoort, voor de uitleg. */
  where?: string | null
  /** Planningsitem dat uit een herhaaltaak komt — dat is een routine-dag, geen los werk. */
  fromRecurring?: boolean
}

export const KIND_LABEL: Record<ItemKind, string> = {
  goal: 'doel', project: 'project', task: 'taak', week: 'planning', recurring: 'herhaaltaak',
}

export interface ConsistencyInput {
  goals: Goal[]
  projects: Project[]
  tasks: Task[]
  weekItems: WeekItem[]
  recurringTasks: RecurringTask[]
  achievements?: Achievement[]
}

/** Alles wat "een stuk werk" is, in één lijst, zodat we kunnen vergelijken. */
export function toItems(input: ConsistencyInput): Item[] {
  const out: Item[] = []
  for (const g of input.goals) {
    if (g.deleted_at) continue
    out.push({ kind: 'goal', id: String(g.id), name: g.text, done: g.done, where: g.horizon })
  }
  for (const p of input.projects) {
    // Een afgerond of geparkeerd project is geen open werk
    out.push({ kind: 'project', id: p.id, name: p.name, done: p.status === 'archief', where: p.status })
  }
  for (const t of input.tasks) {
    out.push({ kind: 'task', id: String(t.id), name: t.name, done: t.status === 'done', where: t.proj_id })
  }
  for (const w of input.weekItems) {
    out.push({ kind: 'week', id: String(w.id), name: w.text, done: w.done, where: w.date, fromRecurring: !!w.recur_id })
  }
  for (const r of input.recurringTasks) {
    if (!r.active) continue
    out.push({ kind: 'recurring', id: String(r.id), name: r.name, done: false, where: r.days.join(',') })
  }
  return out
}

export type IssueKind = 'staat-uit-elkaar' | 'dubbel' | 'wees'

export interface Issue {
  kind: IssueKind
  /** Stabiele sleutel, zodat 'laat staan' blijft werken over sessies heen. */
  key: string
  title: string
  detail: string
  items: Item[]
  /** 1 = zeker, lager = vermoeden. Voor de sortering. */
  score: number
}

export const ISSUE_META: Record<IssueKind, { label: string; color: string; hint: string }> = {
  'staat-uit-elkaar': { label: 'Staat uit elkaar', color: '#d29922', hint: 'Op de ene plek klaar, op de andere nog open' },
  'dubbel':           { label: 'Dubbel',           color: '#58a6ff', hint: 'Lijkt hetzelfde werk op twee plekken' },
  'wees':             { label: 'Losgeraakt',       color: '#f85149', hint: 'Verwijst naar iets dat niet meer bestaat' },
}

/** Hoeveel inhoudswoorden hebben twee namen gemeen? */
export function sharedKeywords(a: string, b: string): string[] {
  const B = new Set(keywords(b))
  return [...new Set(keywords(a))].filter(w => B.has(w))
}

/**
 * Twee items die (bijna) hetzelfde heten. Exact dezelfde naam telt als zeker;
 * daarbuiten zijn minstens twee gedeelde woorden nodig. Anders koppelt "Naar
 * Lisette" zich aan elk doel waarin Lisette voorkomt, en "Sportschool (1/4)"
 * aan alles met sportschool erin.
 */
export function looksSame(a: Item, b: Item, min = 0.7): number {
  const na = normalizeText(a.name), nb = normalizeText(b.name)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (sharedKeywords(a.name, b.name).length < 2) return 0
  const s = similarity(a.name, b.name)
  return s >= min ? s * 0.9 : 0   // een vermoeden, geen zekerheid
}

function pairKey(a: Item, b: Item) {
  const [x, y] = [`${a.kind}:${a.id}`, `${b.kind}:${b.id}`].sort()
  return `${x}|${y}`
}

/**
 * Paren die hetzelfde werk lijken te zijn. Twee soorten uitkomst:
 * de één is klaar en de ander niet (dan staat je overzicht uit elkaar), of ze
 * staan beide open (dan heb je het werk dubbel).
 */
export function findPairs(items: Item[], min = 0.7): Issue[] {
  const out: Issue[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]
      // Binnen de weekplanning staat hetzelfde bewust vaker (elke week opnieuw)
      if (a.kind === 'week' && b.kind === 'week') continue
      // Een herhaaltaak hóórt terug te komen in de planning
      if ((a.kind === 'recurring' && b.kind === 'week') || (a.kind === 'week' && b.kind === 'recurring')) continue
      // Een afgevinkte routine-dag zegt niets over losse taken met dezelfde naam
      if (a.fromRecurring || b.fromRecurring) continue

      const score = looksSame(a, b, min)
      if (!score) continue

      const key = pairKey(a, b)
      if (a.done !== b.done) {
        const klaar = a.done ? a : b, open = a.done ? b : a
        out.push({
          kind: 'staat-uit-elkaar', key, score,
          title: open.name,
          detail: `Het ${KIND_LABEL[klaar.kind]} "${klaar.name}" staat op klaar, maar ${lidwoord(open.kind)} ${KIND_LABEL[open.kind]} "${open.name}" staat nog open.`,
          items: [open, klaar],
        })
      } else if (!a.done) {
        out.push({
          kind: 'dubbel', key, score,
          title: a.name,
          detail: `Staat als ${KIND_LABEL[a.kind]} én als ${KIND_LABEL[b.kind]}: "${a.name}" en "${b.name}". Werk je hier twee keer aan?`,
          items: [a, b],
        })
      }
    }
  }
  return out
}

function lidwoord(kind: ItemKind) {
  return kind === 'project' ? 'het' : 'de'
}

/** Verwijzingen die nergens meer op uitkomen. */
export function findOrphans(input: ConsistencyInput): Issue[] {
  const out: Issue[] = []
  const projIds = new Set(input.projects.map(p => p.id))
  const taskIds = new Set(input.tasks.map(t => String(t.id)))
  const recurIds = new Set(input.recurringTasks.map(r => String(r.id)))

  // Een open taak onder een afgerond project: die is zijn plek kwijt en ligt nu
  // in de inbox op de kaart.
  const gearchiveerd = new Set(input.projects.filter(p => p.status === 'archief').map(p => p.id))
  for (const t of input.tasks) {
    if (t.status === 'done' || t.deleted_at) continue
    if (t.proj_id && gearchiveerd.has(t.proj_id)) {
      const naam = input.projects.find(p => p.id === t.proj_id)?.name ?? t.proj_id
      out.push({
        kind: 'staat-uit-elkaar', key: `task:${t.id}:archief`, score: 1,
        title: t.name,
        detail: `Het project "${naam}" is afgerond, maar deze taak staat er nog open onder.`,
        items: [{ kind: 'task', id: String(t.id), name: t.name, done: false }],
      })
    }
  }

  for (const t of input.tasks) {
    if (t.proj_id && !projIds.has(t.proj_id)) {
      out.push({
        kind: 'wees', key: `task:${t.id}:proj`, score: 1,
        title: t.name,
        detail: `Deze taak hangt aan een project dat niet meer bestaat, daarom zie je hem alleen in de inbox.`,
        items: [{ kind: 'task', id: String(t.id), name: t.name, done: t.status === 'done' }],
      })
    }
  }
  for (const w of input.weekItems) {
    if (w.task_id && !taskIds.has(String(w.task_id))) {
      out.push({
        kind: 'wees', key: `week:${w.id}:task`, score: 1,
        title: w.text,
        detail: `Dit planningsitem verwijst naar een taak die verwijderd is; afvinken werkt de taak dus niet meer bij.`,
        items: [{ kind: 'week', id: String(w.id), name: w.text, done: w.done, where: w.date }],
      })
    }
    if (w.recur_id && !recurIds.has(String(w.recur_id))) {
      out.push({
        kind: 'wees', key: `week:${w.id}:recur`, score: 1,
        title: w.text,
        detail: `Dit planningsitem hoort bij een herhaaltaak die niet meer bestaat.`,
        items: [{ kind: 'week', id: String(w.id), name: w.text, done: w.done, where: w.date }],
      })
    }
    if (w.proj_id && !projIds.has(w.proj_id)) {
      out.push({
        kind: 'wees', key: `week:${w.id}:proj`, score: 1,
        title: w.text,
        detail: `Dit planningsitem hangt aan een project dat niet meer bestaat.`,
        items: [{ kind: 'week', id: String(w.id), name: w.text, done: w.done, where: w.date }],
      })
    }
  }
  return out
}

/**
 * Alle controles in één keer, hardste bewijs bovenaan. Items die de gebruiker
 * met rust wil laten (op sleutel) blijven weg.
 */
export function runChecks(input: ConsistencyInput, negeer: string[] = [], min = 0.7): Issue[] {
  const items = toItems(input)
  const alles = [...findOrphans(input), ...findPairs(items, min)]
  const uniek = new Map<string, Issue>()
  for (const issue of alles) {
    if (negeer.includes(issue.key)) continue
    const bestaand = uniek.get(issue.key)
    if (!bestaand || issue.score > bestaand.score) uniek.set(issue.key, issue)
  }
  const rang: Record<IssueKind, number> = { wees: 0, 'staat-uit-elkaar': 1, dubbel: 2 }
  return [...uniek.values()].sort((a, b) =>
    rang[a.kind] - rang[b.kind] || b.score - a.score || a.title.localeCompare(b.title))
}

// ─── Wekelijkse controle ──────────────────────────────────────────────────────

export const CHECK_INTERVAL_DAGEN = 7

/** Is het weer tijd voor een controle? (Nooit gedaan telt als ja.) */
export function checkIsDue(laatste: string | null, now: Date, interval = CHECK_INTERVAL_DAGEN): boolean {
  if (!laatste) return true
  const t = Date.parse(laatste)
  if (!Number.isFinite(t)) return true
  return (now.getTime() - t) / 86400000 >= interval
}

/** Leesbaar hoe lang de laatste controle geleden is. */
export function laatsteControleTekst(laatste: string | null, now: Date): string {
  if (!laatste) return 'nog niet gecontroleerd'
  const dagen = Math.floor((now.getTime() - Date.parse(laatste)) / 86400000)
  if (!Number.isFinite(dagen)) return 'nog niet gecontroleerd'
  if (dagen <= 0) return 'vandaag gecontroleerd'
  if (dagen === 1) return 'gisteren gecontroleerd'
  return `${dagen} dagen geleden gecontroleerd`
}

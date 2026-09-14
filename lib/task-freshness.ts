// ─── Is deze taak nog echt open? ──────────────────────────────────────────────
// De kaart raakt vervuild door taken die je al gedaan hebt maar nooit hebt
// afgevinkt, en door taken die eigenlijk een wekelijkse routine zijn. Hier
// zoeken we bewijs in wat je al hebt vastgelegd: afgevinkte weekitems,
// achievements en je herhaaltaken. Het oordeel blijft aan de gebruiker —
// deze module wijst alleen aan wat verdacht is en waaróm.

import type { Task, WeekItem, Achievement, RecurringTask } from '@/lib/types'

const STOPWOORDEN = new Set([
  'de','het','een','van','voor','met','en','in','op','naar','aan','bij','te','ik','mijn',
  'dan','of','die','dat','is','om','ook','nog','deze','dit','wat','als','maar','al','er',
])

/** Kleine letters, zonder emoji en leestekens — om teksten te kunnen vergelijken. */
export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** Inhoudswoorden van een tekst: korte en veelvoorkomende woorden vallen weg. */
export function keywords(s: string): string[] {
  return normalizeText(s).split(' ').filter(w => w.length > 2 && !STOPWOORDEN.has(w))
}

/**
 * Hoeveel van de kleinste woordenset komt in de andere voor (0–1).
 * Bewust asymmetrie-vrij: "Schuur opruimen" en "Schuur opruimen — alles een
 * vaste plek geven" horen bij elkaar, ook al is de tweede veel langer.
 */
export function similarity(a: string, b: string): number {
  const A = new Set(keywords(a)), B = new Set(keywords(b))
  if (A.size === 0 || B.size === 0) return 0
  let hit = 0
  for (const w of A) if (B.has(w)) hit++
  return hit / Math.min(A.size, B.size)
}

export type Verdict = 'klaar' | 'mogelijk-klaar' | 'herhaling' | 'oud'

export interface Finding {
  task: Task
  verdict: Verdict
  /** Korte uitleg in gewone taal, met het bewijs erin. */
  reason: string
  /** Hoe zeker: 1 = hard bewijs, lager = een vermoeden. Voor de sortering. */
  confidence: number
}

/** Woorden die verraden dat een taak eigenlijk een terugkerende routine is. */
const RITME_WOORDEN = /\b(dagelijkse?|wekelijkse?|maandelijkse?|elke dag|iedere dag|elke week|per week|\d+x (?:per week|deze week))\b/i

export interface FreshnessInput {
  tasks: Task[]
  weekItems: WeekItem[]
  achievements: Achievement[]
  recurringTasks: RecurringTask[]
  /** Referentiemoment; los meegegeven zodat dit te testen is. */
  now: Date
  /** Vanaf hoeveel dagen zonder beweging een taak 'oud' heet. */
  staleDays?: number
}

/**
 * Bewijs dat een open taak al afgerond is: een afgevinkt weekitem dat naar deze
 * taak verwijst of exact zo heet. Dat is hard bewijs — dit heb jij zelf
 * afgevinkt, alleen niet op de taak zelf.
 */
export function completedEvidence(task: Task, weekItems: WeekItem[]): WeekItem | null {
  const naam = normalizeText(task.name)
  const done = weekItems.filter(w => w.done)
  return done.find(w => w.task_id === String(task.id))
      ?? done.find(w => normalizeText(w.text) === naam)
      ?? null
}

/** Een achievement dat sterk op de taak lijkt: aanwijzing, geen bewijs. */
export function achievementHint(task: Task, achievements: Achievement[], min = 0.75): Achievement | null {
  let best: Achievement | null = null, score = 0
  for (const a of achievements) {
    const s = similarity(task.name, a.text)
    if (s > score) { score = s; best = a }
  }
  return score >= min ? best : null
}

/** Hoort deze taak eigenlijk bij je vaste ritme in plaats van in de takenlijst? */
export function recurringHint(task: Task, recurringTasks: RecurringTask[]): RecurringTask | true | null {
  const match = recurringTasks.find(r => similarity(task.name, r.name) >= 0.8)
  if (match) return match
  return RITME_WOORDEN.test(task.name) ? true : null
}

/** Dagen sinds de taak voor het laatst bewogen is. */
export function daysSinceTouched(task: Task, now: Date): number {
  const stamp = task.updated_at || task.created_at
  const t = Date.parse(stamp)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((now.getTime() - t) / 86400000))
}

/**
 * Alle open taken die opvallen, met de reden erbij en het hardste bewijs
 * bovenaan. Taken die al 'done' staan blijven buiten beschouwing.
 */
export function reviewTasks(input: FreshnessInput): Finding[] {
  const { tasks, weekItems, achievements, recurringTasks, now, staleDays = 30 } = input
  const out: Finding[] = []

  for (const task of tasks) {
    if (task.status === 'done') continue

    const week = completedEvidence(task, weekItems)
    if (week) {
      out.push({ task, verdict: 'klaar', confidence: 1,
        reason: `Op ${kortDatum(week.date)} afgevinkt in je weekplanning, maar de taak staat nog open.` })
      continue
    }

    const ach = achievementHint(task, achievements)
    if (ach) {
      out.push({ task, verdict: 'mogelijk-klaar', confidence: 0.7,
        reason: `Lijkt op een win die je opschreef: "${kort(ach.text)}" (${kortDatum(ach.date)}).` })
      continue
    }

    const recur = recurringHint(task, recurringTasks)
    if (recur) {
      out.push({ task, verdict: 'herhaling', confidence: 0.5,
        reason: recur === true
          ? 'Klinkt als een vast ritme — dat hoort bij je herhaaltaken, niet als losse taak.'
          : `Staat al als herhaaltaak in je week-ritme ("${recur.name}").` })
      continue
    }

    const dagen = daysSinceTouched(task, now)
    if (dagen >= staleDays && !(task.actual_min ?? 0)) {
      out.push({ task, verdict: 'oud', confidence: 0.2,
        reason: `${dagen} dagen niets mee gedaan en nooit tijd op geschreven.` })
    }
  }

  // Hardste bewijs eerst; binnen dezelfde soort de langst stilstaande taak eerst
  return out.sort((a, b) =>
    b.confidence - a.confidence ||
    daysSinceTouched(b.task, now) - daysSinceTouched(a.task, now) ||
    a.task.id - b.task.id)
}

/** Taken die zéker klaar zijn — die hoeven niet meer op de kaart te staan. */
export function certainlyDoneIds(tasks: Task[], weekItems: WeekItem[]): Set<number> {
  const ids = new Set<number>()
  for (const t of tasks) if (t.status !== 'done' && completedEvidence(t, weekItems)) ids.add(t.id)
  return ids
}

export const VERDICT_META: Record<Verdict, { label: string; color: string; hint: string }> = {
  'klaar':          { label: 'Klaar volgens je week', color: '#3fb950', hint: 'Afgevinkt in de weekplanning' },
  'mogelijk-klaar': { label: 'Mogelijk klaar',        color: '#d29922', hint: 'Lijkt op een opgeschreven win' },
  'herhaling':      { label: 'Hoort bij je ritme',    color: '#58a6ff', hint: 'Dit is een herhaaltaak' },
  'oud':            { label: 'Lang stil',             color: '#8b949e', hint: 'Al lang niets mee gedaan' },
}

function kort(s: string, n = 60) { return s.length > n ? s.slice(0, n) + '…' : s }

/** Datums komen als ISO-tekst; iets anders laten we staan zoals het is. */
function kortDatum(d: string) { return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : d }

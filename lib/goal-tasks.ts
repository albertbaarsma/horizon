// ─── Welke taken horen bij dit doel? ──────────────────────────────────────────
// Er staat geen harde koppeling tussen een doel en zijn taken in de database, en
// dat is ook lastig: taken ontstaan losjes uit een doel. Daarom leiden we het af
// uit drie signalen, van sterk naar zwak:
//
//   1. de taak hangt aan een project in hetzelfde levensgebied als het doel
//   2. de naam lijkt op de doeltekst (minstens twee gedeelde woorden)
//   3. de taak is losgelaten in de inbox met woorden uit het doel
//
// Het blijft een vermoeden. Daarom vraagt de app het bij het weggooien van een
// doel, in plaats van zelf taken op te ruimen.

import type { Goal, Task, Project } from '@/lib/types'
import { keywords, similarity, normalizeText } from '@/lib/task-freshness'

export interface LinkedTask {
  task: Task
  /** 1 = sterk vermoeden, lager = zwakker. Voor de sortering. */
  score: number
  /** Waarom deze taak hierbij hoort, in gewone taal. */
  reason: string
}

const MIN_SHARED = 2

function shared(a: string, b: string): string[] {
  const B = new Set(keywords(b))
  return [...new Set(keywords(a))].filter(w => B.has(w))
}

/**
 * Taken die bij dit doel lijken te horen. Alleen open taken — afgeronde taken
 * hoef je niet meer te beslissen. Sterkste vermoeden bovenaan.
 */
export function tasksForGoal(goal: Goal, tasks: Task[], projects: Project[]): LinkedTask[] {
  const doelWoorden = keywords(goal.text)
  const out: LinkedTask[] = []

  for (const task of tasks) {
    if (task.status === 'done' || task.deleted_at) continue

    const proj = task.proj_id ? projects.find(p => p.id === task.proj_id) : undefined
    const zelfdeGebied = !!goal.cat_id && !!proj && proj.cat_id === goal.cat_id
    const gedeeld = shared(task.name, goal.text)
    const lijkt = gedeeld.length >= MIN_SHARED || normalizeText(task.name) === normalizeText(goal.text)

    if (lijkt && zelfdeGebied) {
      out.push({ task, score: 1, reason: `Zelfde levensgebied en de naam lijkt erop (${gedeeld.join(', ')}).` })
    } else if (lijkt) {
      const s = similarity(task.name, goal.text)
      out.push({ task, score: 0.6 + Math.min(s, 1) * 0.2, reason: `De naam lijkt op het doel (${gedeeld.join(', ')}).` })
    } else if (zelfdeGebied && doelWoorden.length > 0 && gedeeld.length === 1) {
      out.push({ task, score: 0.35, reason: `Hangt in hetzelfde levensgebied en deelt "${gedeeld[0]}".` })
    }
  }

  return out.sort((a, b) => b.score - a.score || a.task.id - b.task.id)
}

/** Zijn er taken waar je iets over moet beslissen voordat dit doel weggaat? */
export function hasLinkedTasks(goal: Goal, tasks: Task[], projects: Project[]): boolean {
  return tasksForGoal(goal, tasks, projects).length > 0
}

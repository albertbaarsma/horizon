import type { WeekItem } from './types'

// Een taak die in de week staat is "ingepland": hij hoort dan op die dag, niet
// meer in de backlog. We leiden dat af uit de weekplanning zelf (week_items.
// task_id) in plaats van de taak te wijzigen. Haal je het item uit de week,
// vink je het af, of is de dag voorbij, dan telt de taak niet meer als ingepland.

/** Per taak-id de eerstvolgende dag (vandaag of later) waarop hij open in de week staat. */
export function plannedTaskDates(weekItems: WeekItem[], today: string): Map<number, string> {
  const map = new Map<number, string>()
  for (const w of weekItems) {
    if (!w.task_id || w.done || w.date < today) continue
    const id = Number(w.task_id)
    if (!Number.isFinite(id)) continue
    const bestaand = map.get(id)
    if (!bestaand || w.date < bestaand) map.set(id, w.date)
  }
  return map
}

const DAG_KORT   = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const MAAND_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/** Korte weergave van een ingeplande dag, bv. "di 15 sep". */
export function formatPlannedDate(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return `${DAG_KORT[d.getDay()]} ${d.getDate()} ${MAAND_KORT[d.getMonth()]}`
}

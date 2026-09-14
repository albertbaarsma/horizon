// ─── Alles wat nog niet SMART is, op één plek ────────────────────────────────
// Doelen en projecten die om uitwerking vragen, samengevoegd tot één lijst die
// je kunt aan- en uitvinken, met één "copy prompt"-knop die een prompt maakt
// voor precies wat je hebt aangevinkt.

import type { Goal, Project, Task } from '@/lib/types'
import { beoordeelUitwerking, projectContext, rpmInstructies, projectenDieOmUitwerkingVragen } from '@/lib/project-depth'
import { beoordeelGoalUitwerking, goalContext, goalsDieOmUitwerkingVragen } from '@/lib/goal-depth'

export interface NietSmartItem {
  /** Stabiele id voor React-keys, aan/uit-vinken en de wegklikbare melding — 'g-1', 'p-tuinproject'. */
  id: string
  kind: 'goal' | 'project'
  naam: string
  ontbreekt: string[]
  goal?: Goal
  project?: Project
}

/** Alle doelen en projecten die om uitwerking vragen, als één gecombineerde lijst. */
export function verzamelNietSmart(goals: Goal[], projects: Project[], tasks: Task[]): NietSmartItem[] {
  const doelen = goalsDieOmUitwerkingVragen(goals).map((g): NietSmartItem => ({
    id: `g-${g.id}`, kind: 'goal', naam: g.text,
    ontbreekt: beoordeelGoalUitwerking(g).ontbreekt, goal: g,
  }))
  const projecten = projectenDieOmUitwerkingVragen(projects, tasks).map((p): NietSmartItem => ({
    id: `p-${p.id}`, kind: 'project', naam: p.name,
    ontbreekt: beoordeelUitwerking(p, tasks, projects).ontbreekt, project: p,
  }))
  return [...doelen, ...projecten]
}

/**
 * Eén prompt voor meerdere doelen/projecten tegelijk. De RPM-vragen staan er
 * één keer bovenaan; daaronder per item wat al bekend is en wat ontbreekt.
 * Dezelfde regel als overal: gebruik wat er al is, vraag door op de rest,
 * maak niets aan zonder eerst te laten zien wat het voorstel is.
 */
export function combinedUitwerkPrompt(items: NietSmartItem[], tasks: Task[]): string {
  const secties = items.map((item, i) => {
    const context = item.kind === 'goal' ? goalContext(item.goal!) : projectContext(item.project!, tasks)
    const soort = item.kind === 'goal' ? 'Doel' : 'Project'
    return [
      `## ${i + 1}. ${soort}: "${item.naam}"`,
      context && `Al vastgelegd:\n${context}`,
      item.ontbreekt.length && `Ontbreekt nog: ${item.ontbreekt.join(', ')}.`,
    ].filter(Boolean).join('\n')
  })

  return [
    `Help me ${items.length} ${items.length === 1 ? 'doel/project' : 'doelen en projecten'} uitwerken volgens de RPM-methode.`,
    rpmInstructies(),
    'Gebruik voor elk item wat ik al vastgelegd heb — vraag alleen door op wat er echt nog ontbreekt, en doe dat per item apart zodat het overzichtelijk blijft.',
    secties.join('\n\n'),
    'Kom per item met een voorstel: Result, Why, en de RPM-blokken (sub-resultaat + taken) eronder. Maak nog niets aan in de app — laat me eerst kiezen wat ervan klopt.',
  ].filter(Boolean).join('\n\n')
}

// ─── Is dit doel eigenlijk SMART? ──────────────────────────────────────────────
// Een doel zonder duidelijk resultaat is geen doel maar een wens. RPM vraagt om
// een Result (wat wil ik precies) en een Why (waarom telt dit) — samen maken ze
// een doel SMART: specifiek en betekenisvol in plaats van vaag.
//
// Net als bij projecten (lib/project-depth.ts) is dit een aanbod, geen por: een
// hobbydoel ("Zelda uitspelen") hoeft geen Result-veld te hebben, en een
// afgerond doel heeft niets meer te winnen bij deze vraag.

import type { Goal } from '@/lib/types'

export interface GoalUitwerking {
  /** Wat er ontbreekt, in gewone taal. Leeg = niets aan de hand. */
  ontbreekt: string[]
  /** Draagt dit doel genoeg gewicht om er iets van te zeggen? */
  draagtGewicht: boolean
  /** Alleen dan bieden we het aan — getriggerd op het ontbreken van een Result. */
  vraagtErom: boolean
}

export function beoordeelGoalUitwerking(goal: Pick<Goal, 'done' | 'kind' | 'result' | 'why'>): GoalUitwerking {
  const heeftResult = !!(goal.result ?? '').trim()
  const heeftWhy    = !!(goal.why ?? '').trim()

  const ontbreekt: string[] = []
  if (!heeftResult) ontbreekt.push('een duidelijk result')
  if (!heeftWhy)    ontbreekt.push('een why')

  // Hobbydoelen zijn er voor de lol — die hoeven niet SMART te zijn.
  const draagtGewicht = !goal.done && goal.kind !== 'hobby'

  // Het ontbrekende Result is de kern van de vraag; Why komt er dan gratis bij.
  return { ontbreekt, draagtGewicht, vraagtErom: draagtGewicht && !heeftResult }
}

/** De doelen waar een aanbod om uit te werken op zijn plaats is. */
export function goalsDieOmUitwerkingVragen(goals: Goal[]): Goal[] {
  return goals.filter(g => beoordeelGoalUitwerking(g).vraagtErom)
}

/** Wat er al over dit doel bekend is — zodat de AI dat gebruikt in plaats van
 *  ernaar te vragen. Leeg veld = weggelaten. */
export function goalContext(goal: Pick<Goal, 'result' | 'why' | 'notes'>): string {
  const regels: string[] = []
  if ((goal.result ?? '').trim()) regels.push(`- Result tot nu toe: ${goal.result!.trim()}`)
  if ((goal.why ?? '').trim())    regels.push(`- Why tot nu toe: ${goal.why!.trim()}`)
  if ((goal.notes ?? '').trim())  regels.push(`- Notities: ${goal.notes!.trim()}`)
  return regels.join('\n')
}

/**
 * De vraag die naar de AI gaat. Gebruikt wat er al bekend is; vraagt alleen
 * door op wat er nog ontbreekt. Geen doel-velden zomaar invullen: eerst
 * doorvragen, dan pas een voorstel — Jordan beslist zelf wat ervan blijft staan.
 */
export function goalUitwerkPrompt(goal: Pick<Goal, 'text' | 'result' | 'why' | 'notes'>, uitwerking: GoalUitwerking): string {
  const context = goalContext(goal)
  return [
    `Help me het doel "${goal.text}" SMART te maken.`,
    context && `Wat ik al vastgelegd heb:\n${context}`,
    uitwerking.ontbreekt.length && `Wat er nu nog ontbreekt: ${uitwerking.ontbreekt.join(' en ')}.`,
    'Gebruik wat ik al vastgelegd heb. Vraag me alleen door op wat er echt nog ontbreekt: wat is precies het resultaat dat ik wil (specifiek en tastbaar), en waarom telt dat voor mij?',
    'Is dit doel eigenlijk te groot voor één ding? Stel dan gerust voor het op te hakken in sub-doelen.',
    'Kom daarna met een voorstel voor het Result- en Why-veld. Vul nog niets in — laat me eerst kiezen wat ervan klopt.',
  ].filter(Boolean).join('\n\n')
}

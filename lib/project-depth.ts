// ─── Vraagt dit project om uitwerking? ────────────────────────────────────────
// Niet elk project hoeft uitgewerkt te worden. "4x per week sporten" is af zoals
// het is: één regel, klaar. Maar "de schuur verbouwen" valt zonder deelstappen
// uit elkaar, en dan blijft het maanden op je lijst staan zonder te bewegen.
//
// Daarom kijken we niet naar "is dit dun?" maar naar "is dit dun terwijl het
// gewicht draagt?" — een project dat je zelf prioriteit hebt gegeven of dat als
// urgent staat, en waar verder niets onder hangt. Alleen dan is een aanbod om
// het uit te werken behulpzaam in plaats van een por.
//
// De prompt zelf volgt Jordans eigen RPM-aantekeningen (Tony Robbins' Rapid
// Planning Method): eerst het resultaat en de purpose scherp krijgen, dan
// chunken in sub-resultaten, en elk sub-resultaat wordt een RPM-blok — een
// klein resultaat met de taken die eronder liggen.

import type { Project, Task } from '@/lib/types'

export interface Uitwerking {
  /** Wat er ontbreekt, in gewone taal. Leeg = niets aan de hand. */
  ontbreekt: string[]
  /** Draagt dit project genoeg gewicht om er iets van te zeggen? */
  draagtGewicht: boolean
  /** Alleen dan bieden we het aan. */
  vraagtErom: boolean
}

/** Statussen waarbij een project echt meedoet in je week. */
const ACTIEF = ['actief', 'lopend', 'urgent', 'soon']

/** Een omschrijving van drie woorden is nog geen omschrijving. */
const MIN_OMSCHRIJVING = 25

export function beoordeelUitwerking(
  project: Project,
  tasks: Task[],
  alleProjecten: Project[] = [],
): Uitwerking {
  const subs      = alleProjecten.filter(p => p.parent_id === project.id)
  const subIds    = new Set(subs.map(s => s.id))
  const eigenTaken = tasks.filter(t =>
    !t.deleted_at && (t.proj_id === project.id || (t.proj_id && subIds.has(t.proj_id))))
  const openTaken = eigenTaken.filter(t => t.status !== 'done')

  const ontbreekt: string[] = []
  if ((project.description ?? '').trim().length < MIN_OMSCHRIJVING) ontbreekt.push('een omschrijving van wat het inhoudt')
  if (!(project.vision ?? '').trim())                              ontbreekt.push('een beeld van hoe het eruitziet als het af is')
  if (openTaken.length === 0)                                      ontbreekt.push('een eerste stap om mee te beginnen')
  if (subs.length === 0 && eigenTaken.length > 8)                  ontbreekt.push('deelprojecten om het behapbaar te maken')

  // Gewicht: je hebt het zelf als prioriteit gemarkeerd, of het staat urgent.
  // Een slapend project of een routine laten we met rust.
  const draagtGewicht =
    project.proj_type === 'project' &&
    ACTIEF.includes(project.status) &&
    (project.is_priority || project.status === 'urgent')

  // Eén ontbrekend ding is geen probleem — dan is het gewoon kort opgeschreven.
  return { ontbreekt, draagtGewicht, vraagtErom: draagtGewicht && ontbreekt.length >= 2 }
}

/** De projecten waar een aanbod om uit te werken op zijn plaats is. */
export function projectenDieOmUitwerkingVragen(projecten: Project[], tasks: Task[]): Project[] {
  return projecten.filter(p => beoordeelUitwerking(p, tasks, projecten).vraagtErom)
}

/** Wat er al over dit project bekend is, in leesbare vorm — zodat de AI dat
 *  gebruikt in plaats van ernaar te vragen. Leeg veld = weggelaten, geen "niet
 *  ingevuld"-ruis. */
export function projectContext(project: Project, tasks: Task[]): string {
  const open = tasks.filter(t => t.proj_id === project.id && !t.deleted_at && t.status !== 'done')
  const regels: string[] = []
  if ((project.description ?? '').trim()) regels.push(`- Doel/Purpose: ${project.description!.trim()}`)
  if ((project.vision ?? '').trim())       regels.push(`- Result tot nu toe: ${project.vision!.trim()}`)
  if ((project.notes ?? '').trim())        regels.push(`- Notities: ${project.notes!.trim()}`)
  if (open.length) regels.push(`- Openstaande taken: ${open.map(t => t.name).join(', ')}`)
  return regels.join('\n')
}

/**
 * De RPM-vragen zelf, zonder project-specifieke context — het herbruikbare
 * hart van de prompt. Zowel de losse als de gebundelde prompt gebruiken dit.
 */
export function rpmInstructies(): string {
  return [
    'Loop de RPM-methode (Rapid Planning Method) langs:',
    '1. Wat wil ik hiermee — in het algemeen, en wat springt er nu het meest uit?',
    '2. Wat is het specifieke Result? Tastbaar en concreet — zonder dat raak je afgeleid en verlies je het uit het oog.',
    '3. Wat is de Why — de ultieme purpose? Waarom telt dit, wat voel ik erbij als het af is?',
    '4. Hak het op in sub-resultaten (chunking). Elk sub-resultaat wordt een RPM-blok: een klein resultaat plus de taken die eronder liggen.',
    '5. Capture: vang alvast alle taken die je nu al kan bedenken, ook rommelig, ook onvolledig.',
  ].join('\n')
}

/**
 * De vraag die naar de AI gaat. Gebruikt wat er al bekend is; vraagt alleen
 * door op wat er nog ontbreekt. Geen "maak taken aan": eerst denken, dan pas
 * doen — Jordan beslist zelf wat ervan in de app belandt.
 */
export function uitwerkPrompt(project: Project, uitwerking: Uitwerking, tasks: Task[] = []): string {
  const context = projectContext(project, tasks)
  return [
    `Help me het project "${project.name}" uitwerken volgens de RPM-methode.`,
    context && `Wat ik al vastgelegd heb:\n${context}`,
    uitwerking.ontbreekt.length && `Wat er nu nog ontbreekt: ${uitwerking.ontbreekt.join(', ')}.`,
    rpmInstructies(),
    'Gebruik wat ik al vastgelegd heb — vraag alleen door op wat er echt nog ontbreekt, verzin niets zelf bij.',
    'Kom aan het eind met een voorstel: het Result, de Why, en de RPM-blokken (sub-resultaat + taken) die eronder liggen. Maak nog niets aan in de app — laat me eerst kiezen wat ervan klopt.',
  ].filter(Boolean).join('\n\n')
}

// ─── Een project weggooien ────────────────────────────────────────────────────
// Aan een project hangen taken, week-items en soms sub-projecten. Verdwijnt het
// project zonder die eerst los te maken, dan blijven ze achter met een verwijzing
// naar iets dat niet meer bestaat:
//
//   • taken en week-items zouden hun project kwijt zijn maar er nog naar wijzen;
//   • sub-projecten zouden ONZICHTBAAR worden — de projectenlijst toont alleen
//     projecten zonder parent_id als eigen kaart, en de rest onder hun ouder.
//     Is die ouder weg, dan staat een sub-project nergens meer.
//
// Daarom loopt elk verwijderen via deze functie, en niet via een losse
// supabase-aanroep per scherm.
//
// LET OP: projecten hebben (nog) geen prullenbak, anders dan doelen en taken.
// Dit is een echte, definitieve delete. Vraag het de gebruiker altijd eerst.

import type { Project } from '@/lib/types'
import type { createClient } from '@/lib/supabase'

type Supabase = ReturnType<typeof createClient>

export interface VerwijderResultaat {
  ok: boolean
  /** Sub-projecten die zelfstandig verdergaan in plaats van mee te verdwijnen. */
  losgemaakt: number
  error?: string
}

/** Wat er gebeurt als je dit project weggooit — voor de bevestigingsvraag. */
export function verwijderGevolgen(project: Pick<Project, 'id'>, allProjects: Project[], taken: { proj_id: string | null }[]) {
  return {
    subProjecten: allProjects.filter(p => p.parent_id === project.id).length,
    taken: taken.filter(t => t.proj_id === project.id).length,
  }
}

/**
 * Gooit het project weg en laat niets achter dat naar hem wijst.
 * Sub-projecten blijven bestaan: ze worden losgemaakt en gaan zelfstandig verder.
 * Taken en week-items belanden in de inbox.
 */
export async function deleteProjectEverywhere(
  supabase: Supabase,
  project: Pick<Project, 'id' | 'user_id'>,
  allProjects: Project[] = [],
): Promise<VerwijderResultaat> {
  const subs = allProjects.filter(p => p.parent_id === project.id)

  // Eerst losmaken, dan pas weggooien — andersom zijn de subs even onvindbaar
  for (const sub of subs) {
    const { error } = await supabase.from('projects')
      .update({ parent_id: null, updated_at: new Date().toISOString() })
      .eq('id', sub.id).eq('user_id', project.user_id)
    if (error) return { ok: false, losgemaakt: 0, error: error.message }
  }

  const losTaken = await supabase.from('tasks')
    .update({ proj_id: null }).eq('proj_id', project.id).eq('user_id', project.user_id)
  if (losTaken.error) return { ok: false, losgemaakt: subs.length, error: losTaken.error.message }

  const losWeek = await supabase.from('week_items')
    .update({ proj_id: null }).eq('proj_id', project.id).eq('user_id', project.user_id)
  if (losWeek.error) return { ok: false, losgemaakt: subs.length, error: losWeek.error.message }

  const { error } = await supabase.from('projects')
    .delete().eq('id', project.id).eq('user_id', project.user_id)
  if (error) return { ok: false, losgemaakt: subs.length, error: error.message }

  return { ok: true, losgemaakt: subs.length }
}

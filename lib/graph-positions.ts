// ─── Waar staat wat in de 3D-weergave ─────────────────────────────────────────
// De indeling zelf wordt berekend (layout3D in graph-layout.ts) en is altijd
// hetzelfde. Hier zit alleen wat jij daarna hebt aangepast: een knoop die je
// hebt versleept, of een tak die je hebt dichtgeklapt.
//
// Zo blijft de bol herkenbaar zonder dat we voor elke taak een rij hoeven te
// bewaren, en is "terug naar zijn plek" gewoon: rij weg.

import type { createClient } from '@/lib/supabase'
import type { Placed3D } from '@/lib/graph-layout'

type Supabase = ReturnType<typeof createClient>

export interface KnoopStand {
  x?: number | null
  y?: number | null
  z?: number | null
  collapsed?: boolean
}

/** Alles wat de gebruiker zelf heeft aangepast, per knoop-id. */
export type Stand = Record<string, KnoopStand>

interface Rij { node_id: string; x: number | null; y: number | null; z: number | null; collapsed: boolean }

export function standUitRijen(rijen: Rij[]): Stand {
  const uit: Stand = {}
  for (const r of rijen) uit[r.node_id] = { x: r.x, y: r.y, z: r.z, collapsed: r.collapsed }
  return uit
}

export async function loadStand(supabase: Supabase, userId: string): Promise<Stand> {
  const { data } = await supabase.from('graph_layout')
    .select('node_id,x,y,z,collapsed').eq('user_id', userId)
  return standUitRijen((data ?? []) as Rij[])
}

/** Een verplaatste knoop of een dichtgeklapte tak vastleggen. */
export async function saveKnoop(supabase: Supabase, userId: string, nodeId: string, patch: KnoopStand): Promise<boolean> {
  const { error } = await supabase.from('graph_layout')
    .upsert({ user_id: userId, node_id: nodeId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,node_id' })
  return !error
}

/** Een hele tak in één keer vastleggen — sleep je een knoop, dan gaat alles mee. */
export async function saveKnopen(supabase: Supabase, userId: string, knopen: (KnoopStand & { node_id: string })[]): Promise<boolean> {
  if (knopen.length === 0) return true
  const nu = new Date().toISOString()
  const { error } = await supabase.from('graph_layout')
    .upsert(knopen.map(k => ({ user_id: userId, ...k, updated_at: nu })), { onConflict: 'user_id,node_id' })
  return !error
}

/** Deze knoop terug naar zijn berekende plek. */
export async function wisKnoop(supabase: Supabase, userId: string, nodeId: string): Promise<boolean> {
  const { error } = await supabase.from('graph_layout')
    .delete().eq('user_id', userId).eq('node_id', nodeId)
  return !error
}

/** Alles terug naar de berekende indeling. */
export async function wisAlles(supabase: Supabase, userId: string): Promise<boolean> {
  const { error } = await supabase.from('graph_layout').delete().eq('user_id', userId)
  return !error
}

/**
 * De berekende indeling met jouw aanpassingen eroverheen. Een knoop die je niet
 * hebt aangeraakt houdt zijn berekende plek — die blijft dus ook meebewegen als
 * de boom verandert.
 */
export function pasStandToe(knopen: Placed3D[], stand: Stand): Placed3D[] {
  return knopen.map(n => {
    const s = stand[n.id]
    if (!s || s.x == null || s.y == null || s.z == null) return n
    return { ...n, x: s.x, y: s.y, z: s.z }
  })
}

/** Welke takken staan dicht? */
export function dichteKnopen(stand: Stand): Set<string> {
  return new Set(Object.entries(stand).filter(([, s]) => s.collapsed).map(([id]) => id))
}

/** Staat deze knoop op een zelfgekozen plek, of nog op zijn berekende plek? */
export function isVerplaatst(stand: Stand, nodeId: string): boolean {
  const s = stand[nodeId]
  return !!s && s.x != null && s.y != null && s.z != null
}

/** Hoeveel knopen heb je zelf verplaatst? Voor de "herstel indeling"-knop. */
export function aantalVerplaatst(stand: Stand): number {
  return Object.keys(stand).filter(id => isVerplaatst(stand, id)).length
}

import { describe, it, expect } from 'vitest'
import { deleteProjectEverywhere, verwijderGevolgen } from '@/lib/project-delete'
import type { Project } from '@/lib/types'

function proj(id: string, extra: Partial<Project> = {}): Project {
  return {
    id, user_id: 'u', cat_id: 'werk', name: `project ${id}`, emoji: '📌',
    status: 'actief', description: '', vision: '', proj_type: 'project',
    notes: null, html_content: null, is_priority: false, sort_order: 0,
    created_at: '', updated_at: '', ...extra,
  }
}

// ── Nep-Supabase die onthoudt wat er gebeurd is ─────────────────────────────

function fakeSupabase(faalOp?: { table: string; op: string }) {
  const log: { table: string; op: string; payload?: unknown; filters: Record<string, unknown> }[] = []

  function chain(table: string, op: string, payload?: unknown) {
    const entry = { table, op, payload, filters: {} as Record<string, unknown> }
    log.push(entry)
    const faalt = faalOp && faalOp.table === table && faalOp.op === op
    const api: any = {
      eq: (k: string, v: unknown) => { entry.filters[k] = v; return api },
      then: (res: (v: unknown) => unknown) =>
        Promise.resolve({ error: faalt ? { message: 'kapot' } : null }).then(res),
    }
    return api
  }

  return {
    log,
    client: {
      from: (table: string) => ({
        update: (payload: unknown) => chain(table, 'update', payload),
        delete: () => chain(table, 'delete'),
      }),
    } as never,
  }
}

const stappen = (log: ReturnType<typeof fakeSupabase>['log']) => log.map(e => `${e.table}.${e.op}`)

describe('deleteProjectEverywhere', () => {
  it('koppelt taken en week-items los en verwijdert dan pas het project', async () => {
    const s = fakeSupabase()
    const p = proj('tuinproject')

    const res = await deleteProjectEverywhere(s.client, p, [p])

    expect(res).toEqual({ ok: true, losgemaakt: 0 })
    expect(stappen(s.log)).toEqual(['tasks.update', 'week_items.update', 'projects.delete'])
    expect(s.log[0].payload).toEqual({ proj_id: null })
    expect(s.log[1].payload).toEqual({ proj_id: null })
  })

  it('filtert overal op de eigenaar, niet alleen op id', async () => {
    const s = fakeSupabase()
    const p = proj('tuinproject')
    await deleteProjectEverywhere(s.client, p, [p])
    for (const e of s.log) expect(e.filters.user_id, `${e.table}.${e.op}`).toBe('u')
  })

  // Zonder losmaken zou een sub-project uit beeld verdwijnen: de projectenlijst
  // toont alleen projecten zonder parent_id, en de rest onder hun ouder — die er
  // dan niet meer is.
  it('maakt sub-projecten los vóór het verwijderen, zodat ze zichtbaar blijven', async () => {
    const s = fakeSupabase()
    const ouder = proj('boerderij')
    const alle = [ouder, proj('dak', { parent_id: 'boerderij' }), proj('schuur', { parent_id: 'boerderij' })]

    const res = await deleteProjectEverywhere(s.client, ouder, alle)

    expect(res).toEqual({ ok: true, losgemaakt: 2 })
    expect(stappen(s.log)).toEqual([
      'projects.update', 'projects.update',        // eerst de subs losmaken
      'tasks.update', 'week_items.update',
      'projects.delete',                            // en pas dan weg
    ])
    expect(s.log[0].payload).toMatchObject({ parent_id: null })
    expect(s.log.slice(0, 2).map(e => e.filters.id)).toEqual(['dak', 'schuur'])
  })

  it('raakt sub-projecten van een ánder project niet aan', async () => {
    const s = fakeSupabase()
    const doel = proj('boerderij')
    const alle = [doel, proj('gitaar', { parent_id: 'muziek' }), proj('muziek')]

    const res = await deleteProjectEverywhere(s.client, doel, alle)

    expect(res.losgemaakt).toBe(0)
    expect(stappen(s.log)).not.toContain('projects.update')
  })

  it('stopt en meldt het als het losmaken mislukt — dan gaat er niets weg', async () => {
    const s = fakeSupabase({ table: 'projects', op: 'update' })
    const ouder = proj('boerderij')

    const res = await deleteProjectEverywhere(s.client, ouder, [ouder, proj('dak', { parent_id: 'boerderij' })])

    expect(res.ok).toBe(false)
    expect(res.error).toBe('kapot')
    expect(stappen(s.log)).not.toContain('projects.delete')
  })

  it('meldt een mislukte delete in plaats van stilletjes te slagen', async () => {
    const s = fakeSupabase({ table: 'projects', op: 'delete' })
    const p = proj('tuinproject')
    const res = await deleteProjectEverywhere(s.client, p, [p])
    expect(res.ok).toBe(false)
    expect(res.error).toBe('kapot')
  })
})

describe('verwijderGevolgen', () => {
  it('telt wat er aan het project hangt', () => {
    const p = proj('boerderij')
    const alle = [p, proj('dak', { parent_id: 'boerderij' })]
    const taken = [{ proj_id: 'boerderij' }, { proj_id: 'boerderij' }, { proj_id: 'muziek' }, { proj_id: null }]
    expect(verwijderGevolgen(p, alle, taken)).toEqual({ subProjecten: 1, taken: 2 })
  })

  it('is nul als er niets aan hangt', () => {
    const p = proj('los')
    expect(verwijderGevolgen(p, [p], [])).toEqual({ subProjecten: 0, taken: 0 })
  })
})

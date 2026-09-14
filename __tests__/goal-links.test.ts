import { describe, it, expect, vi } from 'vitest'
import {
  activeGoals, trashedGoals, isGoalAchievement, goalXpReason, GOAL_XP,
  trashGoalEverywhere, restoreGoalEverywhere, relatedProjectsFor, groepeerMetSubdoelen,
} from '@/lib/goal-links'
import { goalAchievementText } from '@/lib/goal-achievement'
import type { Goal, Project } from '@/lib/types'

function project(id: string, extra: Partial<Project> = {}): Project {
  return {
    id, user_id: 'u', cat_id: 'werk', name: `project ${id}`, emoji: '📌', status: 'actief',
    description: '', vision: '', proj_type: 'project', notes: null, html_content: null,
    is_priority: false, sort_order: 0, created_at: '', updated_at: '', ...extra,
  }
}

function goal(id: number, extra: Partial<Goal> = {}): Goal {
  return { id, user_id: 'u', horizon: 'kwartaal', text: `doel ${id}`, done: false, cat_id: 'werk', deadline: null, created_at: '', ...extra }
}

// ── Een minimale nep-Supabase die bijhoudt wat er gebeurd is ─────────────────

function fakeSupabase(opts: { updateError?: unknown; bestaandeXp?: boolean } = {}) {
  const log: { table: string; op: string; payload?: unknown; filters: Record<string, unknown> }[] = []

  function chain(table: string, op: string, payload?: unknown) {
    const entry = { table, op, payload, filters: {} as Record<string, unknown> }
    log.push(entry)
    const api: any = {
      eq: (k: string, v: unknown) => { entry.filters[k] = v; return api },
      limit: () => api,
      select: () => {
        if (table === 'achievements' && op === 'delete') return Promise.resolve({ data: [{ id: 7 }] })
        if (table === 'xp_events' && op === 'select') {
          return Promise.resolve({ data: opts.bestaandeXp ? [{ id: 1 }] : [] })
        }
        api.single = () => Promise.resolve({ data: { id: 99, text: payload && (payload as any).text, user_id: 'u' } })
        return api
      },
      single: () => Promise.resolve({ data: { id: 99, ...(payload as object ?? {}) } }),
      then: (res: (v: unknown) => unknown) => Promise.resolve(
        op === 'update' && table === 'goals'
          ? { error: opts.updateError ?? null }
          : { data: opts.bestaandeXp && table === 'xp_events' ? [{ id: 1 }] : [], error: null }
      ).then(res),
    }
    return api
  }

  return {
    log,
    client: {
      from: (table: string) => ({
        update: (payload: unknown) => chain(table, 'update', payload),
        delete: () => chain(table, 'delete'),
        insert: (payload: unknown) => chain(table, 'insert', payload),
        select: (cols?: string) => chain(table, 'select', cols),
      }),
    },
  }
}

const did = (log: ReturnType<typeof fakeSupabase>['log'], table: string, op: string) =>
  log.filter(e => e.table === table && e.op === op)

// ── Filters ───────────────────────────────────────────────────────────────────

describe('activeGoals', () => {
  it('laat weggegooide doelen weg', () => {
    const g = [goal(1), goal(2, { deleted_at: '2026-08-08' }), goal(3)]
    expect(activeGoals(g).map(x => x.id)).toEqual([1, 3])
  })

  it('laat een lijst zonder prullenbak ongemoeid', () => {
    expect(activeGoals([goal(1)])).toHaveLength(1)
  })
})

describe('trashedGoals', () => {
  it('geeft alleen de prullenbak, nieuwste eerst', () => {
    const g = [goal(1, { deleted_at: '2026-08-01' }), goal(2), goal(3, { deleted_at: '2026-08-06' })]
    expect(trashedGoals(g).map(x => x.id)).toEqual([3, 1])
  })
})

describe('goalXpReason', () => {
  it('gebruikt precies de tekst die de database erbij schrijft', () => {
    expect(goalXpReason({ text: '10 optredens' })).toBe('Doel toegevoegd: 10 optredens')
  })
})

describe('isGoalAchievement', () => {
  it('herkent de prestatie die uit dit doel voortkomt', () => {
    const g = goal(1, { horizon: 'kwartaal', text: '10 optredens' })
    expect(isGoalAchievement({ text: goalAchievementText(g) }, g)).toBe(true)
    expect(isGoalAchievement({ text: 'Iets anders' }, g)).toBe(false)
  })
})

// ── Weggooien ─────────────────────────────────────────────────────────────────

describe('trashGoalEverywhere', () => {
  it('zet het doel in de prullenbak in plaats van het echt te wissen', async () => {
    const { client, log } = fakeSupabase()
    const res = await trashGoalEverywhere(client as never, 'u', goal(5), '2026-08-08T10:00:00Z')
    expect(res.ok).toBe(true)
    const upd = did(log, 'goals', 'update')[0]
    expect(upd.payload).toEqual({ deleted_at: '2026-08-08T10:00:00Z' })
    expect(did(log, 'goals', 'delete')).toHaveLength(0)
  })

  it('haalt de XP van het doel weg', async () => {
    const { client, log } = fakeSupabase()
    await trashGoalEverywhere(client as never, 'u', goal(5))
    const del = did(log, 'xp_events', 'delete')[0]
    expect(del).toBeDefined()
    expect(del.filters).toMatchObject({ source: 'goal', ref_id: '5', user_id: 'u' })
  })

  it('haalt ook de prestatie weg die uit een gehaald doel kwam', async () => {
    const { client, log } = fakeSupabase()
    const g = goal(5, { done: true })
    const res = await trashGoalEverywhere(client as never, 'u', g)
    expect(did(log, 'achievements', 'delete')).toHaveLength(1)
    expect(res.ok && res.achievementText).toBe(goalAchievementText(g))
  })

  it('zoekt geen prestatie bij een doel dat nooit gehaald is', async () => {
    const { client, log } = fakeSupabase()
    const res = await trashGoalEverywhere(client as never, 'u', goal(5))
    expect(did(log, 'achievements', 'delete')).toHaveLength(0)
    expect(res.ok && res.achievementText).toBeNull()
  })

  it('raakt niets aan als het wegzetten mislukt', async () => {
    const { client, log } = fakeSupabase({ updateError: { message: 'stuk' } })
    const res = await trashGoalEverywhere(client as never, 'u', goal(5, { done: true }))
    expect(res.ok).toBe(false)
    expect(did(log, 'xp_events', 'delete')).toHaveLength(0)
    expect(did(log, 'achievements', 'delete')).toHaveLength(0)
  })
})

// ── Terughalen ────────────────────────────────────────────────────────────────

describe('restoreGoalEverywhere', () => {
  it('haalt het doel uit de prullenbak', async () => {
    const { client, log } = fakeSupabase()
    const res = await restoreGoalEverywhere(client as never, 'u', goal(5), '2026-08-08')
    expect(res.ok).toBe(true)
    expect(did(log, 'goals', 'update')[0].payload).toEqual({ deleted_at: null })
  })

  it('zet de XP terug', async () => {
    const { client, log } = fakeSupabase()
    await restoreGoalEverywhere(client as never, 'u', goal(5), '2026-08-08')
    const ins = did(log, 'xp_events', 'insert')[0]
    expect(ins.payload).toMatchObject({ amount: GOAL_XP, source: 'goal', ref_id: '5', reason: 'Doel toegevoegd: doel 5' })
  })

  it('zet de XP niet dubbel neer', async () => {
    const { client, log } = fakeSupabase({ bestaandeXp: true })
    await restoreGoalEverywhere(client as never, 'u', goal(5), '2026-08-08')
    expect(did(log, 'xp_events', 'insert')).toHaveLength(0)
  })

  it('zet de prestatie terug bij een gehaald doel', async () => {
    const { client, log } = fakeSupabase()
    await restoreGoalEverywhere(client as never, 'u', goal(5, { done: true }), '2026-08-08')
    expect(did(log, 'achievements', 'insert')).toHaveLength(1)
  })

  it('maakt geen prestatie voor een doel dat niet gehaald is', async () => {
    const { client, log } = fakeSupabase()
    const res = await restoreGoalEverywhere(client as never, 'u', goal(5), '2026-08-08')
    expect(did(log, 'achievements', 'insert')).toHaveLength(0)
    expect(res.ok && res.achievement).toBeNull()
  })

  it('raakt niets aan als het terugzetten mislukt', async () => {
    const { client, log } = fakeSupabase({ updateError: { message: 'stuk' } })
    const res = await restoreGoalEverywhere(client as never, 'u', goal(5, { done: true }), '2026-08-08')
    expect(res.ok).toBe(false)
    expect(did(log, 'xp_events', 'insert')).toHaveLength(0)
    expect(did(log, 'achievements', 'insert')).toHaveLength(0)
  })
})

describe('relatedProjectsFor', () => {
  it('geeft de projecten in hetzelfde levensgebied', () => {
    const g = goal(1, { cat_id: 'muziek' })
    const projecten = [project('a', { cat_id: 'muziek' }), project('b', { cat_id: 'thuis' })]
    expect(relatedProjectsFor(g, projecten).map(p => p.id)).toEqual(['a'])
  })

  it('is leeg zonder levensgebied', () => {
    expect(relatedProjectsFor(goal(1, { cat_id: null }), [project('a')])).toEqual([])
  })

  it('telt een gearchiveerd project niet mee — afgesloten werk', () => {
    const g = goal(1, { cat_id: 'muziek' })
    const projecten = [project('a', { cat_id: 'muziek', status: 'archief' })]
    expect(relatedProjectsFor(g, projecten)).toEqual([])
  })
})

describe('groepeerMetSubdoelen', () => {
  it('zet een hoofddoel gevolgd door zijn sub-doel, met diepte 1', () => {
    const items = [goal(1, { text: 'hoofd' }), goal(2, { text: 'sub', parent_id: 1 })]
    const uit = groepeerMetSubdoelen(items)
    expect(uit.map(x => [x.goal.id, x.diepte])).toEqual([[1, 0], [2, 1]])
  })

  it('laat een doel zonder ouder gewoon op zijn plek staan', () => {
    const items = [goal(1), goal(2)]
    expect(groepeerMetSubdoelen(items).map(x => x.diepte)).toEqual([0, 0])
  })

  // Kern van de functie: alleen nesten binnen de meegegeven lijst — een ouder in
  // een andere horizon-kolom is hier simpelweg niet aanwezig.
  it('nest niet als de ouder niet in dezelfde lijst zit', () => {
    const items = [goal(2, { text: 'sub', parent_id: 99 })]
    expect(groepeerMetSubdoelen(items)).toEqual([{ goal: items[0], diepte: 0 }])
  })

  it('beschermt tegen een doel dat zichzelf als ouder heeft', () => {
    const items = [goal(1, { parent_id: 1 })]
    expect(() => groepeerMetSubdoelen(items)).not.toThrow()
    expect(groepeerMetSubdoelen(items)[0].diepte).toBe(0)
  })

  it('houdt alle sub-doelen van hetzelfde hoofddoel bij elkaar, direct erna', () => {
    const items = [goal(1, { text: 'hoofd' }), goal(3, { text: 'ander' }), goal(2, { text: 'sub', parent_id: 1 })]
    const volgorde = groepeerMetSubdoelen(items).map(x => x.goal.id)
    expect(volgorde).toEqual([1, 2, 3])
  })

  it('verliest geen enkel doel — evenveel eruit als erin', () => {
    const items = [goal(1), goal(2, { parent_id: 1 }), goal(3), goal(4, { parent_id: 3 })]
    expect(groepeerMetSubdoelen(items)).toHaveLength(items.length)
  })
})

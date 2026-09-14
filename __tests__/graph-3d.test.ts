import { describe, it, expect } from 'vitest'
import {
  buildGraph, layout3D, visibleGraph, descendantsOf, parentOf, hiddenCount,
  childrenOf, VISIE_ID, type Graph,
} from '@/lib/graph-layout'
import {
  pasStandToe, dichteKnopen, standUitRijen, isVerplaatst, aantalVerplaatst, type Stand,
} from '@/lib/graph-positions'
import type { Project, Task, Goal } from '@/lib/types'

// ── Bouwstenen ──────────────────────────────────────────────────────────────

const cats = [{ id: 'thuis', name: 'Thuis & Land' }, { id: 'muziek', name: 'Muzikant' }]

function proj(id: string, cat: string, extra: Partial<Project> = {}): Project {
  return {
    id, user_id: 'u', cat_id: cat, name: id, emoji: '📌', status: 'actief',
    description: '', vision: '', proj_type: 'project', notes: null, html_content: null,
    is_priority: false, sort_order: 0, created_at: '', updated_at: '', ...extra,
  }
}

function task(id: number, projId: string | null, extra: Partial<Task> = {}): Task {
  return {
    id, user_id: 'u', proj_id: projId, name: `taak ${id}`, status: 'backlog',
    urgent: false, priority: 0, created_at: '', updated_at: '', ...extra,
  }
}

function goal(id: number, cat: string | null, extra: Partial<Goal> = {}): Goal {
  return {
    id, user_id: 'u', horizon: 'kwartaal', text: `doel ${id}`, done: false,
    cat_id: cat, deadline: null, created_at: '', ...extra,
  }
}

// ── De boom ─────────────────────────────────────────────────────────────────

describe('buildGraph — de keten visie → gebied → doel/project → taak', () => {
  it('laat de oude vorm met rust zonder opties', () => {
    const g = buildGraph(cats, [proj('tuinproject', 'thuis')], [task(1, 'tuinproject')])
    expect(g.nodes.some(n => n.id === VISIE_ID)).toBe(false)
    expect(g.nodes.some(n => n.type === 'goal')).toBe(false)
    expect(parentOf(g.edges, 'c-thuis')).toBeNull()
  })

  it('hangt elk levensgebied aan de visie', () => {
    const g = buildGraph(cats, [], [], { visieWortel: true })
    expect(g.nodes.find(n => n.id === VISIE_ID)?.type).toBe('visie')
    expect(parentOf(g.edges, 'c-thuis')).toBe(VISIE_ID)
    expect(parentOf(g.edges, 'c-muziek')).toBe(VISIE_ID)
  })

  it('hangt een doel aan zijn levensgebied', () => {
    const g = buildGraph(cats, [], [], { visieWortel: true, goals: [goal(7, 'thuis')] })
    expect(parentOf(g.edges, 'g-7')).toBe('c-thuis')
  })

  // Een hobbydoel heeft geen echt levensgebied; het hoort nog steeds ergens bij
  it('hangt een doel zonder gebied rechtstreeks aan de visie', () => {
    const g = buildGraph(cats, [], [], { visieWortel: true, goals: [goal(8, null), goal(9, 'hobby')] })
    expect(parentOf(g.edges, 'g-8')).toBe(VISIE_ID)
    expect(parentOf(g.edges, 'g-9')).toBe(VISIE_ID)
  })

  it('laat weggegooide doelen weg', () => {
    const g = buildGraph(cats, [], [], { visieWortel: true, goals: [goal(1, 'thuis', { deleted_at: '2026-01-01' })] })
    expect(g.nodes.some(n => n.id === 'g-1')).toBe(false)
  })

  it('vormt één doorlopende keten van taak tot visie', () => {
    const g = buildGraph(cats, [proj('tuinproject', 'thuis')], [task(3, 'tuinproject')],
      { visieWortel: true, goals: [goal(1, 'thuis')] })
    const keten: string[] = []
    let id: string | null = 't-3'
    while (id) { keten.push(id); id = parentOf(g.edges, id) }
    expect(keten).toEqual(['t-3', 'p-tuinproject', 'c-thuis', VISIE_ID])
  })

  it('laat ook de inbox niet los zweven', () => {
    const g = buildGraph(cats, [], [task(1, null)], { visieWortel: true })
    expect(parentOf(g.edges, 'c-inbox')).toBe(VISIE_ID)
  })

  it('geeft precies één wortel als de visie meedoet', () => {
    const g = buildGraph(cats, [proj('a', 'thuis'), proj('b', 'muziek')], [task(1, 'a'), task(2, null)],
      { visieWortel: true, goals: [goal(1, 'thuis'), goal(2, null)] })
    expect(g.nodes.filter(n => !parentOf(g.edges, n.id)).map(n => n.id)).toEqual([VISIE_ID])
  })
})

// ── Takken ──────────────────────────────────────────────────────────────────

describe('descendantsOf', () => {
  const g = buildGraph(cats, [proj('tuinproject', 'thuis'), proj('dak', 'thuis', { parent_id: 'tuinproject' })],
    [task(1, 'tuinproject'), task(2, 'dak')], { visieWortel: true, goals: [goal(5, 'thuis')] })

  it('vindt alles onder een knoop, hoe diep ook', () => {
    expect(new Set(descendantsOf(g.edges, 'c-thuis')))
      .toEqual(new Set(['g-5', 'p-tuinproject', 'p-dak', 't-1', 't-2']))
  })

  it('geeft niets terug voor een blad', () => {
    expect(descendantsOf(g.edges, 't-1')).toEqual([])
  })

  it('telt wat er onder een dichtgeklapte knoop verdwijnt', () => {
    expect(hiddenCount(g, 'p-tuinproject')).toBe(3)   // dak + zijn taak + eigen taak
  })

  it('blijft staan bij een lus in de gegevens', () => {
    const lus: Graph = { nodes: [], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }] }
    expect(() => descendantsOf(lus.edges, 'a')).not.toThrow()
  })
})

describe('visibleGraph — inklappen', () => {
  const g = buildGraph(cats, [proj('tuinproject', 'thuis')], [task(1, 'tuinproject')],
    { visieWortel: true, goals: [goal(5, 'thuis')] })

  it('laat alles zien als er niets dicht staat', () => {
    expect(visibleGraph(g, new Set())).toBe(g)
  })

  it('verbergt de tak maar houdt de knoop zelf zichtbaar', () => {
    const v = visibleGraph(g, new Set(['p-tuinproject']))
    expect(v.nodes.some(n => n.id === 'p-tuinproject')).toBe(true)
    expect(v.nodes.some(n => n.id === 't-1')).toBe(false)
  })

  it('laat geen verbinding achter die nergens meer heen wijst', () => {
    const v = visibleGraph(g, new Set(['p-tuinproject']))
    const ids = new Set(v.nodes.map(n => n.id))
    for (const e of v.edges) { expect(ids.has(e.from)).toBe(true); expect(ids.has(e.to)).toBe(true) }
  })

  it('klapt een heel gebied in één keer dicht', () => {
    const v = visibleGraph(g, new Set(['c-thuis']))
    expect(v.nodes.map(n => n.id).sort()).toEqual([VISIE_ID, 'c-muziek', 'c-thuis'].sort())
  })

  it('negeert een dichtgeklapte knoop die niet meer bestaat', () => {
    expect(visibleGraph(g, new Set(['p-weg'])).nodes.length).toBe(g.nodes.length)
  })
})

// ── De indeling ─────────────────────────────────────────────────────────────

describe('layout3D', () => {
  const g = buildGraph(cats, [proj('tuinproject', 'thuis'), proj('gitaar', 'muziek')],
    [task(1, 'tuinproject'), task(2, 'gitaar')], { visieWortel: true, goals: [goal(5, 'thuis')] })

  it('geeft elke knoop een plek', () => {
    const p = layout3D(g)
    expect(p.length).toBe(g.nodes.length)
    for (const n of p) {
      for (const as of [n.x, n.y, n.z]) expect(Number.isFinite(as), n.id).toBe(true)
    }
  })

  // Dit is het hele punt: de bol ziet er elke keer hetzelfde uit
  it('is deterministisch — twee keer berekenen geeft exact hetzelfde', () => {
    expect(layout3D(g)).toEqual(layout3D(g))
  })

  it('geeft dezelfde plekken ongeacht de volgorde van de invoer', () => {
    const omgekeerd: Graph = { nodes: [...g.nodes].reverse(), edges: [...g.edges].reverse() }
    const a = new Map(layout3D(g).map(n => [n.id, `${n.x.toFixed(6)},${n.y.toFixed(6)},${n.z.toFixed(6)}`]))
    const b = new Map(layout3D(omgekeerd).map(n => [n.id, `${n.x.toFixed(6)},${n.y.toFixed(6)},${n.z.toFixed(6)}`]))
    for (const [id, plek] of a) expect(b.get(id), id).toBe(plek)
  })

  it('zet de visie in het midden', () => {
    const wortel = layout3D(g).find(n => n.id === VISIE_ID)!
    expect([wortel.x, wortel.y, wortel.z]).toEqual([0, 0, 0])
  })

  it('legt geen twee knopen op exact dezelfde plek', () => {
    const plekken = layout3D(g).map(n => `${n.x.toFixed(3)},${n.y.toFixed(3)},${n.z.toFixed(3)}`)
    expect(new Set(plekken).size).toBe(plekken.length)
  })

  it('zet een kind altijd verder van het midden dan zijn ouder', () => {
    const pos = new Map(layout3D(g).map(n => [n.id, n]))
    const afstand = (id: string) => { const n = pos.get(id)!; return Math.hypot(n.x, n.y, n.z) }
    for (const e of g.edges) {
      if (e.to === VISIE_ID) continue
      expect(afstand(e.from), `${e.from} onder ${e.to}`).toBeGreaterThan(afstand(e.to))
    }
  })

  it('houdt takken bij elkaar: een taak staat dichter bij zijn project dan bij de visie', () => {
    const pos = new Map(layout3D(g).map(n => [n.id, n]))
    const t = pos.get('t-1')!, p = pos.get('p-tuinproject')!, v = pos.get(VISIE_ID)!
    expect(Math.hypot(t.x-p.x, t.y-p.y, t.z-p.z)).toBeLessThan(Math.hypot(t.x-v.x, t.y-v.y, t.z-v.z))
  })

  it('kan een graaf zonder wortelknoop aan', () => {
    const los = buildGraph(cats, [], [])
    expect(layout3D(los).length).toBe(los.nodes.length)
  })

  it('kan een lege graaf aan', () => {
    expect(layout3D({ nodes: [], edges: [] })).toEqual([])
  })
})

// ── Jouw eigen aanpassingen ─────────────────────────────────────────────────

describe('pasStandToe', () => {
  const basis = [
    { id: 'a', label: 'a', emoji: '', type: 'proj' as const, color: '#fff', r: 5, x: 1, y: 2, z: 3 },
    { id: 'b', label: 'b', emoji: '', type: 'proj' as const, color: '#fff', r: 5, x: 4, y: 5, z: 6 },
  ]

  it('laat een knoop die je niet hebt aangeraakt op zijn berekende plek', () => {
    expect(pasStandToe(basis, {})).toEqual(basis)
  })

  it('zet een verplaatste knoop op zijn nieuwe plek', () => {
    const uit = pasStandToe(basis, { a: { x: 10, y: 20, z: 30 } })
    expect(uit.find(n => n.id === 'a')).toMatchObject({ x: 10, y: 20, z: 30 })
    expect(uit.find(n => n.id === 'b')).toMatchObject({ x: 4, y: 5, z: 6 })
  })

  // Een rij die alleen 'dicht' vastlegt heeft geen plek — die mag niet op 0,0,0 belanden
  it('negeert een rij zonder coördinaten', () => {
    expect(pasStandToe(basis, { a: { collapsed: true } })).toEqual(basis)
  })
})

describe('dichteKnopen en verplaatst', () => {
  const stand: Stand = {
    a: { collapsed: true },
    b: { x: 1, y: 2, z: 3 },
    c: { x: 1, y: 2, z: 3, collapsed: true },
  }

  it('vindt de dichtgeklapte takken', () => {
    expect(dichteKnopen(stand)).toEqual(new Set(['a', 'c']))
  })

  it('telt alleen knopen met een eigen plek als verplaatst', () => {
    expect(isVerplaatst(stand, 'a')).toBe(false)
    expect(isVerplaatst(stand, 'b')).toBe(true)
    expect(aantalVerplaatst(stand)).toBe(2)
  })

  it('leest de rijen uit de database', () => {
    expect(standUitRijen([{ node_id: 'x', x: 1, y: 2, z: 3, collapsed: false }]))
      .toEqual({ x: { x: 1, y: 2, z: 3, collapsed: false } })
  })
})

describe('childrenOf', () => {
  it('geeft alleen de directe kinderen', () => {
    const g = buildGraph(cats, [proj('tuinproject', 'thuis')], [task(1, 'tuinproject')], { visieWortel: true })
    expect(childrenOf(g.edges, 'c-thuis')).toEqual(['p-tuinproject'])
  })
})

import { describe, it, expect } from 'vitest'
import {
  buildGraph, childrenOf, layout2D, boundsOf, fitView,
  clampZoom, zoomIn, zoomOut, zoomAround, zoomKeyAction, packCircles, clusterRadius,
  packRadius, hitTest, anchorNode, keepAnchor,
  ZOOM_MIN, ZOOM_MAX, INBOX_COLOR,
} from '@/lib/graph-layout'
import { CAT_COLORS } from '@/lib/category-colors'
import type { Task, Project } from '@/lib/types'

const cats = [{ id: 'gezondheid', name: 'Gezondheid' }, { id: 'werk', name: 'Werk' }]

function proj(id: string, cat: string, extra: Partial<Project> = {}): Project {
  return {
    id, user_id: 'u', cat_id: cat, name: id, emoji: '🎯', status: 'actief', description: '', vision: '',
    proj_type: 'project', notes: null, html_content: null, is_priority: false, sort_order: 0,
    created_at: '', updated_at: '', ...extra,
  }
}
function task(id: number, projId: string | null, extra: Partial<Task> = {}): Task {
  return { id, user_id: 'u', proj_id: projId, name: `taak ${id}`, status: 'backlog', urgent: false, priority: 0, created_at: '', updated_at: '', ...extra }
}

describe('buildGraph', () => {
  it('maakt een knoop per categorie met een eigen kleur', () => {
    const g = buildGraph(cats, [], [])
    expect(g.nodes.map(n => n.id)).toEqual(['c-gezondheid', 'c-werk'])
    expect(g.nodes[0].color).toBe(CAT_COLORS[0])
    expect(g.nodes[1].color).toBe(CAT_COLORS[1])
  })

  it('hangt een project aan zijn categorie', () => {
    const g = buildGraph(cats, [proj('sport', 'gezondheid')], [])
    expect(g.edges).toContainEqual({ from: 'p-sport', to: 'c-gezondheid' })
  })

  it('hangt een sub-project aan zijn hoofdproject in plaats van aan de categorie', () => {
    const g = buildGraph(cats, [proj('hoofd', 'werk'), proj('sub', 'werk', { parent_id: 'hoofd' })], [])
    expect(g.edges).toContainEqual({ from: 'p-sub', to: 'p-hoofd' })
    expect(g.edges).not.toContainEqual({ from: 'p-sub', to: 'c-werk' })
  })

  it('hangt een sub-project met een verdwenen ouder alsnog aan de categorie', () => {
    const g = buildGraph(cats, [proj('sub', 'werk', { parent_id: 'weg' })], [])
    expect(g.edges).toContainEqual({ from: 'p-sub', to: 'c-werk' })
  })

  it('laat afgeronde taken weg', () => {
    const g = buildGraph(cats, [proj('sport', 'gezondheid')], [task(1, 'sport'), task(2, 'sport', { status: 'done' })])
    expect(g.nodes.map(n => n.id)).toContain('t-1')
    expect(g.nodes.map(n => n.id)).not.toContain('t-2')
  })

  it('maakt alleen een inbox-bol als er taken zonder project zijn', () => {
    expect(buildGraph(cats, [], [task(1, null)]).nodes.find(n => n.id === 'c-inbox')?.color).toBe(INBOX_COLOR)
    expect(buildGraph(cats, [], [task(1, 'sport')]).nodes.find(n => n.id === 'c-inbox')).toBeUndefined()
  })

  it('geeft een taak de kleur van zijn project', () => {
    const g = buildGraph(cats, [proj('overleg', 'werk')], [task(1, 'overleg')])
    expect(g.nodes.find(n => n.id === 't-1')!.color).toBe(CAT_COLORS[1])
  })

  it('slaat een taak over waarvan het project niet bestaat', () => {
    const g = buildGraph(cats, [], [task(1, 'verdwenen')])
    expect(g.nodes.map(n => n.id)).not.toContain('t-1')
    expect(g.edges).toHaveLength(0)
  })

  it('maakt urgente taken groter en markeert ze', () => {
    const g = buildGraph(cats, [proj('p', 'werk')], [task(1, 'p', { urgent: true }), task(2, 'p')])
    const u = g.nodes.find(n => n.id === 't-1')!
    expect(u.urgent).toBe(true)
    expect(u.r).toBeGreaterThan(g.nodes.find(n => n.id === 't-2')!.r)
  })
})

describe('childrenOf', () => {
  it('vindt alles wat aan een knoop hangt', () => {
    const g = buildGraph(cats, [proj('a', 'werk'), proj('b', 'werk')], [])
    expect(childrenOf(g.edges, 'c-werk').sort()).toEqual(['p-a', 'p-b'])
  })
})

describe('layout2D', () => {
  const graph = buildGraph(cats, [proj('sport', 'gezondheid'), proj('overleg', 'werk')], [task(1, 'sport'), task(2, null)])

  it('geeft elke knoop precies één plek', () => {
    const placed = layout2D(graph)
    expect(placed).toHaveLength(graph.nodes.length)
    expect(new Set(placed.map(p => p.id)).size).toBe(graph.nodes.length)
    placed.forEach(p => { expect(Number.isFinite(p.x)).toBe(true); expect(Number.isFinite(p.y)).toBe(true) })
  })

  it('is deterministisch — dezelfde graaf geeft dezelfde kaart', () => {
    expect(layout2D(graph)).toEqual(layout2D(graph))
  })

  it('zet een taak dichter bij zijn project dan de categorieën bij elkaar staan', () => {
    const placed = layout2D(graph)
    const at = (id: string) => placed.find(p => p.id === id)!
    const d = (a: string, b: string) => Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y)
    expect(d('t-1', 'p-sport')).toBeLessThan(d('c-gezondheid', 'c-werk'))
  })

  it('spreidt clusters uit: meer categorieën geeft een grotere kaart', () => {
    const veel = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, name: `C${i}` }))
    const klein = boundsOf(layout2D(buildGraph(cats, [], [])))
    const groot = boundsOf(layout2D(buildGraph(veel, [], [])))
    expect(groot.width).toBeGreaterThan(klein.width)
  })

  it('legt ook een enkele categorie zonder projecten neer', () => {
    const placed = layout2D(buildGraph([cats[0]], [], []))
    expect(placed).toHaveLength(1)
    expect(placed[0].id).toBe('c-gezondheid')
    expect(placed[0].x).toBeCloseTo(0)
    expect(placed[0].y).toBeCloseTo(0)
  })

  it('geeft een lege graaf een lege kaart', () => {
    expect(layout2D({ nodes: [], edges: [] })).toEqual([])
  })

  it('laat clusters elkaar niet overlappen', () => {
    const veel = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, name: `C${i}` }))
    const projs = veel.flatMap(c => [proj(`${c.id}-a`, c.id), proj(`${c.id}-b`, c.id)])
    const placed = layout2D(buildGraph(veel, projs, []))
    // Geen twee knopen mogen op dezelfde plek liggen
    const keys = placed.map(p => `${Math.round(p.x)},${Math.round(p.y)}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('houdt de kaart gevuld: een cluster staat in het midden', () => {
    const veel = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, name: `C${i}` }))
    const placed = layout2D(buildGraph(veel, [], []))
    const b = boundsOf(placed)
    const dichtstbij = Math.min(...placed.map(p => Math.hypot(p.x - b.cx, p.y - b.cy)))
    // Er staat iets in de buurt van het midden — geen leeg gat om in te zoomen
    expect(dichtstbij).toBeLessThan(Math.max(b.width, b.height) / 3)
  })
})

describe('packCircles', () => {
  it('zet de eerste cirkel in het midden', () => {
    expect(packCircles([100])).toEqual([{ x: 0, y: 0 }])
  })

  it('houdt overal minstens de tussenruimte aan', () => {
    const radii = [200, 150, 150, 90, 90, 60, 60, 40]
    const c = packCircles(radii, 50)
    expect(c).toHaveLength(radii.length)
    for (let i = 0; i < c.length; i++) {
      for (let j = i + 1; j < c.length; j++) {
        expect(Math.hypot(c[i].x - c[j].x, c[i].y - c[j].y)).toBeGreaterThanOrEqual(radii[i] + radii[j] + 50 - 0.001)
      }
    }
  })

  it('is deterministisch', () => {
    expect(packCircles([100, 80, 60])).toEqual(packCircles([100, 80, 60]))
  })
})

describe('clusterRadius', () => {
  it('meet tot de buitenrand van de verste knoop', () => {
    expect(clusterRadius([
      { id: 'a', label: '', emoji: '', type: 'cat', color: '#fff', r: 10, x: 0, y: 0 },
      { id: 'b', label: '', emoji: '', type: 'task', color: '#fff', r: 5, x: 30, y: 40 },
    ])).toBe(55)
  })
})

describe('boundsOf', () => {
  it('omvat de stralen van de knopen', () => {
    const b = boundsOf([
      { id: 'a', label: 'a', emoji: '', type: 'cat', color: '#fff', r: 10, x: 0, y: 0 },
      { id: 'b', label: 'b', emoji: '', type: 'task', color: '#fff', r: 5, x: 100, y: 50 },
    ])
    expect(b.minX).toBe(-10)
    expect(b.maxX).toBe(105)
    expect(b.cx).toBe(47.5)
  })

  it('geeft een veilig vakje terug bij niets', () => {
    expect(boundsOf([]).width).toBeGreaterThan(0)
  })
})

describe('zoom', () => {
  it('houdt de zoom binnen de grenzen', () => {
    expect(clampZoom(99)).toBe(ZOOM_MAX)
    expect(clampZoom(0.0001)).toBe(ZOOM_MIN)
    expect(clampZoom(NaN)).toBe(1)
  })

  it('zoomt in en uit met vaste stappen', () => {
    expect(zoomIn(1)).toBeCloseTo(1.25)
    expect(zoomOut(1.25)).toBeCloseTo(1)
    expect(zoomOut(zoomIn(1))).toBeCloseTo(1)
  })

  it('loopt niet voorbij de grenzen bij doorklikken', () => {
    let z = 1
    for (let i = 0; i < 50; i++) z = zoomIn(z)
    expect(z).toBe(ZOOM_MAX)
    for (let i = 0; i < 100; i++) z = zoomOut(z)
    expect(z).toBe(ZOOM_MIN)
  })

  it('herkent + en − als zoomtoetsen, ook op het numerieke deel', () => {
    expect(zoomKeyAction('+')).toBe('in')
    expect(zoomKeyAction('=')).toBe('in')
    expect(zoomKeyAction('Add')).toBe('in')
    expect(zoomKeyAction('-')).toBe('out')
    expect(zoomKeyAction('_')).toBe('out')
    expect(zoomKeyAction('Subtract')).toBe('out')
    expect(zoomKeyAction('0')).toBe('reset')
    expect(zoomKeyAction('a')).toBeNull()
    expect(zoomKeyAction('ArrowUp')).toBeNull()
  })

  it('houdt het punt onder de cursor op zijn plek', () => {
    const view = { zoom: 1, panX: 0, panY: 0 }
    const next = zoomAround(view, 2, 100, 100)
    // wereldpunt onder (100,100) was (100,100); na zoomen moet het daar weer staan
    expect(next.panX + 100 * next.zoom).toBeCloseTo(100)
    expect(next.panY + 100 * next.zoom).toBeCloseTo(100)
  })

  it('past de hele kaart in beeld', () => {
    const placed = layout2D(buildGraph(cats, [proj('a', 'werk')], []))
    const v = fitView(placed, 800, 600)
    const b = boundsOf(placed)
    expect(b.minX * v.zoom + v.panX).toBeGreaterThanOrEqual(-1)
    expect(b.maxX * v.zoom + v.panX).toBeLessThanOrEqual(801)
    expect(v.zoom).toBeLessThanOrEqual(ZOOM_MAX)
  })
})

// ─── Stabiliteit ──────────────────────────────────────────────────────────────
// Regressie: bij het verwijderen van één taak sprongen hele clusters ~1950px
// weg, waardoor het leek alsof het project van de kaart verdween.

describe('layout2D — stabiliteit bij verandering', () => {
  const cats = [{ id: 'klussen', name: 'Klussen' }, { id: 'werk', name: 'Werk' }, { id: 'thuis', name: 'Thuis' }]
  const projs = [proj('tuinproject', 'klussen'), proj('inwoners', 'klussen'), proj('pa', 'werk'), proj('tuin', 'thuis')]
  const tasks = [
    ...Array.from({ length: 10 }, (_, i) => task(i + 1, 'tuinproject')),
    ...Array.from({ length: 4 }, (_, i) => task(100 + i, 'pa')),
    task(200, 'tuin'),
  ]

  function verschuiving(voor: ReturnType<typeof layout2D>, na: ReturnType<typeof layout2D>, negeer: string[] = []) {
    const naById = new Map(na.map(p => [p.id, p]))
    const out: Record<string, number> = {}
    for (const p of voor) {
      if (negeer.includes(p.id)) continue
      const q = naById.get(p.id)
      if (!q) continue
      out[p.id] = Math.hypot(p.x - q.x, p.y - q.y)
    }
    return out
  }

  it('laat andere clusters staan als er één taak verdwijnt', () => {
    const voor = layout2D(buildGraph(cats, projs, tasks))
    const na   = layout2D(buildGraph(cats, projs, tasks.filter(t => t.id !== 5)))
    const d = verschuiving(voor, na, ['t-5'])
    // Alles buiten het cluster van de verwijderde taak blijft exact staan
    for (const id of ['c-werk', 'c-thuis', 'p-pa', 'p-tuin', 't-100', 't-200', 'c-klussen', 'p-inwoners']) {
      expect(d[id], id).toBeLessThan(1)
    }
  })

  it('houdt de beweging binnen het eigen cluster klein', () => {
    const voor = layout2D(buildGraph(cats, projs, tasks))
    const na   = layout2D(buildGraph(cats, projs, tasks.filter(t => t.id !== 5)))
    const d = verschuiving(voor, na, ['t-5'])
    // Broertjes in dezelfde ring schuiven wat op, maar niet buiten beeld
    expect(Math.max(...Object.values(d))).toBeLessThan(120)
  })

  it('laat de kaart staan als er een taak bijkomt', () => {
    const voor = layout2D(buildGraph(cats, projs, tasks))
    const na   = layout2D(buildGraph(cats, projs, [...tasks, task(999, 'pa')]))
    const d = verschuiving(voor, na)
    for (const id of ['c-klussen', 'p-tuinproject', 'c-thuis', 'p-tuin', 't-1']) {
      expect(d[id], id).toBeLessThan(1)
    }
  })
})

describe('packRadius', () => {
  it('rondt af op vaste maatvakjes, zodat kleine groei niets verschuift', () => {
    expect(packRadius(120)).toBe(packRadius(150))
    expect(packRadius(151)).toBe(300)
    expect(packRadius(0)).toBe(150)
  })

  it('is nooit kleiner dan de werkelijke maat', () => {
    for (const r of [1, 99, 200, 451, 1000]) expect(packRadius(r)).toBeGreaterThanOrEqual(r)
  })
})

// ─── Aanklikken ───────────────────────────────────────────────────────────────

describe('hitTest', () => {
  const nodes = [
    { id: 'c-a', label: 'A', emoji: '', type: 'cat' as const, color: '#fff', r: 18, x: 0, y: 0 },
    { id: 't-1', label: 'T', emoji: '', type: 'task' as const, color: '#fff', r: 4, x: 100, y: 0 },
  ]
  const view = { zoom: 1, panX: 0, panY: 0 }

  it('vindt de knoop onder de cursor', () => {
    expect(hitTest(nodes, view, 0, 0)?.id).toBe('c-a')
    expect(hitTest(nodes, view, 100, 0)?.id).toBe('t-1')
  })

  it('geeft niets terug op een lege plek', () => {
    expect(hitTest(nodes, view, 400, 400)).toBeNull()
  })

  it('houdt kleine bollen aanklikbaar als je uitgezoomd bent', () => {
    // 4 * 0.1 = 0.4px zou onraakbaar zijn; de ondergrens maakt het toch te doen
    expect(hitTest(nodes, { zoom: 0.1, panX: 0, panY: 0 }, 10, 3)?.id).toBe('t-1')
  })

  it('rekent met pan en zoom', () => {
    expect(hitTest(nodes, { zoom: 2, panX: 50, panY: 20 }, 250, 20)?.id).toBe('t-1')
  })

  it('kiest de bovenste bij overlap — taken liggen bovenop', () => {
    const opElkaar = [nodes[0], { ...nodes[1], x: 0, y: 0 }]
    expect(hitTest(opElkaar, view, 0, 0)?.id).toBe('t-1')
  })
})

// ─── Beeld vasthouden ─────────────────────────────────────────────────────────

describe('anchorNode', () => {
  const nodes = [
    { id: 'a', label: '', emoji: '', type: 'cat' as const, color: '#fff', r: 10, x: 0, y: 0 },
    { id: 'b', label: '', emoji: '', type: 'cat' as const, color: '#fff', r: 10, x: 1000, y: 0 },
  ]

  it('kiest wat het dichtst bij het midden van het beeld staat', () => {
    expect(anchorNode(nodes, { zoom: 1, panX: 400, panY: 300 }, 800, 600)).toBe('a')
    expect(anchorNode(nodes, { zoom: 1, panX: -600, panY: 300 }, 800, 600)).toBe('b')
  })

  it('geeft niets terug op een lege kaart', () => {
    expect(anchorNode([], { zoom: 1, panX: 0, panY: 0 }, 800, 600)).toBeNull()
  })
})

describe('keepAnchor', () => {
  const voor = [{ id: 'a', label: '', emoji: '', type: 'cat' as const, color: '#fff', r: 10, x: 0, y: 0 }]
  const na   = [{ id: 'a', label: '', emoji: '', type: 'cat' as const, color: '#fff', r: 10, x: 500, y: -300 }]

  it('houdt de ankerknoop op dezelfde plek op het scherm', () => {
    const view = { zoom: 1.5, panX: 100, panY: 80 }
    const voorX = voor[0].x * view.zoom + view.panX
    const voorY = voor[0].y * view.zoom + view.panY
    const next = keepAnchor('a', voor, na, view)
    expect(na[0].x * next.zoom + next.panX).toBeCloseTo(voorX)
    expect(na[0].y * next.zoom + next.panY).toBeCloseTo(voorY)
  })

  it('verandert de zoom niet', () => {
    expect(keepAnchor('a', voor, na, { zoom: 0.4, panX: 0, panY: 0 }).zoom).toBe(0.4)
  })

  it('laat het beeld staan als het anker zelf verdwenen is', () => {
    const view = { zoom: 1, panX: 10, panY: 20 }
    expect(keepAnchor('a', voor, [], view)).toEqual(view)
    expect(keepAnchor('weg', voor, na, view)).toEqual(view)
  })
})

// ─── Gearchiveerde projecten ──────────────────────────────────────────────────
// Regressie: een afgerond project ('Lemon Tree', 'Schuur opruimen') bleef op de
// kaart staan, terwijl die kaart over openstaand werk gaat.

describe('buildGraph — gearchiveerde projecten', () => {
  const cats2 = [{ id: 'thuis', name: 'Thuis' }]

  it('laat een gearchiveerd project weg', () => {
    const g = buildGraph(cats2, [proj('schuur', 'thuis'), proj('klaar', 'thuis', { status: 'archief' })], [])
    expect(g.nodes.map(n => n.id)).toContain('p-schuur')
    expect(g.nodes.map(n => n.id)).not.toContain('p-klaar')
  })

  it('laat ook de verbinding van dat project weg', () => {
    const g = buildGraph(cats2, [proj('klaar', 'thuis', { status: 'archief' })], [])
    expect(g.edges.some(e => e.from === 'p-klaar')).toBe(false)
  })

  it('legt een open taak eronder in de inbox in plaats van hem te laten verdwijnen', () => {
    const g = buildGraph(cats2, [proj('klaar', 'thuis', { status: 'archief' })], [task(1, 'klaar', { name: 'Nog te doen' })])
    expect(g.nodes.map(n => n.id)).toContain('t-1')
    expect(g.edges).toContainEqual({ from: 't-1', to: 'c-inbox' })
  })

  it('maakt geen inbox-bol als er niets losraakt', () => {
    const g = buildGraph(cats2, [proj('schuur', 'thuis')], [task(1, 'schuur')])
    expect(g.nodes.map(n => n.id)).not.toContain('c-inbox')
  })

  it('hangt een sub-project van een gearchiveerd project aan zijn levensgebied', () => {
    const g = buildGraph(cats2, [
      proj('hoofd', 'thuis', { status: 'archief' }),
      proj('sub', 'thuis', { parent_id: 'hoofd' }),
    ], [])
    expect(g.edges).toContainEqual({ from: 'p-sub', to: 'c-thuis' })
  })
})

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GraphTab, selectionFromNodeId, nodeIdFromSelection } from '@/app/dashboard/GraphTab'
import { buildGraph, layout2D, fitView } from '@/lib/graph-layout'
import type { Task, Project, WeekItem, Achievement } from '@/lib/types'

// Alleen aangeraakt zodra een test een userId meegeeft (3D-indeling bewaren,
// en — sinds de modus Financiën — FinanceClient's eigen supabase-client).
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    }),
  }),
}))

// ── jsdom: canvas en ResizeObserver namaken (zie MapView2D.test.tsx) ──────────

const VIEWPORT = { w: 800, h: 600 }

beforeAll(() => {
  ;(globalThis as any).ResizeObserver = class { observe() {} disconnect() {} }
  HTMLCanvasElement.prototype.getContext = (() => ({
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), fillText: vi.fn(),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '',
  })) as any
  HTMLCanvasElement.prototype.getBoundingClientRect = (() =>
    ({ left: 0, top: 0, width: VIEWPORT.w, height: VIEWPORT.h, right: VIEWPORT.w, bottom: VIEWPORT.h, x: 0, y: 0, toJSON: () => ({}) })) as any
  Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, get() { return VIEWPORT.w } })
  Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', { configurable: true, get() { return VIEWPORT.h } })
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

const cats = [{ id: 'klussen', name: 'Klussen' }, { id: 'werk', name: 'Werk' }]
function proj(id: string, cat: string, name = id): Project {
  return { id, user_id:'u', cat_id:cat, name, emoji:'🎯', status:'actief', description:'', vision:'',
    proj_type:'project', notes:null, html_content:null, is_priority:false, sort_order:0, created_at:'', updated_at:'' }
}
function task(id: number, projId: string, name = `taak ${id}`, extra: Partial<Task> = {}): Task {
  return { id, user_id:'u', proj_id:projId, name, status:'backlog', urgent:false, priority:0, created_at:'', updated_at:'', ...extra }
}
function week(text: string, extra: Partial<WeekItem> = {}): WeekItem {
  return { id: 1, user_id:'u', date:'2026-07-24', type:'task', text, done:true,
    proj_id:null, task_id:null, recur_id:null, created_at:'', ...extra }
}

const projects = [proj('tuinproject', 'klussen', 'Schuur Verbouwen'), proj('pa', 'werk', 'Acme Co')]
const tasks = [task(1, 'tuinproject', 'Regenpijp repareren'), task(2, 'tuinproject', 'Paden bijwerken'), task(3, 'pa', 'Setlist oefenen')]

function setup(props: Partial<React.ComponentProps<typeof GraphTab>> = {}) {
  const handlers = {
    onSelect: vi.fn(), onSelectTask: vi.fn(), onDeleteTask: vi.fn(),
    onAddTask: vi.fn().mockResolvedValue(null), onMarkTaskDone: vi.fn(),
  }
  const utils = render(
    <GraphTab projects={projects} categories={cats} tasks={tasks} weekItems={[]} achievements={[] as Achievement[]}
      recurringTasks={[]} {...handlers} {...props} />
  )
  return { ...handlers, ...utils }
}

/** Waar staat een knoop op het scherm bij 'alles in beeld'? */
function screenPos(id: string, t: Task[] = tasks) {
  const placed = layout2D(buildGraph(cats, projects, t))
  const v = fitView(placed, VIEWPORT.w, VIEWPORT.h)
  const n = placed.find(p => p.id === id)!
  return { x: n.x * v.zoom + v.panX, y: n.y * v.zoom + v.panY }
}
function klik(canvas: HTMLElement, x: number, y: number) {
  fireEvent.mouseMove(canvas, { clientX: x, clientY: y })
  fireEvent.mouseDown(canvas, { clientX: x, clientY: y })
  fireEvent.mouseUp(window, { clientX: x, clientY: y })
  fireEvent.click(canvas, { clientX: x, clientY: y })
}

beforeEach(() => { localStorage.clear() })

// ── Knoop-id's ────────────────────────────────────────────────────────────────

describe('selectionFromNodeId / nodeIdFromSelection', () => {
  it('herkent projecten, taken en categorieën', () => {
    expect(selectionFromNodeId('p-abc')).toEqual({ kind: 'proj', id: 'abc' })
    expect(selectionFromNodeId('t-42')).toEqual({ kind: 'task', id: '42' })
    expect(selectionFromNodeId('c-werk')).toEqual({ kind: 'cat', id: 'werk' })
  })

  it('geeft niets terug bij niets of onbekend', () => {
    expect(selectionFromNodeId(null)).toBeNull()
    expect(selectionFromNodeId('x-1')).toBeNull()
  })

  it('is heen en terug hetzelfde', () => {
    for (const id of ['p-abc', 't-42', 'c-werk', 'c-inbox']) {
      expect(nodeIdFromSelection(selectionFromNodeId(id))).toBe(id)
    }
    expect(nodeIdFromSelection(null)).toBeNull()
  })
})

// ── Modussen ──────────────────────────────────────────────────────────────────

describe('GraphTab — modussen', () => {
  it('begint in de 2D kaart', () => {
    setup()
    expect(screen.getByText(/om te zoomen/)).toBeInTheDocument()
    expect(screen.getByText(/^\d+%$/)).toBeInTheDocument()   // zoom-teller van de kaart
  })

  it('onthoudt je keuze', () => {
    const { unmount } = setup()
    act(() => { fireEvent.click(screen.getByText('🔥 Heatmap')) })
    expect(localStorage.getItem('inzicht-modus')).toBe('heatmap')
    unmount()
    setup()
    expect(screen.queryByText(/^\d+%$/)).not.toBeInTheDocument()  // kaart staat niet meer aan
  })

  it('herstelt een eerder gekozen modus', () => {
    localStorage.setItem('inzicht-modus', '3d')
    setup()
    expect(screen.getByText(/Sleep het lege veld om te draaien/)).toBeInTheDocument()
  })

  it('negeert rommel in de opslag', () => {
    localStorage.setItem('inzicht-modus', 'onzin')
    setup()
    expect(screen.getByText(/Sleep om te schuiven/)).toBeInTheDocument()
  })
})

// ── Taak verwijderen met Del ──────────────────────────────────────────────────

describe('GraphTab — Del verwijdert de geselecteerde taak', () => {
  it('verwijdert precies die ene taak', () => {
    const { onDeleteTask, container } = setup()
    const p = screenPos('t-1')
    klik(container.querySelector('canvas')!, p.x, p.y)
    expect(screen.getByLabelText('Taak: Regenpijp repareren')).toBeInTheDocument()

    act(() => { fireEvent.keyDown(window, { key: 'Delete' }) })
    expect(onDeleteTask).toHaveBeenCalledTimes(1)
    expect(onDeleteTask).toHaveBeenCalledWith(1)
  })

  it('sluit het paneel na verwijderen', () => {
    const { container } = setup()
    const p = screenPos('t-1')
    klik(container.querySelector('canvas')!, p.x, p.y)
    act(() => { fireEvent.keyDown(window, { key: 'Delete' }) })
    expect(screen.queryByLabelText(/^Taak:/)).not.toBeInTheDocument()
  })

  it('verwijdert nooit een project of levensgebied', () => {
    const { onDeleteTask, container } = setup()
    for (const id of ['p-tuinproject', 'c-werk']) {
      klik(container.querySelector('canvas')!, screenPos(id).x, screenPos(id).y)
      act(() => { fireEvent.keyDown(window, { key: 'Delete' }) })
    }
    expect(onDeleteTask).not.toHaveBeenCalled()
  })

  it('doet niets zonder selectie', () => {
    const { onDeleteTask } = setup()
    act(() => { fireEvent.keyDown(window, { key: 'Delete' }) })
    expect(onDeleteTask).not.toHaveBeenCalled()
  })

  it('laat Del met rust terwijl je in een invoerveld typt', () => {
    const { onDeleteTask, container } = setup()
    const p = screenPos('t-1')
    klik(container.querySelector('canvas')!, p.x, p.y)
    const input = document.createElement('input')
    document.body.appendChild(input)
    act(() => { fireEvent.keyDown(input, { key: 'Delete' }) })
    expect(onDeleteTask).not.toHaveBeenCalled()
    input.remove()
  })

  it('heeft ook een zichtbare verwijderknop in het paneel', () => {
    const { onDeleteTask, container } = setup()
    const p = screenPos('t-2')
    klik(container.querySelector('canvas')!, p.x, p.y)
    act(() => { fireEvent.click(screen.getByLabelText('Taak verwijderen')) })
    expect(onDeleteTask).toHaveBeenCalledWith(2)
  })
})

// ── Afgevinkte taken horen niet op de kaart ───────────────────────────────────

describe('GraphTab — bijwerken', () => {
  it('haalt een taak die in de week is afgevinkt van de kaart', () => {
    const { container } = setup({ weekItems: [week('🔧 Regenpijp repareren')] })
    // Klik waar de taak zónder dit bewijs zou hebben gestaan: daar is hij niet
    const p = screenPos('t-1', tasks)
    klik(container.querySelector('canvas')!, p.x, p.y)
    expect(screen.queryByLabelText('Taak: Regenpijp repareren')).not.toBeInTheDocument()

    // en de andere taak van hetzelfde project is nog gewoon aanklikbaar
    const q = screenPos('t-2', tasks.filter(t => t.id !== 1))
    klik(container.querySelector('canvas')!, q.x, q.y)
    expect(screen.getByLabelText('Taak: Paden bijwerken')).toBeInTheDocument()
  })

  it('biedt aan om zulke taken bij te werken, met het bewijs erbij', () => {
    setup({ weekItems: [week('🔧 Regenpijp repareren')] })
    act(() => { fireEvent.click(screen.getByText(/taken nakijken/)) })
    expect(screen.getByText('Regenpijp repareren')).toBeInTheDocument()
    expect(screen.getByText(/2026-07-24 afgevinkt in je weekplanning/)).toBeInTheDocument()
  })

  it('vinkt bij bevestiging de taak af in plaats van hem te verwijderen', () => {
    const { onMarkTaskDone, onDeleteTask } = setup({ weekItems: [week('🔧 Regenpijp repareren')] })
    act(() => { fireEvent.click(screen.getByText(/taken nakijken/)) })
    act(() => { fireEvent.click(screen.getByRole('button', { name: '✓ Klaar' })) })
    expect(onMarkTaskDone).toHaveBeenCalledWith(1)
    expect(onDeleteTask).not.toHaveBeenCalled()
  })

  it('vraagt niet nog eens naar een taak die je laat staan', () => {
    setup({ weekItems: [week('🔧 Regenpijp repareren')] })
    act(() => { fireEvent.click(screen.getByText(/taken nakijken/)) })
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Laat staan/ })) })
    expect(JSON.parse(localStorage.getItem('inzicht-nakijken-genegeerd')!)).toContain(1)
    expect(screen.getByText(/Niets meer om na te kijken/)).toBeInTheDocument()
  })

  it('zwijgt als er niets op te merken is', () => {
    setup()
    expect(screen.queryByText(/taken nakijken/)).not.toBeInTheDocument()
  })
})

// ── Nieuwe modussen: Stemming, Rapport, Financiën ──────────────────────────────

describe('GraphTab — Stemming/Rapport/Financiën modussen', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve({ reports: [], entries: [], transactions: [], allowanceEntries: [], allowanceGoals: [] }),
    }))
  })

  it('toont de stemmingsgrafiek in de modus Stemming', () => {
    const moodEntries = [
      { id: 1, user_id: 'u', date: '2026-08-01', mood: 2, created_at: '' },
      { id: 2, user_id: 'u', date: '2026-08-02', mood: 3, created_at: '' },
      { id: 3, user_id: 'u', date: '2026-08-03', mood: -1, created_at: '' },
    ]
    setup({ moodEntries, today: '2026-08-03' } as any)
    fireEvent.click(screen.getByText('📈 Stemming'))
    expect(screen.getByText('📈 Stemming door de tijd')).toBeInTheDocument()
  })

  it('toont het rapport in de modus Rapport', async () => {
    setup()
    fireEvent.click(screen.getByText('🎧 Rapport'))
    expect(await screen.findByText('🎧 Rapport')).toBeInTheDocument()
    expect(screen.getByText(/Automatisch elke week/)).toBeInTheDocument()
  })

  it('toont Financiën embedded in de modus Financiën, mét userId', async () => {
    setup({ userId: 'u1' })
    fireEvent.click(screen.getByText('💰 Financiën'))
    expect(await screen.findByText('Wie is wie schuldig')).toBeInTheDocument()
    // Embedded: geen "← Dashboard"-koppeling
    expect(screen.queryByText('← Dashboard')).not.toBeInTheDocument()
  })

  it('toont Financiën niet zonder userId', () => {
    setup()
    fireEvent.click(screen.getByText('💰 Financiën'))
    expect(screen.queryByText('Wie is wie schuldig')).not.toBeInTheDocument()
  })
})

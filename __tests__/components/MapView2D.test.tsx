import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MapView2D } from '@/app/dashboard/MapView2D'
import { buildGraph, layout2D, fitView } from '@/lib/graph-layout'
import type { Task, Project } from '@/lib/types'

// ── jsdom heeft geen canvas en geen ResizeObserver; genoeg namaken om te tekenen ──

const VIEWPORT = { w: 800, h: 600 }

function stubContext() {
  return {
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), fillText: vi.fn(),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '',
  }
}

beforeAll(() => {
  ;(globalThis as any).ResizeObserver = class { observe() {} disconnect() {} }
  HTMLCanvasElement.prototype.getContext = (() => stubContext()) as any
  HTMLCanvasElement.prototype.getBoundingClientRect = (() =>
    ({ left: 0, top: 0, width: VIEWPORT.w, height: VIEWPORT.h, right: VIEWPORT.w, bottom: VIEWPORT.h, x: 0, y: 0, toJSON: () => ({}) })) as any
  // De component leest de maat van zijn container
  Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, get() { return VIEWPORT.w } })
  Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', { configurable: true, get() { return VIEWPORT.h } })
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

const cats = [{ id: 'werk', name: 'Werk' }, { id: 'thuis', name: 'Thuis' }]
function proj(id: string, cat: string): Project {
  return { id, user_id:'u', cat_id:cat, name:id, emoji:'🎯', status:'actief', description:'', vision:'',
    proj_type:'project', notes:null, html_content:null, is_priority:false, sort_order:0, created_at:'', updated_at:'' }
}
function task(id: number, projId: string): Task {
  return { id, user_id:'u', proj_id:projId, name:`taak ${id}`, status:'backlog', urgent:false, priority:0, created_at:'', updated_at:'' }
}

const projects = [proj('pa', 'werk'), proj('tuin', 'thuis')]
const tasks = [task(1, 'pa'), task(2, 'pa'), task(3, 'tuin')]

/** Waar staat een knoop op het scherm bij de begin-instelling (alles in beeld)? */
function screenPos(id: string, t = tasks) {
  const placed = layout2D(buildGraph(cats, projects, t))
  const v = fitView(placed, VIEWPORT.w, VIEWPORT.h)
  const n = placed.find(p => p.id === id)!
  return { x: n.x * v.zoom + v.panX, y: n.y * v.zoom + v.panY }
}

function setup(props: Partial<React.ComponentProps<typeof MapView2D>> = {}) {
  const onPickNode = vi.fn()
  const utils = render(
    <MapView2D categories={cats} projects={projects} tasks={tasks} selectedId={null} onPickNode={onPickNode} {...props} />
  )
  return { onPickNode, ...utils }
}

function klik(canvas: HTMLElement, x: number, y: number) {
  fireEvent.mouseMove(canvas, { clientX: x, clientY: y })
  fireEvent.mouseDown(canvas, { clientX: x, clientY: y })
  fireEvent.mouseUp(window, { clientX: x, clientY: y })
  fireEvent.click(canvas, { clientX: x, clientY: y })
}

beforeEach(() => { localStorage.clear() })

describe('MapView2D — aanklikken', () => {
  it('geeft de aangeklikte knoop door', () => {
    const { onPickNode, container } = setup()
    const canvas = container.querySelector('canvas')!
    const p = screenPos('c-werk')
    klik(canvas, p.x, p.y)
    expect(onPickNode).toHaveBeenCalledWith('c-werk')
  })

  it('werkt ook zonder dat de muis er eerst over bewogen heeft', () => {
    // Regressie: het paneel bleef leeg omdat de klik op de hover-status leunde
    const { onPickNode, container } = setup()
    const canvas = container.querySelector('canvas')!
    const p = screenPos('p-pa')
    fireEvent.click(canvas, { clientX: p.x, clientY: p.y })
    expect(onPickNode).toHaveBeenCalledWith('p-pa')
  })

  it('geeft null door bij een klik op een lege plek', () => {
    const { onPickNode, container } = setup()
    klik(container.querySelector('canvas')!, 5, 5)
    expect(onPickNode).toHaveBeenCalledWith(null)
  })

  it('ziet slepen niet als een klik', () => {
    const { onPickNode, container } = setup()
    const canvas = container.querySelector('canvas')!
    const p = screenPos('c-werk')
    fireEvent.mouseDown(canvas, { clientX: p.x, clientY: p.y })
    fireEvent.mouseMove(canvas, { clientX: p.x + 60, clientY: p.y + 40 })
    fireEvent.mouseUp(window, { clientX: p.x + 60, clientY: p.y + 40 })
    fireEvent.click(canvas, { clientX: p.x + 60, clientY: p.y + 40 })
    expect(onPickNode).not.toHaveBeenCalled()
  })
})

describe('MapView2D — zoomen met het toetsenbord', () => {
  function zoomTekst() { return screen.getByText(/^\d+%$/).textContent! }

  it('zoomt in met + en uit met −', () => {
    setup()
    const begin = parseInt(zoomTekst(), 10)
    act(() => { fireEvent.keyDown(window, { key: '+' }) })
    const na = parseInt(zoomTekst(), 10)
    expect(na).toBeGreaterThan(begin)
    act(() => { fireEvent.keyDown(window, { key: '-' }) })
    expect(parseInt(zoomTekst(), 10)).toBe(begin)
  })

  it('accepteert ook = en de numerieke toetsen', () => {
    setup()
    const begin = parseInt(zoomTekst(), 10)
    act(() => { fireEvent.keyDown(window, { key: '=' }) })
    expect(parseInt(zoomTekst(), 10)).toBeGreaterThan(begin)
    act(() => { fireEvent.keyDown(window, { key: 'Subtract' }) })
    expect(parseInt(zoomTekst(), 10)).toBe(begin)
  })

  it('zet met 0 alles weer in beeld', () => {
    setup()
    const begin = zoomTekst()
    act(() => { fireEvent.keyDown(window, { key: '+' }); fireEvent.keyDown(window, { key: '+' }) })
    expect(zoomTekst()).not.toBe(begin)
    act(() => { fireEvent.keyDown(window, { key: '0' }) })
    expect(zoomTekst()).toBe(begin)
  })

  it('zoomt niet terwijl je in een invoerveld typt', () => {
    setup()
    const begin = zoomTekst()
    const input = document.createElement('input')
    document.body.appendChild(input)
    act(() => { fireEvent.keyDown(input, { key: '+' }) })
    expect(zoomTekst()).toBe(begin)
    input.remove()
  })

  it('heeft ook knoppen voor wie liever klikt', () => {
    setup()
    const begin = parseInt(zoomTekst(), 10)
    act(() => { fireEvent.click(screen.getByLabelText('Inzoomen')) })
    expect(parseInt(zoomTekst(), 10)).toBeGreaterThan(begin)
    act(() => { fireEvent.click(screen.getByLabelText('Uitzoomen')) })
    expect(parseInt(zoomTekst(), 10)).toBe(begin)
    act(() => { fireEvent.click(screen.getByLabelText('Alles in beeld')) })
    expect(parseInt(zoomTekst(), 10)).toBe(begin)
  })
})

describe('MapView2D — beeld vasthouden bij nieuwe data', () => {
  it('houdt hetzelfde punt aanklikbaar nadat er een taak verdwijnt', () => {
    // Regressie: na het verwijderen van één taak schoot het cluster uit beeld,
    // waardoor het leek alsof het hele project weg was.
    const { onPickNode, container, rerender } = setup()
    const canvas = container.querySelector('canvas')!
    const p = screenPos('p-tuin')

    klik(canvas, p.x, p.y)
    expect(onPickNode).toHaveBeenLastCalledWith('p-tuin')

    // taak 1 verdwijnt uit een ánder cluster
    rerender(<MapView2D categories={cats} projects={projects} tasks={tasks.filter(t => t.id !== 1)}
      selectedId={null} onPickNode={onPickNode} />)

    klik(canvas, p.x, p.y)
    expect(onPickNode).toHaveBeenLastCalledWith('p-tuin')
  })

  it('houdt het project aanklikbaar als een eigen taak verdwijnt', () => {
    const { onPickNode, container, rerender } = setup()
    const canvas = container.querySelector('canvas')!
    const p = screenPos('p-pa')

    klik(canvas, p.x, p.y)
    expect(onPickNode).toHaveBeenLastCalledWith('p-pa')

    rerender(<MapView2D categories={cats} projects={projects} tasks={tasks.filter(t => t.id !== 2)}
      selectedId={null} onPickNode={onPickNode} />)

    klik(canvas, p.x, p.y)
    expect(onPickNode).toHaveBeenLastCalledWith('p-pa')
  })
})

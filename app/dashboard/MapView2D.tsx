'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task, Project } from '@/lib/types'
import {
  buildGraph, layout2D, fitView, zoomIn, zoomOut, zoomAround, zoomKeyAction, clampZoom,
  hitTest, anchorNode, keepAnchor,
  type CatLike, type Placed,
} from '@/lib/graph-layout'

// ─── MapView2D — platte kaart van je hele leven, om te pannen en te zoomen ────
// Zelfde graaf als de 3D-bol, maar uitgespreid en stil: hier kun je zoeken en
// lezen zonder dat er iets beweegt.

export function MapView2D({ categories, projects, tasks, onPickNode, selectedId }: {
  categories: CatLike[]
  projects:   Project[]
  tasks:      Task[]
  onPickNode: (id: string | null) => void
  selectedId: string | null
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoomLabel, setZoomLabel] = useState(100)

  const graph  = useMemo(() => buildGraph(categories, projects, tasks), [categories, projects, tasks])
  const placed = useMemo(() => layout2D(graph), [graph])

  // Alles wat elk frame verandert leeft in refs — geen re-render per muisbeweging
  const view      = useRef({ zoom: 1, panX: 0, panY: 0 })
  const placedRef = useRef<Placed[]>(placed)
  const edgesRef  = useRef(graph.edges)
  const pickRef   = useRef(onPickNode)
  const selRef    = useRef(selectedId)
  const dirtyRef  = useRef(true)
  const apiRef    = useRef<{ zoom: (dir: 'in' | 'out') => void; fit: () => void } | null>(null)
  // Bij nieuwe data verschuift de indeling een beetje. Houd vast waar je naar
  // keek, zodat het niet lijkt alsof een project ineens verdwenen is.
  useEffect(() => {
    const vorige = placedRef.current, el = containerRef.current
    if (vorige.length > 0 && el) {
      const anker = anchorNode(vorige, view.current, el.clientWidth, el.clientHeight)
      if (anker) view.current = keepAnchor(anker, vorige, placed, view.current)
    }
    placedRef.current = placed
    edgesRef.current = graph.edges
    dirtyRef.current = true
  }, [placed, graph])
  useEffect(() => { pickRef.current = onPickNode }, [onPickNode])
  useEffect(() => { selRef.current = selectedId; dirtyRef.current = true }, [selectedId])

  useEffect(() => {
    const canvas = canvasRef.current, cont = containerRef.current
    if (!canvas || !cont) return
    const ctx = canvas.getContext('2d')!

    let hoveredId: string | null = null
    let dragging = false, dragDist = 0, lastX = 0, lastY = 0
    let raf = 0

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas!.width  = cont!.clientWidth  * dpr
      canvas!.height = cont!.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dirtyRef.current = true
    }
    function size() { return { w: cont!.clientWidth, h: cont!.clientHeight } }

    function fit() {
      const { w, h } = size()
      view.current = fitView(placedRef.current, w, h)
      setZoomLabel(Math.round(view.current.zoom * 100))
      dirtyRef.current = true
    }

    resize()
    fit()
    const ro = new ResizeObserver(resize)
    ro.observe(cont)

    function toScreen(x: number, y: number) {
      const v = view.current
      return { sx: x * v.zoom + v.panX, sy: y * v.zoom + v.panY }
    }

    function nodeAt(mx: number, my: number) {
      return hitTest(placedRef.current, view.current, mx, my)
    }

    function draw() {
      const { w, h } = size()
      const v = view.current
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#070c14'
      ctx.fillRect(0, 0, w, h)

      drawGrid(ctx, w, h, v)

      const at = new Map(placedRef.current.map(n => [n.id, n]))

      // Verbindingen eerst, zodat bollen er bovenop liggen
      for (const e of edgesRef.current) {
        const a = at.get(e.from), b = at.get(e.to)
        if (!a || !b) continue
        const p = toScreen(a.x, a.y), q = toScreen(b.x, b.y)
        const isTask = e.from.startsWith('t-')
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(q.sx, q.sy)
        ctx.strokeStyle = isTask ? 'rgba(99,102,241,.18)' : 'rgba(99,102,241,.32)'
        ctx.lineWidth = Math.max(isTask ? 0.6 : 1, (isTask ? 0.8 : 1.4) * v.zoom)
        ctx.stroke()
      }

      const showLabels = v.zoom > 0.45   // uitgezoomd zou alle tekst één blur zijn

      for (const n of placedRef.current) {
        const { sx, sy } = toScreen(n.x, n.y)
        const r = Math.max(n.r * v.zoom, n.type === 'cat' ? 5 : 2)
        if (sx < -80 || sy < -80 || sx > w + 80 || sy > h + 80) continue   // buiten beeld

        const hov = hoveredId === n.id
        const sel = selRef.current === n.id
        if (hov || sel) {
          const g = ctx.createRadialGradient(sx, sy, r, sx, sy, r * 3.2)
          g.addColorStop(0, n.color + (sel ? '70' : '48')); g.addColorStop(1, 'transparent')
          ctx.beginPath(); ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
        }

        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2)
        if (n.type === 'cat') {
          ctx.fillStyle = n.color + '22'; ctx.strokeStyle = n.color + 'dd'; ctx.lineWidth = 2
        } else if (n.type === 'task') {
          ctx.fillStyle = n.color + '70'; ctx.strokeStyle = n.urgent ? '#f85149' : n.color + 'cc'; ctx.lineWidth = n.urgent ? 1.5 : 0.8
        } else {
          ctx.fillStyle = n.color + 'bb'; ctx.strokeStyle = n.color; ctx.lineWidth = 1.2
        }
        ctx.fill(); ctx.stroke()

        if (n.type === 'proj' && n.emoji && r > 6) {
          ctx.font = `${Math.round(r * 1.4)}px serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(n.emoji, sx, sy)
        }

        // Categorienamen altijd; project- en taaknamen pas als er ruimte is
        const wantLabel = n.type === 'cat' || hov || sel || (showLabels && n.type === 'proj') || (v.zoom > 0.9 && n.type === 'task')
        if (!wantLabel) continue
        ctx.font = n.type === 'cat' ? 'bold 12px system-ui,sans-serif' : '11px system-ui,sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'
        ctx.fillStyle = n.type === 'cat' ? n.color : hov || sel ? '#e2e8f0' : 'rgba(203,213,225,.75)'
        const label = n.label.length > 34 ? n.label.slice(0, 34) + '…' : n.label
        ctx.fillText(label, sx, sy + r + 4)
      }
    }

    function loop() {
      // Alleen tekenen als er iets veranderd is — een stille kaart kost niets
      if (dirtyRef.current) { draw(); dirtyRef.current = false }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // ── Muis ────────────────────────────────────────────────────────────────
    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      if (dragging) {
        view.current.panX += mx - lastX
        view.current.panY += my - lastY
        dragDist += Math.abs(mx - lastX) + Math.abs(my - lastY)
        dirtyRef.current = true
      }
      lastX = mx; lastY = my
      const hit = nodeAt(mx, my)
      const id = hit?.id ?? null
      if (id !== hoveredId) { hoveredId = id; dirtyRef.current = true }
      canvas!.style.cursor = hoveredId ? 'pointer' : dragging ? 'grabbing' : 'grab'
    }
    function onDown(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      lastX = e.clientX - rect.left; lastY = e.clientY - rect.top
      dragging = true; dragDist = 0
      canvas!.style.cursor = 'grabbing'
    }
    function onUp() { dragging = false; canvas!.style.cursor = hoveredId ? 'pointer' : 'grab' }
    function onClick(e: MouseEvent) {
      if (dragDist > 6) return          // dit was pannen, geen klik
      // Niet op hoveredId vertrouwen: een klik zonder voorafgaande beweging
      // (aanwijsapparaat, automatisering) heeft nog geen hover gehad.
      const rect = canvas!.getBoundingClientRect()
      pickRef.current(nodeAt(e.clientX - rect.left, e.clientY - rect.top)?.id ?? null)
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = canvas!.getBoundingClientRect()
      const next = e.deltaY < 0 ? zoomIn(view.current.zoom) : zoomOut(view.current.zoom)
      view.current = zoomAround(view.current, next, e.clientX - rect.left, e.clientY - rect.top)
      setZoomLabel(Math.round(view.current.zoom * 100))
      dirtyRef.current = true
    }
    function onDouble(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      view.current = zoomAround(view.current, zoomIn(zoomIn(view.current.zoom)), e.clientX - rect.left, e.clientY - rect.top)
      setZoomLabel(Math.round(view.current.zoom * 100))
      dirtyRef.current = true
    }

    // ── Toetsenbord: + en − zoomen, 0 past alles in beeld, pijlen pannen ────
    function zoomBy(dir: 'in' | 'out') {
      const { w, h } = size()
      const next = dir === 'in' ? zoomIn(view.current.zoom) : zoomOut(view.current.zoom)
      view.current = zoomAround(view.current, next, w / 2, h / 2)
      setZoomLabel(Math.round(view.current.zoom * 100))
      dirtyRef.current = true
    }
    apiRef.current = { zoom: zoomBy, fit }

    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const action = zoomKeyAction(e.key)
      if (action) {
        e.preventDefault()
        if (action === 'reset') fit()
        else zoomBy(action)
        return
      }
      const step = 80
      if (e.key === 'ArrowLeft')  { view.current.panX += step; dirtyRef.current = true; e.preventDefault() }
      if (e.key === 'ArrowRight') { view.current.panX -= step; dirtyRef.current = true; e.preventDefault() }
      if (e.key === 'ArrowUp')    { view.current.panY += step; dirtyRef.current = true; e.preventDefault() }
      if (e.key === 'ArrowDown')  { view.current.panY -= step; dirtyRef.current = true; e.preventDefault() }
    }

    // ── Aanraken: slepen om te pannen, knijpen om te zoomen ─────────────────
    let pinchDist = 0
    function touchMid(t: TouchList) {
      const rect = canvas!.getBoundingClientRect()
      return { x: (t[0].clientX + t[1].clientX) / 2 - rect.left, y: (t[0].clientY + t[1].clientY) / 2 - rect.top }
    }
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 1) {
        const rect = canvas!.getBoundingClientRect()
        lastX = e.touches[0].clientX - rect.left; lastY = e.touches[0].clientY - rect.top
        dragging = true; dragDist = 0
      } else if (e.touches.length === 2) {
        pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 1 && dragging) {
        const rect = canvas!.getBoundingClientRect()
        const mx = e.touches[0].clientX - rect.left, my = e.touches[0].clientY - rect.top
        view.current.panX += mx - lastX; view.current.panY += my - lastY
        dragDist += Math.abs(mx - lastX) + Math.abs(my - lastY)
        lastX = mx; lastY = my; dirtyRef.current = true
        e.preventDefault()
      } else if (e.touches.length === 2 && pinchDist > 0) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
        const mid = touchMid(e.touches)
        view.current = zoomAround(view.current, clampZoom(view.current.zoom * (d / pinchDist)), mid.x, mid.y)
        pinchDist = d
        setZoomLabel(Math.round(view.current.zoom * 100))
        dirtyRef.current = true
        e.preventDefault()
      }
    }
    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length === 0) {
        if (dragging && dragDist <= 6) {
          const t = e.changedTouches[0]
          if (t) {
            const rect = canvas!.getBoundingClientRect()
            pickRef.current(nodeAt(t.clientX - rect.left, t.clientY - rect.top)?.id ?? null)
          }
        }
        dragging = false; pinchDist = 0
      }
    }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('dblclick', onDouble)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
    window.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('dblclick', onDouble)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
    }
  // De graaf zit in placedRef; opnieuw opzetten bij databewegingen is niet nodig
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const btn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,.14)',
    background: 'rgba(0,0,0,.45)', color: '#cbd5e1', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', display: 'grid', placeItems: 'center', lineHeight: 1,
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />

      {/* Ruimte laten voor de modusknoppen rechtsboven */}
      <div style={{ position: 'absolute', top: 16, left: 16, maxWidth: 'calc(100% - 300px)', fontSize: 11, color: 'rgba(255,255,255,.3)', pointerEvents: 'none', lineHeight: 1.9 }}>
        🖱 Sleep om te schuiven &nbsp;·&nbsp; <b style={{ color: 'rgba(255,255,255,.55)' }}>+ / −</b> om te zoomen &nbsp;·&nbsp; <b style={{ color: 'rgba(255,255,255,.55)' }}>0</b> voor overzicht &nbsp;·&nbsp; pijltjes om te schuiven
      </div>

      {/* Zoomknoppen — zelfde stap als de toetsen, voor als je liever klikt */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
        <button style={btn} onClick={() => apiRef.current?.zoom('in')}  title="Inzoomen (+)" aria-label="Inzoomen">+</button>
        <button style={btn} onClick={() => apiRef.current?.zoom('out')} title="Uitzoomen (−)" aria-label="Uitzoomen">−</button>
        <button style={{ ...btn, fontSize: 12 }} onClick={() => apiRef.current?.fit()} title="Alles in beeld (0)" aria-label="Alles in beeld">⤢</button>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{zoomLabel}%</div>
      </div>
    </div>
  )
}

/** Rasterlijnen die met de kaart mee schuiven — geeft gevoel voor afstand. */
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, v: { zoom: number; panX: number; panY: number }) {
  // Rasterstap verdubbelt bij uitzoomen, zodat er nooit een dichte brij ontstaat
  let stepWorld = 200
  while (stepWorld * v.zoom < 60)  stepWorld *= 2
  while (stepWorld * v.zoom > 240) stepWorld /= 2
  const step = stepWorld * v.zoom
  ctx.strokeStyle = 'rgba(129,140,248,.055)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = ((v.panX % step) + step) % step; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h) }
  for (let y = ((v.panY % step) + step) % step; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y) }
  ctx.stroke()
}

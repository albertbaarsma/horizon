'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task, Project, WeekItem, Achievement, RecurringTask, Goal, MoodEntry } from '@/lib/types'
import type { Lang } from '@/lib/lang'
import { ProductivityHeatmap } from './ProductivityHeatmap'
import { MapView2D } from './MapView2D'
import { TaskReviewPanel } from './TaskReviewPanel'
import { ConsistencyPanel, type FixAction } from './ConsistencyPanel'
import { UsagePanel } from './UsagePanel'
import { MoodChart } from './MoodChart'
import { ReportTab } from './ReportTab'
import FinanceClient from '../finance/FinanceClient'
import type { UsageEvent } from '@/lib/usage'
import { extractNoteLinks } from './ProjectsView'
import { reviewTasks, certainlyDoneIds } from '@/lib/task-freshness'
import { runChecks, type ItemKind } from '@/lib/consistency'
import {
  buildGraph, layout3D, visibleGraph, descendantsOf, childrenOf,
  INBOX_COLOR, VISIE_ID, ZOOM_MIN, ZOOM_MAX, zoomKeyAction,
  type GraphEdge, type Placed3D,
} from '@/lib/graph-layout'
import { CAT_COLORS } from '@/lib/category-colors'
import {
  loadStand, saveKnopen, wisAlles, pasStandToe, dichteKnopen, aantalVerplaatst,
  type Stand,
} from '@/lib/graph-positions'
import { createClient } from '@/lib/supabase'
import { horizonLabel } from '@/lib/goal-horizons'

type GEdge = GraphEdge
type Selected = { kind:'cat'|'proj'|'task'|'goal'; id:string } | null

type ViewMode = '3d' | '2d' | 'heatmap' | 'controle' | 'gebruik' | 'rapport' | 'financien' | 'stemming'

/** Knoop-id uit de graaf ('p-123') omzetten naar een selectie voor het paneel. */
export function selectionFromNodeId(id: string | null): Selected {
  if (!id) return null
  if (id.startsWith('p-')) return { kind: 'proj', id: id.slice(2) }
  if (id.startsWith('t-')) return { kind: 'task', id: id.slice(2) }
  if (id.startsWith('g-')) return { kind: 'goal', id: id.slice(2) }
  if (id.startsWith('c-')) return { kind: 'cat',  id: id.slice(2) }
  return null
}

/** En terug — zodat de kaart weet welke bol opgelicht moet zijn. */
export function nodeIdFromSelection(s: Selected): string | null {
  if (!s) return null
  const p = s.kind === 'proj' ? 'p' : s.kind === 'task' ? 't' : s.kind === 'goal' ? 'g' : 'c'
  return `${p}-${s.id}`
}

// ─── GraphTab ─────────────────────────────────────────────────────────────────

export function GraphTab({ projects, categories, tasks, weekItems, achievements, recurringTasks = [], goals = [], moodEntries = [], today, userId, lang = 'nl', onSelect, onSelectTask, onAddTask, onDeleteTask, onMarkTaskDone, onFixItem, lastCheck = null, onMarkChecked, usage, onFeature }: {
  projects:    Project[]
  categories:  { id: string; name: string; vision?: string }[]
  tasks:       Task[]
  weekItems:   WeekItem[]
  achievements: Achievement[]
  recurringTasks?: RecurringTask[]
  goals?:      Goal[]
  /** Voor de modus 'Stemming'. */
  moodEntries?: MoodEntry[]
  /** Voor de modus 'Rapport' — welke taal de "Geen API key"-melding daar toont. */
  lang?: Lang
  /** YYYY-MM-DD — voor de modus 'Stemming'. Zonder: geen grafiek (te weinig context om "vandaag" te bepalen). */
  today?:      string
  /** Nodig om je eigen indeling van de bol te bewaren, en voor de modus 'Financiën'. */
  userId?:     string
  onSelect:    (p: Project) => void
  onSelectTask?: (t: Task) => void
  /** Nieuwe taak in een project (of zonder project = inbox). */
  onAddTask?:    (name: string, projId: string | null) => Promise<Task | null>
  onDeleteTask?: (id: number) => void
  onMarkTaskDone?: (id: number) => void
  /** Iets rechtzetten dat uit elkaar liep — werkt door in alle tabs. */
  onFixItem?:    (kind: ItemKind, id: string, action: FixAction) => void
  lastCheck?:    string | null
  onMarkChecked?: () => void
  /** Meting van je eigen gebruik, voor de modus 'Gebruik'. */
  usage?: {
    events: UsageEvent[]
    tabs: string[]
    hiddenTabs: string[]
    startTab: string | null
    tracking: boolean
    onSetStartTab: (tab: string) => void
    onToggleHidden: (tab: string) => void
    onSetTracking: (aan: boolean) => void
    onClear: () => void
    /** Meting opnieuw ophalen — de laatste kliks staan nog in de buffer. */
    onOpen?: () => void
  }
  /** Elke moduswissel is zelf ook gebruik — dat meten we mee. */
  onFeature?: (key: string) => void
}) {
  // Pas een client maken als er echt iets te bewaren valt. Zonder userId (of in
  // een test) raakt deze weergave Supabase dus niet aan.
  const dbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const db = () => (dbRef.current ??= createClient())
  // 2D is de standaard: het leest rustiger dan de bol. Je keuze blijft staan.
  const [view, setView] = useState<ViewMode>('2d')
  const [selected, setSelected] = useState<Selected>(null)

  const [reviewOpen, setReviewOpen] = useState(false)
  const [ignored, setIgnored] = useState<number[]>([])
  const [ignoredKeys, setIgnoredKeys] = useState<string[]>([])
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('inzicht-modus')
    if (MODES.some(m => m.key === saved)) setView(saved as ViewMode)
    try { setIgnored(JSON.parse(localStorage.getItem('inzicht-nakijken-genegeerd') ?? '[]')) } catch { /* stuk? dan gewoon leeg */ }
    try { setIgnoredKeys(JSON.parse(localStorage.getItem('controle-genegeerd') ?? '[]')) } catch { /* idem */ }
  }, [])

  function ignore(id: number) {
    setIgnored(prev => {
      const next = [...new Set([...prev, id])]
      try { localStorage.setItem('inzicht-nakijken-genegeerd', JSON.stringify(next)) } catch { /* niet erg */ }
      return next
    })
  }

  function ignoreKey(key: string) {
    setIgnoredKeys(prev => {
      const next = [...new Set([...prev, key])]
      try { localStorage.setItem('controle-genegeerd', JSON.stringify(next)) } catch { /* niet erg */ }
      return next
    })
  }

  // Waar lopen de tabs uit elkaar? Zelfde data, één controle.
  const issues = useMemo(() => runChecks(
    { goals, projects, tasks, weekItems, recurringTasks, achievements }, ignoredKeys,
  ), [goals, projects, tasks, weekItems, recurringTasks, achievements, ignoredKeys])

  // Taken die volgens je weekplanning al afgevinkt zijn horen niet meer op de
  // kaart — die zag je hier onterecht als openstaand werk.
  const doneIds = useMemo(() => certainlyDoneIds(tasks, weekItems), [tasks, weekItems])
  const mapTasks = useMemo(() => tasks.filter(t => !doneIds.has(t.id)), [tasks, doneIds])

  const findings = useMemo(() => reviewTasks({
    tasks, weekItems, achievements, recurringTasks, now: new Date(),
  }).filter(f => !ignored.includes(f.task.id)), [tasks, weekItems, achievements, recurringTasks, ignored])

  // Del (of Backspace) verwijdert de geselecteerde taak — werkt in 2D en 3D.
  // Terughalen kan met Ctrl+Z via het balkje onderin, net als elders in de app.
  useEffect(() => {
    if (!onDeleteTask || selected?.kind !== 'task') return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      onDeleteTask!(Number(selected!.id))
      setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, onDeleteTask])
  function pickView(m: ViewMode) {
    setView(m)
    onFeature?.(`inzicht-${m}`)
    // De net-geklikte regels staan nog in de buffer; even ophalen
    if (m === 'gebruik') setTimeout(() => usage?.onOpen?.(), 50)
    try { localStorage.setItem('inzicht-modus', m) } catch { /* privémodus: dan onthouden we het niet */ }
  }

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectRef    = useRef(setSelected)
  useEffect(() => { selectRef.current = setSelected }, [])

  // ── De boom van je leven ────────────────────────────────────────────────
  // Visie → levensgebied → doel/project → sub-project → taak. Eén samenhangende
  // boom, want zo ontstaat het ook: uit je visie komen je gebieden, daaruit je
  // doelen en projecten, en daaruit het werk van vandaag.
  const graph3D = useMemo(
    () => buildGraph(categories, projects, mapTasks, { goals, visieWortel: true }),
    [categories, projects, mapTasks, goals],
  )

  // De berekende plek van elke knoop. Deterministisch: dezelfde boom geeft
  // altijd exact dezelfde bol, dus je herkent hem elke keer dat je hem opent.
  const basisPlekken = useMemo(() => layout3D(graph3D), [graph3D])

  const [stand, setStand] = useState<Stand>({})
  const [standGeladen, setStandGeladen] = useState(false)

  useEffect(() => {
    if (!userId) { setStandGeladen(true); return }
    let levend = true
    loadStand(db(), userId)
      .then(s => { if (levend) { setStand(s); setStandGeladen(true) } })
      // Lukt het ophalen niet, toon dan gewoon de berekende indeling in plaats
      // van een leeg scherm — je eigen plekken zijn niet kwijt, alleen even niet zichtbaar.
      .catch(() => { if (levend) setStandGeladen(true) })
    return () => { levend = false }
  }, [userId])

  const dicht = useMemo(() => dichteKnopen(stand), [stand])
  const verplaatst = aantalVerplaatst(stand)

  /** Een tak open- of dichtklappen. */
  function toggleTak(id: string) {
    const nu = !!stand[id]?.collapsed
    onFeature?.('inzicht-inklappen')
    setStand(prev => ({ ...prev, [id]: { ...prev[id], collapsed: !nu } }))
    if (userId) saveKnopen(db(), userId, [{ node_id: id, ...stand[id], collapsed: !nu }])
  }

  /** Alles terug naar de berekende indeling. */
  async function herstelIndeling() {
    onFeature?.('inzicht-indeling-herstellen')
    const bewaard = stand
    setStand({})
    if (userId && !(await wisAlles(db(), userId))) setStand(bewaard)
  }

  // De camera leeft buiten het teken-effect, zodat je blik niet terugspringt
  // zodra er ergens een taak bij komt.
  const camRef = useRef({ yaw: 0.5, pitch: -0.25, zoom: 1, panX: 0, panY: 0 })

  useEffect(() => {
    if (view !== '3d' || !standGeladen) return

    const canvas = canvasRef.current!
    const cont   = containerRef.current!
    if (!canvas || !cont) return

    const edges: GEdge[] = graph3D.edges
    let running = true
    let raf = 0
    let vuil = true                       // alleen tekenen als er iets veranderd is

    function resize() { canvas.width = cont.clientWidth; canvas.height = cont.clientHeight; vuil = true }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(cont)

    // ── Wat er nu te zien is: berekende plekken, jouw aanpassingen eroverheen,
    //    en alles onder een dichtgeklapte tak weggelaten.
    let plekken: Placed3D[] = []
    let zichtbaar = graph3D
    function herbereken() {
      zichtbaar = visibleGraph(graph3D, dicht)
      const zicht = new Set(zichtbaar.nodes.map(n => n.id))
      // Kopieën: bij het slepen verschuiven we deze punten, en de berekende
      // indeling mag daar niet door veranderen — die is het thuis om naar terug te kunnen.
      plekken = pasStandToe(basisPlekken, stand).filter(n => zicht.has(n.id)).map(n => ({ ...n }))
      vuil = true
    }
    herbereken()

    // ── Camera: orthografisch. Diepte bepaalt de volgorde en de schaduw, maar
    //    vergroot niets — anders zwelt de tak die naar je toe draait op en
    //    verdwijnt de rest, en dat maakt de bol onrustig.
    function project(w: { x:number; y:number; z:number }) {
      const c = camRef.current
      const cy = Math.cos(c.yaw),   sy = Math.sin(c.yaw)
      const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch)
      const x1 = w.x * cy - w.z * sy
      const z1 = w.x * sy + w.z * cy
      const y1 = w.y * cp - z1 * sp
      const z2 = w.y * sp + z1 * cp
      return { sx: x1 * c.zoom + c.panX + canvas.width / 2, sy: y1 * c.zoom + c.panY + canvas.height / 2, depth: z2 }
    }

    /** Een verschuiving op het scherm terug naar de wereld, in het beeldvlak. */
    function schermNaarWereld(dsx: number, dsy: number) {
      const c = camRef.current
      const a = dsx / c.zoom, b = dsy / c.zoom
      const cy = Math.cos(c.yaw),   sy = Math.sin(c.yaw)
      const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch)
      return { x: a * cy - b * sp * sy, y: b * cp, z: -a * sy - b * sp * cy }
    }

    function toHex2(n:number) { return Math.round(n).toString(16).padStart(2,'0') }

    let hoveredId: string|null = null
    let sleepId: string|null = null          // knoop die je verplaatst
    let sleepTak: string[] = []              // en alles wat eronder hangt
    let draaien = false
    let sleepAfstand = 0
    let lastMX = 0, lastMY = 0

    function draw() {
      const ctx=canvas.getContext('2d')!
      ctx.clearRect(0,0,canvas.width,canvas.height)
      ctx.fillStyle='#070c14'; ctx.fillRect(0,0,canvas.width,canvas.height)

      ctx.fillStyle='rgba(255,255,255,.10)'
      for (let i=0;i<80;i++) {
        const sx=(Math.sin(i*37.5)*0.5+0.5)*canvas.width
        const sy=(Math.cos(i*73.1)*0.5+0.5)*canvas.height
        ctx.beginPath(); ctx.arc(sx,sy,i%17===0?1.4:.5,0,Math.PI*2); ctx.fill()
      }

      const pts = plekken.map(n => ({ ...project(n), node:n }))
      pts.sort((a,b) => a.depth-b.depth)
      const opScherm = new Map(pts.map(p => [p.node.id, p]))

      for (const e of zichtbaar.edges) {
        const f=opScherm.get(e.from), t=opScherm.get(e.to)
        if (!f||!t) continue
        const naarVisie = e.to === VISIE_ID
        const isTaskEdge = e.from.startsWith('t-')
        const alpha=Math.max(.05, (naarVisie ? .38 : isTaskEdge ? .16 : .25)-Math.abs(f.depth+t.depth)*.00008)
        ctx.beginPath(); ctx.moveTo(f.sx,f.sy); ctx.lineTo(t.sx,t.sy)
        ctx.strokeStyle = naarVisie ? `rgba(196,181,253,${alpha})` : `rgba(99,102,241,${alpha})`
        ctx.lineWidth = naarVisie ? 1.1 : isTaskEdge ? .5 : .8
        ctx.stroke()
      }

      for (const pt of pts) {
        const n=pt.node
        const fade=Math.max(.3, 1-Math.max(0, pt.depth)*.0009)
        const hov=hoveredId===n.id
        const r = n.type==='visie' ? n.r : n.type==='cat' ? n.r*1.3 : n.r
        const takDicht = dicht.has(n.id)

        if (hov || n.type==='visie') {
          const g=ctx.createRadialGradient(pt.sx,pt.sy,r,pt.sx,pt.sy,r*3.5)
          g.addColorStop(0,n.color+(hov?'50':'26')); g.addColorStop(1,'transparent')
          ctx.beginPath(); ctx.arc(pt.sx,pt.sy,r*3.5,0,Math.PI*2); ctx.fillStyle=g; ctx.fill()
        }

        ctx.beginPath(); ctx.arc(pt.sx,pt.sy,r,0,Math.PI*2)
        if (n.type==='visie') {
          ctx.fillStyle=n.color+toHex2(fade*40)
          ctx.strokeStyle=n.color+toHex2(fade*255); ctx.lineWidth=2.5
        } else if (n.type==='cat') {
          ctx.fillStyle=n.color+toHex2(fade*30)
          ctx.strokeStyle=n.color+toHex2(fade*220); ctx.lineWidth=2
        } else if (n.type==='goal') {
          // Een doel is een ruit, zodat je hem meteen onderscheidt van een project
          ctx.closePath()
          ctx.beginPath()
          ctx.moveTo(pt.sx, pt.sy-r*1.35); ctx.lineTo(pt.sx+r*1.35, pt.sy)
          ctx.lineTo(pt.sx, pt.sy+r*1.35); ctx.lineTo(pt.sx-r*1.35, pt.sy); ctx.closePath()
          ctx.fillStyle = n.done ? n.color+toHex2(fade*60) : n.color+toHex2(fade*150)
          ctx.strokeStyle=n.color+toHex2(fade*240); ctx.lineWidth=1.4
        } else if (n.type==='task') {
          ctx.fillStyle=n.color+toHex2(fade*110)
          ctx.strokeStyle=n.urgent ? '#f85149' : n.color+toHex2(fade*200)
          ctx.lineWidth=n.urgent?1.5:.8
        } else {
          ctx.fillStyle=n.color+toHex2(fade*190)
          ctx.strokeStyle=n.color+toHex2(fade*255); ctx.lineWidth=1
        }
        ctx.fill(); ctx.stroke()

        if (n.type==='proj' && n.emoji) {
          ctx.font=`${Math.round(r*1.5)}px serif`
          ctx.textAlign='center'; ctx.textBaseline='middle'
          ctx.fillText(n.emoji,pt.sx,pt.sy)
        }

        // Dichtgeklapte tak: laat zien hoeveel eronder zit
        if (takDicht) {
          const verborgen = descendantsOf(graph3D.edges, n.id).length
          if (verborgen > 0) {
            const bx = pt.sx + r + 7, by = pt.sy - r - 2
            ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI*2)
            ctx.fillStyle='rgba(7,12,20,.9)'; ctx.fill()
            ctx.strokeStyle=n.color+'aa'; ctx.lineWidth=1; ctx.stroke()
            ctx.font='bold 9px system-ui,sans-serif'
            ctx.textAlign='center'; ctx.textBaseline='middle'
            ctx.fillStyle=n.color
            ctx.fillText(String(verborgen > 99 ? '99+' : verborgen), bx, by)
          }
        }

        const toonLabel = n.type==='visie' || n.type==='cat' || hov || takDicht
        if (toonLabel) {
          ctx.font = n.type==='visie' ? 'bold 12px system-ui,sans-serif'
            : n.type==='cat' ? 'bold 11px system-ui,sans-serif' : '11px system-ui,sans-serif'
          ctx.textAlign='center'; ctx.textBaseline='top'
          ctx.fillStyle = n.type==='cat' || n.type==='visie'
            ? n.color+toHex2(fade*230)
            : 'rgba(226,232,240,'+fade+')'
          const label = n.label.length > 42 ? n.label.slice(0, 42)+'…' : n.label
          ctx.fillText(label,pt.sx,pt.sy+r+5)
        }
      }
    }

    function loop() {
      if (!running) return
      if (vuil) { draw(); vuil = false }
      raf=requestAnimationFrame(loop)
    }
    // Eerst tekenen, dan pas de lus. Anders blijft het scherm leeg tot het eerste
    // frame — en dat kan lang duren als het tabblad op de achtergrond staat.
    draw(); vuil = false
    raf=requestAnimationFrame(loop)

    function knoopOp(mx: number, my: number): string|null {
      // Van voor naar achter zoeken, zodat je pakt wat je ziet
      const pts = plekken.map(n => ({ ...project(n), node:n })).sort((a,b) => b.depth-a.depth)
      for (const p of pts) {
        const r = p.node.type==='cat' ? p.node.r*1.3 : p.node.r
        if (Math.hypot(p.sx-mx, p.sy-my) <= r+6) return p.node.id
      }
      return null
    }

    function onMove(e: MouseEvent) {
      const rect=canvas.getBoundingClientRect()
      const mx=e.clientX-rect.left, my=e.clientY-rect.top
      const dx=mx-lastMX, dy=my-lastMY

      if (sleepId) {
        // De knoop schuift mee in het beeldvlak, met zijn hele tak eronder
        const d = schermNaarWereld(dx, dy)
        for (const id of [sleepId, ...sleepTak]) {
          const n = plekken.find(p => p.id === id)
          if (n) { n.x += d.x; n.y += d.y; n.z += d.z }
        }
        sleepAfstand += Math.abs(dx)+Math.abs(dy)
        vuil = true
      } else if (draaien) {
        const c = camRef.current
        c.yaw += dx*.006; c.pitch += dy*.006
        sleepAfstand += Math.abs(dx)+Math.abs(dy)
        vuil = true
      }
      lastMX=mx; lastMY=my

      const nieuwHover = sleepId || draaien ? hoveredId : knoopOp(mx, my)
      if (nieuwHover !== hoveredId) { hoveredId = nieuwHover; vuil = true }
      canvas.style.cursor = sleepId ? 'grabbing' : draaien ? 'move' : hoveredId ? 'grab' : 'default'
    }

    function onDown(e: MouseEvent) {
      const rect=canvas.getBoundingClientRect()
      lastMX=e.clientX-rect.left; lastMY=e.clientY-rect.top
      sleepAfstand = 0
      const raak = knoopOp(lastMX, lastMY)
      if (raak) {
        sleepId  = raak
        sleepTak = descendantsOf(zichtbaar.edges, raak)
        canvas.style.cursor='grabbing'
      } else {
        draaien = true
        canvas.style.cursor='move'
      }
    }

    function onUp() {
      if (sleepId && sleepAfstand > 4 && userId) {
        // Vastleggen waar je hem hebt neergezet — de tak gaat mee
        const ids = [sleepId, ...sleepTak]
        const rijen = ids
          .map(id => plekken.find(p => p.id === id))
          .filter((n): n is Placed3D => !!n)
          .map(n => ({ node_id: n.id, x: n.x, y: n.y, z: n.z, collapsed: !!stand[n.id]?.collapsed }))
        saveKnopen(db(), userId, rijen)
        setStand(prev => {
          const next = { ...prev }
          for (const r of rijen) next[r.node_id] = { ...next[r.node_id], x: r.x, y: r.y, z: r.z }
          return next
        })
      }
      sleepId = null; sleepTak = []; draaien = false
      canvas.style.cursor = hoveredId ? 'grab' : 'default'
    }

    function onClick() {
      if (sleepAfstand > 6) return   // dit was slepen of draaien, geen klik
      selectRef.current(selectionFromNodeId(hoveredId))
    }

    function onDouble(e: MouseEvent) {
      e.preventDefault()
      if (!hoveredId) return
      // Alleen zin als er iets ónder hangt
      if (childrenOf(graph3D.edges, hoveredId).length === 0) return
      toggleTak(hoveredId)
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const c = camRef.current
      c.zoom=Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,c.zoom-e.deltaY*.0012))
      vuil = true
    }
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.isContentEditable)) return
      const action = zoomKeyAction(e.key)
      if (!action) return
      e.preventDefault()
      const c = camRef.current
      if (action==='reset') { c.zoom=1; c.yaw=0.5; c.pitch=-0.25; c.panX=0; c.panY=0 }
      else c.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, action==='in' ? c.zoom*1.25 : c.zoom/1.25))
      vuil = true
    }

    canvas.addEventListener('mousemove',onMove)
    canvas.addEventListener('mousedown',onDown)
    window.addEventListener('mouseup',  onUp)
    canvas.addEventListener('click',    onClick)
    canvas.addEventListener('dblclick', onDouble)
    canvas.addEventListener('wheel',    onWheel, {passive:false})
    window.addEventListener('keydown',  onKey)

    return () => {
      running=false; cancelAnimationFrame(raf); ro.disconnect()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('mousemove',onMove)
      canvas.removeEventListener('mousedown',onDown)
      canvas.removeEventListener('click',    onClick)
      canvas.removeEventListener('dblclick', onDouble)
      canvas.removeEventListener('wheel',    onWheel)
    }
  // De camera leeft in camRef, dus opnieuw opbouwen kost je je blik niet
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, graph3D, basisPlekken, stand, dicht, standGeladen, userId])

  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection: isMobile ? 'column' : 'row' }}>
      {/* Weergavemodus: sidebar op desktop, horizontale pillenrij op mobiel
          (zelfde conversie als Visie/Wins/Overige) — elke modus houdt zijn
          eigen kleur. */}
      {isMobile ? (
        <div style={{ flexShrink:0, overflowX:'auto', padding:'8px 12px', display:'flex', gap:6, scrollbarWidth:'none', borderBottom:'1px solid var(--border)' }}>
          {MODES.map(m => (
            <button key={m.key} onClick={() => pickView(m.key)} title={m.hint}
              style={{ flexShrink:0, padding:'6px 12px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500, whiteSpace:'nowrap',
                border:`1px solid ${view===m.key ? `${m.color}80` : 'var(--border)'}`,
                color: view===m.key ? m.color : 'var(--muted)',
                background: view===m.key ? `${m.color}1f` : 'var(--bg)' }}>
              {m.label}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ width:188, flexShrink:0, background:'var(--bg2)', borderRight:'1px solid var(--border)', overflowY:'auto', padding:'6px 0' }}>
          <div style={{ padding:'8px 12px 4px', fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'var(--dim)' }}>Weergave</div>
          {MODES.map(m => (
            <div key={m.key} onClick={() => pickView(m.key)} title={m.hint}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:500,
                color: view===m.key ? m.color : 'var(--muted)',
                borderLeft: `2px solid ${view===m.key ? m.color : 'transparent'}`,
                background: view===m.key ? `${m.color}1f` : 'transparent' }}>
              {m.label}
            </div>
          ))}
        </div>
      )}

      <div ref={containerRef} style={{ flex:1, height:'100%', position:'relative', overflow: view === 'heatmap' ? 'auto' : 'hidden' }}>
      {/* Bijwerken: taken die niet meer kloppen met wat je hebt vastgelegd */}
      {(view === '2d' || view === '3d') && onMarkTaskDone && findings.length > 0 && !reviewOpen && (
        <button onClick={() => setReviewOpen(true)}
          style={{ position:'absolute', bottom:16, right:16, zIndex:30, display:'flex', alignItems:'center', gap:7,
            padding:'7px 12px', borderRadius:9, cursor:'pointer',
            border:'1px solid rgba(210,153,34,.45)', background:'rgba(210,153,34,.14)', color:'#e3b341',
            fontSize:11.5, fontWeight:600 }}>
          🧹 {findings.length} taken nakijken
        </button>
      )}
      {(view === '2d' || view === '3d') && reviewOpen && (
        <TaskReviewPanel
          findings={findings}
          onMarkDone={id => onMarkTaskDone?.(id)}
          onDelete={id => onDeleteTask?.(id)}
          onIgnore={ignore}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {view === '2d' && (
        <>
          <MapView2D
            categories={categories} projects={projects} tasks={mapTasks}
            selectedId={nodeIdFromSelection(selected)}
            onPickNode={id => setSelected(selectionFromNodeId(id))}
          />
          {selected && (
            <GraphDetailPanel
              selected={selected}
              projects={projects} categories={categories} tasks={tasks} weekItems={weekItems} goals={goals}
              onClose={() => setSelected(null)}
              onPick={setSelected}
              onOpenProject={onSelect}
              onOpenTask={onSelectTask}
              onAddTask={onAddTask}
              onDeleteTask={onDeleteTask}
            />
          )}
        </>
      )}

      {view === '3d' && (
        <>
          <canvas ref={canvasRef} style={{ display:'block', width:'100%', height:'100%' }} />
          <div style={{ position:'absolute', top:16, left:16, maxWidth:'calc(100% - 300px)', fontSize:11, color:'rgba(255,255,255,.25)', pointerEvents:'none', lineHeight:1.9 }}>
            🖱 Sleep het lege veld om te draaien &nbsp;·&nbsp; sleep een bol om hem te verzetten &nbsp;·&nbsp; <b style={{ color:'rgba(255,255,255,.5)' }}>dubbelklik</b> klapt een tak in
            <br />
            <b style={{ color:'rgba(255,255,255,.5)' }}>+ / −</b> zoomen &nbsp;·&nbsp; <b style={{ color:'rgba(255,255,255,.5)' }}>0</b> voor de beginstand &nbsp;·&nbsp; klik een bol voor details
          </div>
          {(verplaatst > 0 || dicht.size > 0) && (
            <button onClick={herstelIndeling}
              title="Alles terug naar de berekende plek, en alle takken weer open"
              style={{ position:'absolute', bottom:16, left:16, zIndex:30, padding:'6px 12px', borderRadius:8, cursor:'pointer',
                border:'1px solid rgba(255,255,255,.14)', background:'rgba(0,0,0,.45)', color:'rgba(255,255,255,.55)', fontSize:11 }}>
              ↺ Indeling herstellen
              <span style={{ color:'rgba(255,255,255,.3)', marginLeft:6 }}>
                {verplaatst > 0 && `${verplaatst} verzet`}
                {verplaatst > 0 && dicht.size > 0 && ' · '}
                {dicht.size > 0 && `${dicht.size} dicht`}
              </span>
            </button>
          )}
          <div style={{ position:'absolute', top:48, right:12, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end', maxWidth:260 }}>
            {categories.map((cat,i) => (
              <span key={cat.id} style={{ fontSize:10, padding:'2px 8px', borderRadius:6, border:`1px solid ${CAT_COLORS[i%CAT_COLORS.length]}40`, color:CAT_COLORS[i%CAT_COLORS.length], background:`${CAT_COLORS[i%CAT_COLORS.length]}12` }}>
                {cat.name}
              </span>
            ))}
          </div>
          {selected && (
            <GraphDetailPanel
              selected={selected}
              projects={projects} categories={categories} tasks={tasks} weekItems={weekItems} goals={goals}
              onClose={() => setSelected(null)}
              onPick={setSelected}
              onOpenProject={onSelect}
              onOpenTask={onSelectTask}
              onAddTask={onAddTask}
              onDeleteTask={onDeleteTask}
            />
          )}
        </>
      )}

      {view === 'heatmap' && <ProductivityHeatmap weekItems={weekItems} achievements={achievements} />}

      {view === 'stemming' && (
        <div style={{ position:'absolute', inset:0, overflowY:'auto', padding:20 }}>
          <div style={{ maxWidth:760, margin:'0 auto' }}>
            <MoodChart entries={moodEntries} today={today ?? new Date().toISOString().slice(0,10)} />
          </div>
        </div>
      )}

      {view === 'rapport' && <ReportTab lang={lang} />}

      {view === 'financien' && userId && <FinanceClient userId={userId} embedded />}

      {view === 'gebruik' && usage && (
        <UsagePanel
          events={usage.events} tabs={usage.tabs} hiddenTabs={usage.hiddenTabs}
          startTab={usage.startTab} tracking={usage.tracking}
          onSetStartTab={usage.onSetStartTab} onToggleHidden={usage.onToggleHidden}
          onSetTracking={usage.onSetTracking} onClear={usage.onClear}
        />
      )}

      {view === 'controle' && onFixItem && (
        <ConsistencyPanel
          full
          issues={issues}
          lastCheck={lastCheck}
          now={new Date()}
          onFix={onFixItem}
          onIgnore={ignoreKey}
          onMarkChecked={() => onMarkChecked?.()}
          onClose={() => pickView('2d')}
        />
      )}
      </div>
    </div>
  )
}

const MODES: { key: ViewMode; label: string; color: string; hint: string }[] = [
  { key: '3d',      label: '🌌 3D bol',   color: '#818cf8', hint: 'Je leven als zwevend netwerk — draaien met slepen' },
  { key: '2d',      label: '🗺 2D kaart', color: '#38bdf8', hint: 'Uitgespreid over een grote kaart — schuiven en zoomen met + en −' },
  { key: 'heatmap', label: '🔥 Heatmap',  color: '#39d353', hint: 'Wat je per dag hebt afgemaakt' },
  { key: 'stemming', label: '📈 Stemming', color: '#a5b4fc', hint: 'Je mood door de tijd — patronen zien die een dag niet laat zien' },
  { key: 'rapport', label: '🎧 Rapport',  color: '#34d399', hint: 'Week- en maandrapport — voor te lezen' },
  { key: 'financien', label: '💰 Financiën', color: '#fbbf24', hint: 'Wie is jou wat schuldig, uitgaven per categorie, zakgeld' },
  { key: 'controle', label: '🔍 Controle', color: '#e3b341', hint: 'Waar doelen, projecten, taken en planning uit elkaar lopen' },
  { key: 'gebruik',  label: '📈 Gebruik',  color: '#58a6ff', hint: 'Wat je echt gebruikt, en wat blijft liggen' },
]

// ─── GraphDetailPanel — rechter slide-paneel met details ─────────────────────

const STATUS_COLORS: Record<string, string> = {
  actief: '#3fb950', lopend: '#58a6ff', urgent: '#f85149',
  soon: '#d29922', visie: '#bc8cff', slapend: '#484f58',
  onzeker: '#fb8f44', love: '#f778ba', archief: '#6e7681',
  backlog: '#484f58', doing: '#58a6ff', waiting: '#d29922', done: '#3fb950',
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:`${color}18`, border:`1px solid ${color}40`, color, whiteSpace:'nowrap' }}>
      {text}
    </span>
  )
}

function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:'#475569', marginBottom:6 }}>{label}</div>
      {children}
    </div>
  )
}

export function GraphDetailPanel({ selected, projects, categories, tasks, weekItems, goals = [], onClose, onPick, onOpenProject, onOpenTask, onAddTask, onDeleteTask }: {
  selected: NonNullable<Selected>
  projects: Project[]
  categories: { id: string; name: string; vision?: string }[]
  tasks: Task[]
  weekItems: WeekItem[]
  goals?: Goal[]
  onClose: () => void
  onPick: (s: Selected) => void
  onOpenProject: (p: Project) => void
  onOpenTask?: (t: Task) => void
  onAddTask?: (name: string, projId: string | null) => Promise<Task | null>
  onDeleteTask?: (id: number) => void
}) {
  const panelStyle: React.CSSProperties = {
    position:'absolute', top:0, right:0, bottom:0, width:340, maxWidth:'88%',
    background:'rgba(13,17,23,.97)', borderLeft:'1px solid rgba(99,102,241,.25)',
    overflowY:'auto', padding:'18px 18px 24px', display:'flex', flexDirection:'column', gap:14,
    // Boven de modusknoppen, anders staan die over de kop van het paneel
    animation:'slideInRight .18s ease-out', zIndex:40,
  }
  const closeBtn = (
    <button onClick={onClose} aria-label="Paneel sluiten"
      style={{ background:'none', border:'none', color:'#64748b', fontSize:18, cursor:'pointer', padding:'0 4px', lineHeight:1 }}>×</button>
  )

  // ── Doel ──────────────────────────────────────────────────────────────────
  // Een doel staat tussen je levensgebied en het werk dat eruit voortkomt:
  // vanaf hier zie je meteen in welk gebied het hangt en welke projecten
  // daar hun werk doen.
  if (selected.kind === 'goal') {
    const g = goals.find(x => String(x.id) === selected.id)
    if (!g) return null
    const cat = g.cat_id ? categories.find(c => c.id === g.cat_id) : null
    const catProjects = cat ? projects.filter(p => p.cat_id === cat.id && p.status !== 'archief') : []
    return (
      <div style={panelStyle}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.8px', textTransform:'uppercase', color:'#3fb950', marginBottom:6 }}>
              {horizonLabel(g.horizon)}
            </div>
            <div style={{ fontSize:15, fontWeight:700, lineHeight:1.4, color: g.done ? '#64748b' : '#e2e8f0', textDecoration: g.done ? 'line-through' : 'none' }}>
              {g.text}
            </div>
          </div>
          {closeBtn}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {g.done && <Pill text="✓ gehaald" color="#3fb950" />}
          {g.deadline && <Pill text={`📅 ${g.deadline}`} color="#d29922" />}
          {cat
            ? <button onClick={() => onPick({ kind:'cat', id: cat.id })} title={`Naar ${cat.name}`}
                style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(129,140,248,.09)', border:'1px solid rgba(129,140,248,.28)', color:'#818cf8', cursor:'pointer', whiteSpace:'nowrap' }}>
                {cat.name} ↗
              </button>
            : <Pill text="hangt aan je visie" color="#c4b5fd" />}
        </div>
        {catProjects.length > 0 && (
          <PanelSection label={`Projecten in ${cat!.name}`}>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {catProjects.map(p => (
                <button key={p.id} onClick={() => onPick({ kind:'proj', id: p.id })}
                  style={{ textAlign:'left', fontSize:12, padding:'6px 9px', borderRadius:6, cursor:'pointer',
                    background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', color:'#94a3b8' }}>
                  {p.emoji} {p.name}
                </button>
              ))}
            </div>
          </PanelSection>
        )}
      </div>
    )
  }

  // ── Taak ──────────────────────────────────────────────────────────────────
  if (selected.kind === 'task') {
    const t = tasks.find(x => String(x.id) === selected.id)
    if (!t) return null
    const proj = t.proj_id ? projects.find(p => p.id === t.proj_id) : null
    const subs = t.subtasks ?? []
    const planned = weekItems.filter(w => w.task_id === String(t.id) || (w.text === t.name && !w.done))
    return (
      <div style={panelStyle} role="complementary" aria-label={`Taak: ${t.name}`}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <span style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:'.06em' }}>○ Taak</span>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            {/* Bovenaan, want onderin verdween de knop achter de AI-bol */}
            {onDeleteTask && (
              <button onClick={() => { onDeleteTask(t.id); onClose() }} aria-label="Taak verwijderen" title="Taak verwijderen (Del)"
                style={{ fontSize:12, padding:'3px 8px', borderRadius:6, border:'1px solid rgba(248,81,73,.35)', background:'rgba(248,81,73,.1)', color:'#f85149', cursor:'pointer' }}>
                🗑 Verwijderen
              </button>
            )}
            {closeBtn}
          </div>
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:'#f1f5f9', lineHeight:1.35 }}>{t.name}</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <Pill text={t.status} color={STATUS_COLORS[t.status] ?? '#94a3b8'} />
          {t.urgent && <Pill text="⚡ urgent" color="#f85149" />}
          {t.duration_min ? <Pill text={`⏱ ${t.duration_min}m gepland`} color="#818cf8" /> : null}
          {(t.actual_min ?? 0) > 0 && <Pill text={`▶ ${t.actual_min}m gewerkt`} color="#3fb950" />}
        </div>
        {proj ? (
          <PanelSection label="Project">
            <button onClick={() => onPick({ kind:'proj', id: proj.id })}
              style={{ fontSize:12, background:'rgba(99,102,241,.08)', border:'1px solid rgba(99,102,241,.25)', borderRadius:7, padding:'6px 10px', color:'#c7d2fe', cursor:'pointer', textAlign:'left', width:'100%' }}>
              {proj.emoji} {proj.name}
            </button>
          </PanelSection>
        ) : (
          <PanelSection label="Project"><Pill text="📥 inbox — nog geen project" color={INBOX_COLOR} /></PanelSection>
        )}
        {subs.length > 0 && (
          <PanelSection label={`Subtaken (${subs.filter(s=>s.done).length}/${subs.length})`}>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {subs.map((s, i) => (
                <div key={i} style={{ fontSize:12, color: s.done ? '#4b5563' : '#cbd5e1', textDecoration: s.done ? 'line-through' : 'none' }}>
                  {s.done ? '☑' : '☐'} {s.text}
                </div>
              ))}
            </div>
          </PanelSection>
        )}
        {t.notes && (
          <PanelSection label="Notities">
            <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{t.notes.slice(0, 400)}{t.notes.length > 400 ? '…' : ''}</div>
          </PanelSection>
        )}
        {planned.length > 0 && (
          <PanelSection label="Ingepland">
            <div style={{ fontSize:12, color:'#94a3b8' }}>{planned[0].date}{planned[0].time_block ? ` om ${planned[0].time_block}` : ''}</div>
          </PanelSection>
        )}
        <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:6 }}>
          {onOpenTask && (
            <button onClick={() => onOpenTask(t)}
              style={{ fontSize:12, fontWeight:600, padding:'9px 14px', borderRadius:8, border:'none', background:'#4f46e5', color:'#fff', cursor:'pointer' }}>
              Open taak →
            </button>
          )}
          {onDeleteTask && (
            <div style={{ fontSize:10, color:'#475569' }}>Del verwijdert deze taak · Ctrl+Z zet hem terug</div>
          )}
        </div>
      </div>
    )
  }

  // ── Project ───────────────────────────────────────────────────────────────
  if (selected.kind === 'proj') {
    const p = projects.find(x => x.id === selected.id)
    if (!p) return null
    const pt   = tasks.filter(t => t.proj_id === p.id)
    const open = pt.filter(t => t.status !== 'done')
    const cat  = categories.find(c => c.id === p.cat_id)
    const links = extractNoteLinks(p.notes ?? '')
    return (
      <div style={panelStyle} role="complementary" aria-label={`Project: ${p.name}`}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <span style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:'.06em' }}>🗂 Project{cat ? ` · ${cat.name}` : ''}</span>
          {closeBtn}
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:'#f1f5f9', lineHeight:1.35 }}>{p.emoji} {p.name}</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <Pill text={p.status} color={STATUS_COLORS[p.status] ?? '#94a3b8'} />
          {p.is_priority && <Pill text="⭐ prioriteit" color="#fbbf24" />}
          <Pill text={`${pt.length - open.length}/${pt.length} taken klaar`} color="#3fb950" />
        </div>
        {p.description && (
          <PanelSection label="Doel">
            <div style={{ fontSize:12, color:'#cbd5e1', lineHeight:1.6 }}>{p.description}</div>
          </PanelSection>
        )}
        {p.vision && (
          <PanelSection label="Visie">
            <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.6 }}>{p.vision.slice(0, 300)}{p.vision.length > 300 ? '…' : ''}</div>
          </PanelSection>
        )}
        {open.length > 0 && (
          <PanelSection label={`Open taken (${open.length})`}>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {open.slice(0, 8).map(t => (
                <button key={t.id} onClick={() => onPick({ kind:'task', id: String(t.id) })}
                  style={{ fontSize:12, textAlign:'left', background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:6, padding:'5px 9px', color: t.urgent ? '#fca5a5' : '#cbd5e1', cursor:'pointer' }}>
                  {t.urgent ? '⚡ ' : '○ '}{t.name}
                </button>
              ))}
              {open.length > 8 && <div style={{ fontSize:10, color:'#4b5563' }}>…nog {open.length - 8}</div>}
            </div>
          </PanelSection>
        )}
        {onAddTask && (
          <PanelSection label="Taak toevoegen">
            <QuickAddTask key={p.id} projects={[p]} defaultProjId={p.id} onAdd={onAddTask} />
          </PanelSection>
        )}
        {links.length > 0 && (
          <PanelSection label="Documenten">
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:11, color:'#60a5fa', textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {l.label.toLowerCase().startsWith('map') ? '📁' : '📄'} {l.label}
                </a>
              ))}
            </div>
          </PanelSection>
        )}
        <button onClick={() => onOpenProject(p)}
          style={{ marginTop:'auto', fontSize:12, fontWeight:600, padding:'9px 14px', borderRadius:8, border:'none', background:'#4f46e5', color:'#fff', cursor:'pointer' }}>
          Open project →
        </button>
      </div>
    )
  }

  // ── Categorie / inbox ─────────────────────────────────────────────────────
  if (selected.id === 'inbox') {
    const inboxTasks = tasks.filter(t => !t.proj_id && t.status !== 'done')
    return (
      <div style={panelStyle} role="complementary" aria-label="Inbox">
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <span style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:'.06em' }}>📥 Inbox</span>
          {closeBtn}
        </div>
        <div style={{ fontSize:13, color:'#94a3b8', lineHeight:1.6 }}>Taken zonder project — klik om te verwerken.</div>
        {onAddTask && (
          <PanelSection label="Taak toevoegen">
            <QuickAddTask projects={[]} defaultProjId={null} onAdd={onAddTask} />
          </PanelSection>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {inboxTasks.map(t => (
            <button key={t.id} onClick={() => onPick({ kind:'task', id: String(t.id) })}
              style={{ fontSize:12, textAlign:'left', background:'rgba(255,255,255,.03)', border:'1px solid rgba(217,119,6,.25)', borderRadius:6, padding:'5px 9px', color:'#fbbf24', cursor:'pointer' }}>
              📥 {t.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const cat = categories.find(c => c.id === selected.id)
  if (!cat) return null
  const catProjects = projects.filter(p => p.cat_id === cat.id)
  return (
    <div style={panelStyle} role="complementary" aria-label={`Categorie: ${cat.name}`}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <span style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:'.06em' }}>◉ Categorie</span>
        {closeBtn}
      </div>
      <div style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>{cat.name}</div>
      {cat.vision && (
        <PanelSection label="Visie">
          <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.6 }}>{cat.vision.slice(0, 300)}{cat.vision.length > 300 ? '…' : ''}</div>
        </PanelSection>
      )}
      <PanelSection label={`Projecten (${catProjects.length})`}>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {catProjects.map(p => (
            <button key={p.id} onClick={() => onPick({ kind:'proj', id: p.id })}
              style={{ fontSize:12, textAlign:'left', background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:6, padding:'5px 9px', color:'#cbd5e1', cursor:'pointer' }}>
              {p.emoji} {p.name}
            </button>
          ))}
        </div>
      </PanelSection>
      {onAddTask && (
        // Vanuit een levensgebied meteen een taak kwijt kunnen, en zelf kiezen
        // in welk project van dat gebied hij landt
        <PanelSection label="Taak toevoegen">
          {/* key: bij een ander gebied opnieuw beginnen, anders blijft de
              projectkeuze van het vorige gebied hangen */}
          <QuickAddTask key={cat.id} projects={catProjects} defaultProjId={catProjects[0]?.id ?? null} onAdd={onAddTask} />
        </PanelSection>
      )}
    </div>
  )
}

// ─── QuickAddTask — taak toevoegen zonder de kaart te verlaten ────────────────

function QuickAddTask({ projects, defaultProjId, onAdd }: {
  /** Projecten om uit te kiezen; leeg betekent: rechtstreeks naar de inbox. */
  projects: Project[]
  defaultProjId: string | null
  onAdd: (name: string, projId: string | null) => Promise<Task | null>
}) {
  const [name, setName]   = useState('')
  const [projId, setProjId] = useState<string>(defaultProjId ?? '')
  const [busy, setBusy]   = useState(false)
  const [msg, setMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = name.trim()
    if (!text || busy) return
    setBusy(true); setMsg(null)
    // Alleen 'toegevoegd' melden als de taak echt is opgeslagen
    const created = await onAdd(text, projId || null)
    setBusy(false)
    if (created) { setName(''); setMsg({ ok: true, text: `✓ "${created.name}" toegevoegd` }) }
    else setMsg({ ok: false, text: 'Opslaan lukte niet — probeer het opnieuw' })
  }

  const field: React.CSSProperties = {
    background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.12)',
    borderRadius:7, padding:'7px 9px', color:'#e2e8f0', fontSize:12, width:'100%',
  }

  return (
    <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <input value={name} onChange={e => setName(e.target.value)} disabled={busy}
        placeholder="Wat moet er gebeuren?" aria-label="Nieuwe taak" style={field} />
      {projects.length === 0 && (
        <div style={{ fontSize:10, color:'#64748b' }}>Komt in 📥 de inbox — je kunt hem later aan een project hangen.</div>
      )}
      {projects.length > 1 && (
        <select value={projId} onChange={e => setProjId(e.target.value)} aria-label="Project" style={field}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
          <option value="">📥 zonder project (inbox)</option>
        </select>
      )}
      <button type="submit" disabled={busy || !name.trim()}
        style={{ fontSize:12, fontWeight:600, padding:'8px 12px', borderRadius:7, border:'none',
          background: busy || !name.trim() ? 'rgba(99,102,241,.35)' : '#4f46e5', color:'#fff',
          cursor: busy || !name.trim() ? 'default' : 'pointer' }}>
        {busy ? 'Bezig…' : '+ Taak toevoegen'}
      </button>
      {msg && <div style={{ fontSize:11, color: msg.ok ? '#3fb950' : '#f85149' }}>{msg.text}</div>}
    </form>
  )
}

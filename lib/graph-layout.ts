// ─── Graaf van je leven: knopen, verbindingen en een 2D-kaartindeling ─────────
// Los van het tekenen, zodat de 3D-bol en de 2D-kaart dezelfde structuur delen
// en de indeling te testen is zonder canvas.

import type { Task, Project, Goal } from '@/lib/types'
import { CAT_COLORS } from '@/lib/category-colors'

export const INBOX_COLOR = '#d97706'
/** De wortel waar alles uit voortkomt. */
export const VISIE_COLOR = '#c4b5fd'
export const VISIE_ID = 'v-visie'
/** Doelen zonder levensgebied hangen rechtstreeks aan de visie. */
export const GOAL_COLOR = '#3fb950'

export type NodeType = 'visie' | 'cat' | 'goal' | 'proj' | 'task'

export interface GraphNode {
  id: string
  label: string
  emoji: string
  type: NodeType
  color: string
  urgent?: boolean
  /** Alleen bij doelen: gehaald of niet. */
  done?: boolean
  /** Straal in wereld-eenheden — categorieën groot, taken klein. */
  r: number
}

export interface GraphEdge { from: string; to: string }

export interface Graph { nodes: GraphNode[]; edges: GraphEdge[] }

export interface CatLike { id: string; name: string; vision?: string }

export interface GraphOpties {
  /** Doelen meenemen; ze hangen aan hun levensgebied, of anders aan de visie. */
  goals?: Pick<Goal, 'id' | 'text' | 'cat_id' | 'done' | 'kind' | 'deleted_at' | 'horizon'>[]
  /**
   * Een 🌟 Visie-wortel waar alle levensgebieden aan hangen. Daarmee is de graaf
   * één samenhangende boom in plaats van losse eilandjes per gebied — precies
   * de volgorde waarin het in het echt ontstaat: uit je visie komen je
   * levensgebieden, daaruit je doelen en projecten, en daaruit je taken.
   */
  visieWortel?: boolean
}

/**
 * Bouwt de graaf: visie → levensgebied → doel/project → sub-project → open taak.
 * Alleen open taken; afgeronde taken maken de kaart onleesbaar.
 * Zonder opties blijft het de oude vorm (gebied → project → taak).
 */
export function buildGraph(categories: CatLike[], projects: Project[], tasks: Task[], opts: GraphOpties = {}): Graph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  if (opts.visieWortel) {
    nodes.push({ id: VISIE_ID, label: '🌟 Visie', emoji: '', type: 'visie', color: VISIE_COLOR, r: 26 })
  }

  categories.forEach((cat, i) => {
    nodes.push({ id: `c-${cat.id}`, label: cat.name, emoji: '', type: 'cat', color: CAT_COLORS[i % CAT_COLORS.length], r: 18 })
    if (opts.visieWortel) edges.push({ from: `c-${cat.id}`, to: VISIE_ID })
  })

  // Doelen hangen aan hun levensgebied. Een doel zonder (bestaand) gebied —
  // bijvoorbeeld een hobbydoel — hangt rechtstreeks aan de visie, want ook dat
  // komt ergens vandaan.
  for (const g of opts.goals ?? []) {
    if (g.deleted_at) continue
    const catNode = g.cat_id ? nodes.find(n => n.id === `c-${g.cat_id}`) : undefined
    const parent  = catNode?.id ?? (opts.visieWortel ? VISIE_ID : null)
    if (!parent) continue
    nodes.push({
      id: `g-${g.id}`, label: g.text, emoji: '', type: 'goal',
      color: catNode?.color ?? GOAL_COLOR, done: g.done, r: g.done ? 6 : 9,
    })
    edges.push({ from: `g-${g.id}`, to: parent })
  }

  // Een gearchiveerd project is afgerond werk en hoort niet meer op de kaart —
  // die gaat over wat nog open staat.
  const gearchiveerd = new Set(projects.filter(p => p.status === 'archief').map(p => p.id))

  projects.forEach(p => {
    if (gearchiveerd.has(p.id)) return
    const catIdx = categories.findIndex(c => c.id === p.cat_id)
    const color  = catIdx >= 0 ? CAT_COLORS[catIdx % CAT_COLORS.length] : '#818cf8'
    const open   = tasks.filter(t => t.proj_id === p.id && t.status !== 'done').length
    nodes.push({ id: `p-${p.id}`, label: p.name.split('—')[0].trim(), emoji: p.emoji, type: 'proj', color, r: 7 + Math.min(open * 1.5, 9) })
    // Sub-project hangt aan zijn hoofdproject; een los project aan zijn categorie
    const parentExists = p.parent_id && projects.some(x => x.id === p.parent_id) && !gearchiveerd.has(p.parent_id)
    edges.push({ from: `p-${p.id}`, to: parentExists ? `p-${p.parent_id}` : `c-${p.cat_id}` })
  })

  const openTasks = tasks.filter(t => t.status !== 'done')
  // Een open taak onder een gearchiveerd project raakt zijn plek kwijt; die
  // komt in de inbox te liggen in plaats van stilletjes te verdwijnen. De
  // controle in Inzicht meldt hem apart.
  const losseTaak = (t: Task) => !t.proj_id || gearchiveerd.has(t.proj_id)
  if (openTasks.some(losseTaak)) {
    nodes.push({ id: 'c-inbox', label: '📥 Inbox', emoji: '', type: 'cat', color: INBOX_COLOR, r: 12 })
    // Ook de inbox hoort ergens bij, anders zweeft hij los van de rest
    if (opts.visieWortel) edges.push({ from: 'c-inbox', to: VISIE_ID })
  }
  openTasks.forEach(t => {
    const parentId = losseTaak(t) ? 'c-inbox' : `p-${t.proj_id}`
    if (!nodes.some(n => n.id === parentId)) return   // project bestaat niet (meer)
    nodes.push({ id: `t-${t.id}`, label: t.name, emoji: '', type: 'task', color: nodeColor(nodes, parentId), urgent: t.urgent, r: t.urgent ? 5 : 4 })
    edges.push({ from: `t-${t.id}`, to: parentId })
  })

  return { nodes, edges }
}

function nodeColor(nodes: GraphNode[], id: string) {
  return nodes.find(n => n.id === id)?.color ?? '#818cf8'
}

/** Kinderen van een knoop: alles wat met een verbinding náár deze knoop wijst. */
export function childrenOf(edges: GraphEdge[], id: string): string[] {
  return edges.filter(e => e.to === id).map(e => e.from)
}

// ─── Boomhulp ─────────────────────────────────────────────────────────────────

/** Alles onder deze knoop, hoe diep ook. Zonder de knoop zelf. */
export function descendantsOf(edges: GraphEdge[], id: string): string[] {
  const uit: string[] = []
  const stapel = [id]
  const gezien = new Set([id])
  while (stapel.length) {
    for (const kind of childrenOf(edges, stapel.pop()!)) {
      if (gezien.has(kind)) continue      // vangnet tegen een lus in de gegevens
      gezien.add(kind); uit.push(kind); stapel.push(kind)
    }
  }
  return uit
}

/** De ouder van een knoop, of null als hij een wortel is. */
export function parentOf(edges: GraphEdge[], id: string): string | null {
  return edges.find(e => e.from === id)?.to ?? null
}

export interface Ingeklapt {
  /** Knopen waarvan de tak dichtgeklapt is. */
  dicht: ReadonlySet<string>
}

/**
 * De graaf zoals hij getekend moet worden: alles onder een dichtgeklapte knoop
 * valt weg. De knoop zelf blijft staan — anders weet je niet meer wat je open
 * kunt klappen.
 */
export function visibleGraph(graph: Graph, dicht: ReadonlySet<string>): Graph {
  if (dicht.size === 0) return graph
  const verborgen = new Set<string>()
  for (const id of dicht) {
    if (!graph.nodes.some(n => n.id === id)) continue
    for (const d of descendantsOf(graph.edges, id)) verborgen.add(d)
  }
  return {
    nodes: graph.nodes.filter(n => !verborgen.has(n.id)),
    edges: graph.edges.filter(e => !verborgen.has(e.from) && !verborgen.has(e.to)),
  }
}

/** Hoeveel er onder een dichtgeklapte knoop verstopt zit — voor het telletje. */
export function hiddenCount(graph: Graph, id: string): number {
  return descendantsOf(graph.edges, id).length
}

// ─── 3D-indeling ──────────────────────────────────────────────────────────────

export interface Vec3 { x: number; y: number; z: number }
export interface Placed3D extends GraphNode, Vec3 {}

/** Afstand tot de ouder per niveau: visie → gebied → doel/project → taak. */
const RING_3D = [330, 170, 95, 62]

/** Hoe wijd de kinderen om de tak-richting uitwaaieren, per niveau. */
const KEGEL = [Math.PI / 2, 0.95, 0.8, 0.7]

/** Stabiel getal uit een tekst: dezelfde invoer geeft altijd dezelfde hoek. */
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}

function normaliseer(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}

const GULDEN_HOEK = Math.PI * (3 - Math.sqrt(5))

/** Hoek van kind i van k, gelijkmatig rond de tak. */
function hoekVan(i: number, k: number): number {
  return (i / k) * Math.PI * 2
}

/**
 * Richting nummer i van k, gelijkmatig over een bol (spiraal van Fibonacci).
 * Zo hangen je levensgebieden rondom de visie in plaats van op één platte ring.
 */
function bolRichting(i: number, k: number, draai: number): Vec3 {
  if (k === 1) return { x: 0, y: 1, z: 0 }
  const y = 1 - (i / (k - 1)) * 2
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const h = GULDEN_HOEK * i + draai
  return { x: Math.cos(h) * r, y, z: Math.sin(h) * r }
}

/** Twee richtingen loodrecht op d — samen met d een assenstelsel om de tak. */
function loodrecht(d: Vec3): [Vec3, Vec3] {
  // Kies een hulpas die niet (bijna) samenvalt met d, anders wordt het kruisproduct nul
  const hulp = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }
  const u = normaliseer({
    x: d.y * hulp.z - d.z * hulp.y,
    y: d.z * hulp.x - d.x * hulp.z,
    z: d.x * hulp.y - d.y * hulp.x,
  })
  const v = {
    x: d.y * u.z - d.z * u.y,
    y: d.z * u.x - d.x * u.z,
    z: d.x * u.y - d.y * u.x,
  }
  return [u, v]
}

/**
 * Legt de boom uit in de ruimte: de wortel in het midden, elk niveau waaiert
 * verder naar buiten in de richting waarin zijn tak al liep. Volledig
 * deterministisch — dezelfde graaf geeft altijd exact dezelfde plekken, zodat je
 * bol er bij elke keer openen hetzelfde uitziet en je hem kunt onthouden.
 */
export function layout3D(graph: Graph): Placed3D[] {
  const byId  = new Map(graph.nodes.map(n => [n.id, n]))
  const pos   = new Map<string, Vec3>()
  const gezien = new Set<string>()

  const wortels = graph.nodes.filter(n => !parentOf(graph.edges, n.id))

  wortels.forEach((wortel, i) => {
    // Meerdere wortels (geen visie-knoop) zetten we naast elkaar op een ring
    const hoek = (i / Math.max(1, wortels.length)) * Math.PI * 2
    const straal = wortels.length === 1 ? 0 : RING_3D[0]
    plaats(wortel.id,
      { x: Math.cos(hoek) * straal, y: 0, z: Math.sin(hoek) * straal },
      { x: Math.cos(hoek), y: 0, z: Math.sin(hoek) },
      0)
  })

  // Knopen die nergens aan hangen (zou niet moeten, maar dan raken we ze niet kwijt)
  for (const n of graph.nodes) if (!pos.has(n.id)) pos.set(n.id, { x: 0, y: 0, z: 0 })

  return graph.nodes.map(n => ({ ...n, ...pos.get(n.id)! }))

  function plaats(id: string, p: Vec3, richting: Vec3, diepte: number) {
    if (gezien.has(id)) return
    gezien.add(id)
    pos.set(id, p)

    const kinderen = childrenOf(graph.edges, id)
      .filter(k => byId.has(k) && !gezien.has(k))
      .sort()                                    // vaste volgorde, ongeacht de invoer
    if (kinderen.length === 0) return

    const basis = RING_3D[Math.min(diepte, RING_3D.length - 1)]
    // Meer kinderen betekent een ruimere ring, anders plakken ze op elkaar
    const straal = basis + Math.min(kinderen.length * 7, 90)
    const kegel  = KEGEL[Math.min(diepte, KEGEL.length - 1)]
    const [u, v] = loodrecht(richting)
    const draai  = hash01(id) * Math.PI * 2      // takken staan niet allemaal gelijk

    kinderen.forEach((kindId, i) => {
      // Vanuit de wortel: rondom over een bol, zodat je levensgebieden je écht
      // omringen. Dieper in de boom: uitwaaieren in de richting waarin die tak
      // al liep, zodat een tak herkenbaar één kant op groeit.
      const d = diepte === 0
        ? bolRichting(i, kinderen.length, draai)
        : normaliseer({
            x: richting.x * Math.cos(kegel) + (u.x * Math.cos(draai + hoekVan(i, kinderen.length)) + v.x * Math.sin(draai + hoekVan(i, kinderen.length))) * Math.sin(kegel),
            y: richting.y * Math.cos(kegel) + (u.y * Math.cos(draai + hoekVan(i, kinderen.length)) + v.y * Math.sin(draai + hoekVan(i, kinderen.length))) * Math.sin(kegel),
            z: richting.z * Math.cos(kegel) + (u.z * Math.cos(draai + hoekVan(i, kinderen.length)) + v.z * Math.sin(draai + hoekVan(i, kinderen.length))) * Math.sin(kegel),
          })
      plaats(kindId, { x: p.x + d.x * straal, y: p.y + d.y * straal, z: p.z + d.z * straal }, d, diepte + 1)
    })
  }
}

export interface Placed extends GraphNode { x: number; y: number }

/** Ringafstand per niveau: categorie → project → sub-project/taak. */
const RING = [260, 130, 70]

/** Ruimte tussen twee clusters op de kaart. */
const CLUSTER_GAP = 90

/** Maatvakjes voor het pakken van clusters — grover dan de werkelijke maat. */
const PACK_BUCKET = 150

/**
 * De maat waarmee een cluster meedoet in de puzzel: naar boven afgerond op een
 * vast vakje. Zo blijft de kaart staan waar hij staat als een cluster een klein
 * beetje groeit of krimpt (een taak erbij, een taak eraf).
 */
export function packRadius(r: number): number {
  return Math.max(PACK_BUCKET, Math.ceil(r / PACK_BUCKET) * PACK_BUCKET)
}

/**
 * Legt de graaf uit over een grote platte kaart: per categorie een cluster
 * (projecten eromheen, taken daar weer om), en die clusters worden naast
 * elkaar gepakt in een spiraal — zo blijft de kaart overal gevuld en land je
 * bij inzoomen niet in een leeg midden. Volledig deterministisch.
 */
export function layout2D(graph: Graph): Placed[] {
  const { nodes, edges } = graph
  const byId = new Map(nodes.map(n => [n.id, n]))
  const seen = new Set<string>()

  // Elke categorie is een cluster; wat nergens aan hangt vormt een eigen groepje
  const clusters: Placed[][] = []
  for (const root of nodes.filter(n => n.type === 'cat')) clusters.push(localCluster(root))
  for (const rest of nodes.filter(n => !seen.has(n.id))) clusters.push(localCluster(rest))

  // Elk cluster krijgt een even groot vak, in de volgorde van je levensgebieden.
  // Zo hangt de plek van een cluster alleen van zijn plek in de rij af — niet
  // van hoeveel taken erin zitten. Anders herschikt de hele kaart zodra je één
  // taak toevoegt of verwijdert, en lijkt het alsof je project verdwenen is.
  const vak = Math.max(...clusters.map(c => packRadius(clusterRadius(c))), PACK_BUCKET)
  const centers = packCircles(clusters.map(() => vak))

  const out: Placed[] = []
  clusters.forEach((cluster, k) => {
    const { x: cx, y: cy } = centers[k]
    for (const n of cluster) out.push({ ...n, x: n.x + cx, y: n.y + cy })
  })
  // Terug in de oorspronkelijke knoop-volgorde, zodat tekenen voorspelbaar is
  const pos = new Map(out.map(p => [p.id, p]))
  return nodes.map(n => pos.get(n.id)).filter((p): p is Placed => !!p)

  /** Eén cluster rond zijn wortel, met de wortel op (0,0). */
  function localCluster(root: GraphNode): Placed[] {
    const acc: Placed[] = []
    place(root, 0, 0, -Math.PI / 2, 0)
    return acc

    function place(node: GraphNode, x: number, y: number, parentAngle: number, depth: number) {
      if (seen.has(node.id)) return
      seen.add(node.id)
      acc.push({ ...node, x, y })

      const kids = childrenOf(edges, node.id).map(id => byId.get(id)).filter((n): n is GraphNode => !!n && !seen.has(n.id))
      if (kids.length === 0) return

      // Ring om de ouder; groeit mee met het aantal kinderen zodat ze niet plakken
      const base = RING[Math.min(depth, RING.length - 1)]
      const r    = base + kids.length * (depth === 0 ? 16 : 9)
      // Dieper in de boom een halve boog van de ouder áf, dat leest rustiger
      const spread = depth === 0 ? Math.PI * 2 : Math.PI * 1.4
      const start  = depth === 0 ? parentAngle : parentAngle - spread / 2

      kids.forEach((kid, i) => {
        const a = kids.length === 1 && depth > 0
          ? parentAngle
          : start + (i / Math.max(kids.length - (depth === 0 ? 0 : 1), 1)) * spread
        place(kid, x + Math.cos(a) * r, y + Math.sin(a) * r, a, depth + 1)
      })
    }
  }
}

/** Hoe ver een cluster van zijn eigen middelpunt af reikt. */
export function clusterRadius(cluster: Placed[]): number {
  let r = 0
  for (const n of cluster) r = Math.max(r, Math.hypot(n.x, n.y) + n.r)
  return r
}

/**
 * Legt cirkels van gegeven grootte naast elkaar: de eerste in het midden, de
 * rest langs een gulden-hoek-spiraal op de eerste plek die vrij is. Vult het
 * vlak zonder overlap en zonder gat in het midden.
 */
export function packCircles(radii: number[], gap = CLUSTER_GAP): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  const GOLDEN = 2.39996323
  const stepBase = Math.max(60, (radii[0] ?? 100) * 0.5)

  radii.forEach((r, i) => {
    if (i === 0) { out.push({ x: 0, y: 0 }); return }
    for (let t = 1; t < 20000; t++) {
      const a  = t * GOLDEN
      const rr = stepBase * Math.sqrt(t) * 0.8
      const x  = Math.cos(a) * rr, y = Math.sin(a) * rr
      if (out.every((c, j) => Math.hypot(c.x - x, c.y - y) >= r + radii[j] + gap)) {
        out.push({ x, y }); return
      }
    }
    // Vangnet: nooit bereikt bij realistische aantallen, maar geen knoop kwijt
    out.push({ x: 0, y: (radii[0] ?? 100) * 4 + i * (r * 2 + gap) })
  })
  return out
}

/** Omhullende van de kaart, om hem netjes in beeld te kunnen passen. */
export function boundsOf(placed: Placed[]) {
  if (placed.length === 0) return { minX: -100, minY: -100, maxX: 100, maxY: 100, width: 200, height: 200, cx: 0, cy: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of placed) {
    minX = Math.min(minX, p.x - p.r); minY = Math.min(minY, p.y - p.r)
    maxX = Math.max(maxX, p.x + p.r); maxY = Math.max(maxY, p.y + p.r)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

// ─── Zoomen ───────────────────────────────────────────────────────────────────

export const ZOOM_MIN = 0.08
export const ZOOM_MAX = 4
/** Eén stap met + of − : vaste factor, dus zoomen voelt overal gelijk. */
export const ZOOM_STEP = 1.25

export function clampZoom(z: number) {
  if (!Number.isFinite(z)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

export function zoomIn(z: number)  { return clampZoom(z * ZOOM_STEP) }
export function zoomOut(z: number) { return clampZoom(z / ZOOM_STEP) }

export type ZoomAction = 'in' | 'out' | 'reset' | null

/**
 * Welke zoomactie hoort bij een toetsaanslag? Het scrollwiel is onbetrouwbaar,
 * dus + en − (ook op het numerieke deel) moeten het volledig kunnen.
 */
export function zoomKeyAction(key: string): ZoomAction {
  if (key === '+' || key === '=' || key === 'Add')      return 'in'
  if (key === '-' || key === '_' || key === 'Subtract') return 'out'
  if (key === '0')                                      return 'reset'
  return null
}

/** Zoomen rond een punt op het scherm: dat punt blijft onder de cursor staan. */
export function zoomAround(
  view: { zoom: number; panX: number; panY: number },
  newZoom: number,
  screenX: number,
  screenY: number,
) {
  const z = clampZoom(newZoom)
  const k = z / view.zoom
  return { zoom: z, panX: screenX - (screenX - view.panX) * k, panY: screenY - (screenY - view.panY) * k }
}

export interface View { zoom: number; panX: number; panY: number }

/**
 * De knoop die het dichtst bij het midden van je beeld staat — dat is waar je
 * naar kijkt.
 */
export function anchorNode(placed: Placed[], view: View, w: number, h: number): string | null {
  let best: string | null = null, dist = Infinity
  for (const n of placed) {
    const sx = n.x * view.zoom + view.panX, sy = n.y * view.zoom + view.panY
    const d = Math.hypot(sx - w / 2, sy - h / 2)
    if (d < dist) { dist = d; best = n.id }
  }
  return best
}

/**
 * Schuift de kaart zo bij dat de ankerknoop op dezelfde plek op het scherm
 * blijft staan. Nodig omdat de indeling verschuift als er iets bijkomt of
 * verdwijnt — zonder dit lijkt het alsof je project ineens weg is.
 */
export function keepAnchor(anchorId: string, before: Placed[], after: Placed[], view: View): View {
  const a = before.find(p => p.id === anchorId)
  const b = after.find(p => p.id === anchorId)
  if (!a || !b) return view          // anker zelf verdwenen: laat het beeld staan
  const sx = a.x * view.zoom + view.panX, sy = a.y * view.zoom + view.panY
  return { zoom: view.zoom, panX: sx - b.x * view.zoom, panY: sy - b.y * view.zoom }
}

/**
 * Welke knoop zit onder deze plek op het scherm? Kleine bollen krijgen een
 * ruimere raakcirkel, anders is uitgezoomd niets aan te klikken.
 */
export function hitTest(placed: Placed[], view: View, mx: number, my: number, minRadius = 6, slack = 4): Placed | null {
  // Achterstevoren: wat als laatste getekend is (taken) pakt als eerste
  for (let i = placed.length - 1; i >= 0; i--) {
    const n = placed[i]
    const sx = n.x * view.zoom + view.panX, sy = n.y * view.zoom + view.panY
    if (Math.hypot(sx - mx, sy - my) <= Math.max(n.r * view.zoom, minRadius) + slack) return n
  }
  return null
}

/** Zoom + pan waarmee de hele kaart precies in beeld valt. */
export function fitView(placed: Placed[], w: number, h: number, padding = 60) {
  const b = boundsOf(placed)
  const zoom = clampZoom(Math.min((w - padding * 2) / Math.max(b.width, 1), (h - padding * 2) / Math.max(b.height, 1)))
  return { zoom, panX: w / 2 - b.cx * zoom, panY: h / 2 - b.cy * zoom }
}

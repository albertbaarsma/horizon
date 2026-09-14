'use client'
import { useState, useEffect } from 'react'
import type { Task, GoalHorizon } from '@/lib/types'
import { HORIZON_ORDER, HORIZON_META, horizonLabel } from '@/lib/goal-horizons'
import { goalProgress, splitByKind, isHobbyGoal, KIND_META } from '@/lib/goal-kinds'
import { groepeerMetSubdoelen } from '@/lib/goal-links'
import { categoryColorMap } from '@/lib/category-colors'
import { effectiveHorizon, isDeadlinePostponed } from '@/lib/deadline-horizon'
import { reorderList } from '@/lib/reorder'
import { AiSuggestions } from './WeekTab'
import { HorizonColumns } from './HorizonColumns'

/** Eigen sleeptype, zodat een kolom tijdens het slepen al ziet dat het om een
 *  doel gaat — de waarde zelf is pas bij het loslaten te lezen, het type niet.
 *  Daarmee hangt het slepen nergens op React-state die nog niet doorgevoerd is. */
const DOEL_MIME = 'application/x-albert-goal'

export function GoalsTab({ goals, categories, onToggle, onAddTask, onAddGoal, onFeature, onMove, onReorder, onTrash, onRestore, onPurge, onOpenGoal }: {
  goals: {id:number;horizon:string;text:string;done:boolean;cat_id?:string|null;deadline?:string|null;original_deadline?:string|null;sort_order?:number;deleted_at?:string|null;kind?:'doel'|'hobby';parent_id?:number|null}[]
  categories: {id:string;name:string}[]
  onToggle?: (id: number) => void
  onAddTask?: (text: string) => Promise<Task | null>
  /** Nieuw doel in deze horizon; 'hobby' telt niet mee in je voortgang. */
  onAddGoal?: (text: string, horizon: string, kind: 'doel' | 'hobby') => Promise<void> | void
  onFeature?: (key: string) => void
  /** Doel naar een andere horizon slepen. Zonder deze prop is slepen uit. */
  onMove?: (id: number, horizon: string) => void
  /** Handmatig herschikken binnen dezelfde horizon-kolom (drop op een ander doel, niet op de kolom zelf). */
  onReorder?: (updates: { id: number; sort_order: number }[]) => void
  onTrash?: (id: number) => void
  onRestore?: (id: number) => void
  onPurge?: (id: number) => void
  /** Klik op een doel (niet het vinkje) opent het detailvenster. */
  onOpenGoal?: (id: number) => void
}) {
  const [aiGoal, setAiGoal] = useState<number | null>(null)
  const [trashOpen, setTrashOpen] = useState(false)
  const [hideDone, setHideDone] = useState(false)
  // Ingeklapte kolommen blijven ingeklapt, ook na herladen
  const [dicht, setDicht] = useState<string[]>([])
  const [addIn, setAddIn] = useState<string | null>(null)
  const [nieuw, setNieuw] = useState('')
  const [nieuwHobby, setNieuwHobby] = useState(false)
  useEffect(() => {
    try { setDicht(JSON.parse(localStorage.getItem('doelen-dicht') ?? '[]')) } catch { /* leeg dan */ }
  }, [])
  function toggleDicht(key: string) {
    onFeature?.('doel-inklappen')
    setDicht(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      try { localStorage.setItem('doelen-dicht', JSON.stringify(next)) } catch { /* niet erg */ }
      return next
    })
  }
  /** Alle kolommen in één klik in- of uitklappen, i.p.v. losse driehoekjes. */
  function toggleAlleDicht(alleKeys: string[]) {
    onFeature?.('doel-inklappen')
    setDicht(prev => {
      const next = alleKeys.every(k => prev.includes(k)) ? [] : alleKeys
      try { localStorage.setItem('doelen-dicht', JSON.stringify(next)) } catch { /* niet erg */ }
      return next
    })
  }
  async function submitGoal(horizon: string) {
    const tekst = nieuw.trim()
    if (!tekst || !onAddGoal) return
    await onAddGoal(tekst, horizon, nieuwHobby ? 'hobby' : 'doel')
    setNieuw(''); setNieuwHobby(false); setAddIn(null)
  }
  useEffect(() => { setHideDone(localStorage.getItem('goals-hide-done') === '1') }, [])
  function toggleHideDone() {
    setHideDone(prev => { const next = !prev; localStorage.setItem('goals-hide-done', next ? '1' : '0'); return next })
  }
  // Hobbydoelen staan standaard uit — je doelenoverzicht gaat over je doelen.
  // Wie ze wil zien zet ze aan; die keuze blijft staan.
  const [hideHobby, setHideHobby] = useState(true)
  useEffect(() => {
    const opgeslagen = localStorage.getItem('goals-hide-hobby')
    setHideHobby(opgeslagen === null ? true : opgeslagen === '1')
  }, [])
  function toggleHideHobby() {
    onFeature?.('hobby-verbergen')
    setHideHobby(prev => { const next = !prev; localStorage.setItem('goals-hide-hobby', next ? '1' : '0'); return next })
  }
  // Slepen tussen horizons — welk doel hangt aan de muis, en boven welke kolom
  const [dragId, setDragId] = useState<number | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const horizons = HORIZON_ORDER.map(id => ({ id, label: horizonLabel(id), color: HORIZON_META[id].color }))
  const today = new Date().toISOString().slice(0,10)
  const trashed = goals.filter(g => g.deleted_at)
  const alleActief = goals.filter(g => !g.deleted_at)
  // Hobbydoelen staan apart en tellen niet mee in je voortgang — anders
  // verwatert "x van y gehaald" zodra je een spel wil uitspelen.
  // Hobbydoelen staan tussen de andere doelen, met een eigen kleur — geen eigen
  // kolom. Ze tellen alleen niet mee in het voortgangscijfer.
  const active = alleActief
  const { hobbys } = splitByKind(alleActief)
  const voortgang = goalProgress(goals)
  const doneCount = voortgang.doelen.done
  // Binnen een horizon-kolom gegroepeerd op levensgebied — zelfde volgorde en
  // kleur als categoryColorMap overal elders gebruikt, zodat gelijksoortige
  // doelen bij elkaar staan en herkenbaar zijn aan hun kleurtje.
  const catColor = categoryColorMap(categories)
  const catIndex = new Map(categories.map((c, i) => [c.id, i]))
  function catSortKey(g: { cat_id?: string | null }): number {
    return g.cat_id ? catIndex.get(g.cat_id) ?? categories.length : Infinity
  }
  // Een doel mét deadline hoort in de horizon die de deadline oplevert, niet
  // per se in het opgeslagen horizon-veld — zie lib/deadline-horizon.ts.
  const kolommen = horizons.map(h => ({ key: h.id, label: h.label, color: h.color, accent: false,
    items: active.filter(g => effectiveHorizon({ horizon: g.horizon as GoalHorizon, deadline: g.deadline }, today) === h.id && (!hideDone || !g.done) && (!hideHobby || !isHobbyGoal(g)))
      // Eerst op levensgebied gegroepeerd (zoals al zo was), daarbinnen op de
      // handmatige volgorde — slepen herschikt dus altijd binnen je eigen
      // levensgebied-cluster, nooit dwars door een ander gebied heen.
      .sort((a, b) => catSortKey(a) - catSortKey(b) || (a.sort_order ?? 0) - (b.sort_order ?? 0)) }))
  const gesleept = dragId === null ? null : active.find(g => g.id === dragId) ?? null

  function renderKolom(h: typeof kolommen[number]): React.ReactNode {
    const items = h.items
    const ingeklapt = dicht.includes(h.key)
    if (!items.length && !onAddGoal) return null
    const hDone = items.filter(g => g.done).length
    // Een kolom licht alleen op als er hier ook echt iets te droppen valt
    const dropDoel = !!gesleept && gesleept.horizon !== h.key
    const dropHier = dropDoel && overCol === h.key
    return (
      <div key={h.key}
        data-horizon={h.key}
        onDragOver={e => {
          if (!onMove || !e.dataTransfer.types.includes(DOEL_MIME)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setOverCol(h.key)
        }}
        onDragLeave={() => setOverCol(k => k === h.key ? null : k)}
        onDrop={e => {
          e.preventDefault()
          setDragId(null); setOverCol(null)
          const id = Number(e.dataTransfer.getData(DOEL_MIME))
          const doel = active.find(g => g.id === id)
          // Op de eigen kolom loslaten is geen verplaatsing
          if (doel && doel.horizon !== h.key) onMove?.(doel.id, h.key)
        }}
        style={{ background: dropHier ? `${h.color}14` : 'var(--bg2)', border:`1px solid ${dropHier ? h.color : h.accent ? h.color + '33' : 'var(--border)'}`, borderRadius:8, overflow:'hidden', transition:'background .1s, border-color .1s' }}>
        <div style={{ padding:'10px 14px', borderBottom: ingeklapt ? 'none' : '1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => toggleDicht(h.key)} title={ingeklapt ? 'Uitklappen' : 'Inklappen'}
            aria-label={`${ingeklapt ? 'Uitklappen' : 'Inklappen'}: ${h.label}`}
            style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:10, padding:0, lineHeight:1 }}>
            {ingeklapt ? '▸' : '▾'}
          </button>
          <span onClick={() => toggleDicht(h.key)} style={{ fontSize:12, fontWeight:700, color:h.color, flex:1, cursor:'pointer' }}>{h.label}</span>
          <span style={{ fontSize:10, color:'var(--dim)', background:'var(--bg3)', padding:'1px 7px', borderRadius:8, border:'1px solid var(--border)' }}>
            {hDone > 0 ? `${hDone}/${items.length}` : items.length}
          </span>
          {onAddGoal && (
            <button onClick={() => { setAddIn(addIn === h.key ? null : h.key); setNieuw(''); setNieuwHobby(false) }}
              title={`Doel toevoegen in ${h.label}`} aria-label={`Doel toevoegen in ${h.label}`}
              style={{ background:'none', border:'none', color:h.color, cursor:'pointer', fontSize:15, lineHeight:1, padding:'0 2px' }}>+</button>
          )}
        </div>
        {!ingeklapt && (
        <div style={{ padding:'8px' }}>
          {addIn === h.key && onAddGoal && (
            <form onSubmit={e => { e.preventDefault(); submitGoal(h.key) }}
              style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:8 }}>
              <input value={nieuw} onChange={e => setNieuw(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Escape') setAddIn(null) }}
                placeholder="Wat wil je bereiken?" aria-label={`Nieuw doel in ${h.label}`}
                style={{ fontSize:12, background:'var(--bg)', border:`1px solid ${h.color}55`, borderRadius:6, color:'var(--text)', padding:'6px 8px', outline:'none' }} />
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <label style={{ fontSize:10, color: nieuwHobby ? KIND_META.hobby.color : 'var(--dim)', display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}>
                  <input type="checkbox" checked={nieuwHobby} onChange={e => setNieuwHobby(e.target.checked)} aria-label="Hobbydoel" />
                  {KIND_META.hobby.emoji} hobbydoel
                </label>
                <button type="submit" disabled={!nieuw.trim()}
                  style={{ marginLeft:'auto', fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:6, border:'none',
                    background: nieuw.trim() ? h.color : 'var(--bg3)', color: nieuw.trim() ? '#0b0f16' : 'var(--dim)', cursor: nieuw.trim() ? 'pointer' : 'default' }}>
                  Toevoegen
                </button>
              </div>
            </form>
          )}
          {groepeerMetSubdoelen(items).map(({ goal: g, diepte }) => {
            const cat = g.cat_id ? categories.find(c => c.id === g.cat_id) : null
            const overdue = g.deadline && g.deadline < today && !g.done
            // Een sub-doel waarvan het hoofddoel hier niet genest kon worden
            // (bijv. een andere horizon) krijgt in elk geval een verwijzing.
            const looseParent = diepte === 0 && g.parent_id != null
              ? goals.find(x => x.id === g.parent_id) : null
            return (
              <div key={g.id}
                onClick={() => onOpenGoal?.(g.id)}
                draggable={!!onMove}
                title={onMove ? 'Sleep naar een andere horizon, of op een ander doel om de volgorde te bepalen — klik om te openen' : undefined}
                onDragStart={e => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData(DOEL_MIME, String(g.id))
                  e.dataTransfer.setData('text/plain', g.text)
                  setDragId(g.id)
                }}
                onDragEnd={() => { setDragId(null); setOverCol(null) }}
                onDragOver={e => {
                  if (!onMove || !e.dataTransfer.types.includes(DOEL_MIME)) return
                  e.preventDefault()
                  e.stopPropagation()   // niet ook de kolom-drop laten triggeren
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={e => {
                  if (!onMove || !e.dataTransfer.types.includes(DOEL_MIME)) return
                  e.preventDefault()
                  e.stopPropagation()
                  const id = Number(e.dataTransfer.getData(DOEL_MIME))
                  setDragId(null); setOverCol(null)
                  if (id === g.id) return
                  const dragged = active.find(x => x.id === id)
                  if (!dragged) return
                  if (dragged.horizon === h.key) {
                    if (!onReorder) return
                    const reordered = reorderList(items, dragged.id, g.id)
                    if (reordered !== items) onReorder(reordered.map(x => ({ id: x.id, sort_order: x.sort_order ?? 0 })))
                  } else {
                    onMove(dragged.id, h.key)
                  }
                }}
                style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'7px 9px', borderRadius:5, marginBottom:3, marginLeft: diepte * 16, fontSize:12, lineHeight:1.4, background:g.done?'transparent':overdue?'rgba(248,81,73,.04)':'rgba(255,255,255,.02)', border:`1px solid ${g.done?'transparent':overdue?'rgba(248,81,73,.2)':'var(--border)'}`, borderLeft: isHobbyGoal(g) ? `3px solid ${KIND_META.hobby.color}` : diepte ? '2px solid rgba(255,255,255,.08)' : undefined, cursor:onMove?'grab':onOpenGoal?'pointer':'default', opacity: dragId === g.id ? .4 : 1, transition:'background .1s' }}
                onMouseEnter={e => { if (onOpenGoal) e.currentTarget.style.background = g.done ? 'rgba(255,255,255,.02)' : overdue ? 'rgba(248,81,73,.07)' : 'rgba(255,255,255,.04)' }}
                onMouseLeave={e => { e.currentTarget.style.background = g.done ? 'transparent' : overdue ? 'rgba(248,81,73,.04)' : 'rgba(255,255,255,.02)' }}>
                <div onClick={e => { e.stopPropagation(); onToggle?.(g.id) }}
                  title={g.done ? 'Markeer als niet gehaald' : 'Markeer als gehaald'}
                  style={{ flexShrink:0, width:16, height:16, borderRadius:'50%', marginTop:1, cursor:onToggle?'pointer':'default', background:g.done?(isHobbyGoal(g)?KIND_META.hobby.color+'33':'rgba(74,222,128,.2)'):'none', border:`2px solid ${g.done?(isHobbyGoal(g)?KIND_META.hobby.color:'#4ade80'):'#374151'}`, display:'flex', alignItems:'center', justifyContent:'center', color:isHobbyGoal(g)?KIND_META.hobby.color:'#4ade80', fontSize:9 }}>
                  {g.done ? '✓' : ''}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  {diepte > 0 && <div style={{ fontSize:9, color:'#818cf8', marginBottom:2 }}>↳ sub-doel</div>}
                  {looseParent && <div style={{ fontSize:9, color:'#64748b', marginBottom:2 }}>↳ sub van &ldquo;{looseParent.text.slice(0, 34)}&rdquo;</div>}
                  <div style={{ color:g.done?'var(--dim)':'var(--text)', textDecoration:g.done?'line-through':'none' }}>{g.text}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4, flexWrap:'wrap' }}>
                    {isHobbyGoal(g) && (
                      <span title="Hobbydoel — telt niet mee in je voortgang"
                        style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:`${KIND_META.hobby.color}18`, border:`1px solid ${KIND_META.hobby.color}44`, color:KIND_META.hobby.color }}>
                        {KIND_META.hobby.emoji} hobby
                      </span>
                    )}
                    {cat && (() => {
                      const kleur = catColor.get(cat.id) ?? '#818cf8'
                      return <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:`${kleur}18`, border:`1px solid ${kleur}44`, color:kleur }}>{cat.name}</span>
                    })()}
                    {g.deadline && (
                      <span style={{ fontSize:9, color:overdue?'#f87171':'var(--dim)' }}>
                        {overdue?'⚠ ':''}{g.deadline}
                        {isDeadlinePostponed(g) && (
                          <span title={`Deadline verschoven — was ${g.original_deadline}, nu ${g.deadline}`} style={{ marginLeft:3 }}>🔀</span>
                        )}
                      </span>
                    )}
                    {g.done && <span style={{ fontSize:9, color:isHobbyGoal(g)?KIND_META.hobby.color:'#3fb950' }}>✓ {isHobbyGoal(g)?'gedaan':'gehaald'}</span>}
                    {!g.done && onAddTask && (
                      <button
                        onClick={e => { e.stopPropagation(); onFeature?.('ai-stappen'); setAiGoal(prev => prev === g.id ? null : g.id) }}
                        title="AI-suggesties — laat concrete stappen bedenken voor dit doel"
                        style={{ fontSize:9, padding:'1px 7px', borderRadius:4, cursor:'pointer', background: aiGoal===g.id ? 'rgba(168,139,250,.18)' : 'rgba(168,139,250,.08)', border:'1px solid rgba(168,139,250,.3)', color:'#c4b5fd' }}>
                        ✨ AI-stappen
                      </button>
                    )}
                  </div>
                  {aiGoal === g.id && onAddTask && (
                    <div onClick={e => e.stopPropagation()} style={{ marginTop:8, cursor:'default' }}>
                      <AiSuggestions
                        task={`Doel: ${g.text}`}
                        onAdd={async text => !!(await onAddTask(text))}
                        hideToggle
                        ctaLabel="＋ Als taak"
                        addedText="toegevoegd aan je taken (inbox)"
                      />
                    </div>
                  )}
                </div>
                {onTrash && (
                  <button
                    onClick={e => { e.stopPropagation(); onTrash(g.id) }}
                    title="Verwijderen (gaat naar prullenbak, later te herstellen)"
                    style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--dim)', padding:'0 2px', lineHeight:1 }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--dim)' }}>
                    🗑
                  </button>
                )}
              </div>
            )
          })}
        </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {(doneCount > 0 || hobbys.length > 0 || active.length > 0) && (
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12, flexWrap:'wrap' }}>
          {doneCount > 0 && (
            <div style={{ fontSize:11, color:'var(--dim)' }}>
              {doneCount} van {voortgang.doelen.total} doelen gehaald ({voortgang.doelen.pct}%)
              <span style={{ display:'inline-block', width: voortgang.doelen.pct + '%', minWidth:2, height:3, background:'#3fb950', borderRadius:2, marginLeft:8, verticalAlign:'middle', maxWidth:120 }} />
            </div>
          )}
          {hobbys.length > 0 && !hideHobby && (
            <div style={{ fontSize:11, color:'var(--dim)' }}>
              {KIND_META.hobby.emoji} {voortgang.hobbys.done} van {voortgang.hobbys.total} hobbydoelen
              <span style={{ display:'inline-block', width: voortgang.hobbys.pct + '%', minWidth:2, height:3, background:KIND_META.hobby.color, borderRadius:2, marginLeft:8, verticalAlign:'middle', maxWidth:80 }} />
            </div>
          )}
          {doneCount > 0 && (
            <button onClick={toggleHideDone}
              title={hideDone ? 'Toon gehaalde doelen weer' : 'Verberg gehaalde doelen'}
              style={{ fontSize:10, padding:'2px 9px', borderRadius:10, cursor:'pointer', background: hideDone ? 'rgba(99,102,241,.15)' : 'transparent', border:`1px solid ${hideDone ? 'rgba(99,102,241,.4)' : 'var(--border)'}`, color: hideDone ? '#a5b4fc' : 'var(--dim)' }}>
              {hideDone ? '👁‍🗨 Toon gehaalde' : '🙈 Verberg gehaalde'}
            </button>
          )}
          {hobbys.length > 0 && (
            <button onClick={toggleHideHobby}
              title={hideHobby ? `Toon je ${hobbys.length} hobbydoelen weer` : 'Verberg hobbydoelen — ze tellen toch niet mee in je voortgang'}
              style={{ fontSize:10, padding:'2px 9px', borderRadius:10, cursor:'pointer', background: hideHobby ? `${KIND_META.hobby.color}22` : 'transparent', border:`1px solid ${hideHobby ? KIND_META.hobby.color + '66' : 'var(--border)'}`, color: hideHobby ? KIND_META.hobby.color : 'var(--dim)' }}>
              {hideHobby ? `${KIND_META.hobby.emoji} Toon hobbydoelen (${hobbys.length})` : '🙈 Verberg hobbydoelen'}
            </button>
          )}
          <button onClick={() => toggleAlleDicht(horizons.map(h => h.id))}
            title="Alle kolommen in één keer in- of uitklappen"
            style={{ fontSize:10, padding:'2px 9px', borderRadius:10, cursor:'pointer', background: 'transparent', border:'1px solid var(--border)', color:'var(--dim)' }}>
            {horizons.every(h => dicht.includes(h.id)) ? '▾ Alles uitklappen' : '▸ Alles inklappen'}
          </button>
        </div>
      )}
      <HorizonColumns columns={kolommen.map(h => ({ key: h.key, content: renderKolom(h) }))} storageKey="doelen-lang-open" />

      {trashed.length > 0 && (
        <div style={{ marginTop:24 }}>
          <button onClick={() => setTrashOpen(o => !o)}
            style={{ fontSize:11, color:'var(--dim)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, padding:0 }}>
            {trashOpen ? '▾' : '▸'} 🗑 Prullenbak ({trashed.length})
          </button>
          {trashOpen && (
            <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:5 }}>
              {trashed.map(g => (
                <div key={g.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 9px', borderRadius:5, fontSize:12, background:'rgba(255,255,255,.02)', border:'1px solid var(--border)' }}>
                  <span style={{ flex:1, color:'var(--dim)', textDecoration:'line-through' }}>{g.text}</span>
                  {onRestore && (
                    <button onClick={() => onRestore(g.id)} title="Terugzetten"
                      style={{ fontSize:9, padding:'2px 8px', borderRadius:4, cursor:'pointer', background:'rgba(74,222,128,.1)', border:'1px solid rgba(74,222,128,.3)', color:'#4ade80' }}>
                      ↩ Herstel
                    </button>
                  )}
                  {onPurge && (
                    <button onClick={() => { if (confirm(`"${g.text}" definitief verwijderen? Dit kan niet ongedaan worden.`)) onPurge(g.id) }} title="Definitief verwijderen"
                      style={{ fontSize:9, padding:'2px 8px', borderRadius:4, cursor:'pointer', background:'none', border:'1px solid var(--border)', color:'var(--dim)' }}>
                      Definitief wissen
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

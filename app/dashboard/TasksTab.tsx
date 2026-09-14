'use client'
import { useState, useEffect, Fragment } from 'react'
import type { Task, Project, TaskStatus, GoalHorizon } from '@/lib/types'
import { INBOX_COLOR } from '@/lib/graph-layout'
import { CAT_COLORS } from '@/lib/category-colors'
import { isDeadlinePostponed } from '@/lib/deadline-horizon'
import { TASK_MIME } from '@/lib/drag-mime'
import { reorderList } from '@/lib/reorder'
import { formatPlannedDate } from '@/lib/planned-tasks'
import { TasksHorizonView } from './TasksHorizonView'

/** Kleur van "Ingepland": taken die al op een dag in de week staan. */
const PLANNED_COLOR = '#818cf8'

// ─── TasksTab ─────────────────────────────────────────────────────────────────
// Kanban en lijst over dezelfde taken. Elke taak is hier af te vinken en weg te
// gooien; weggooien betekent naar de prullenbak, onderaan terug te halen. De
// kleur van een taak is de kleur van zijn levensgebied — dezelfde als op de
// kaart in Inzicht — zodat je overal hetzelfde ziet. Ook in de prullenbak.

export const KANBAN_COLS: { id: TaskStatus; label: string; color: string; dim: string }[] = [
  { id:'backlog', label:'Backlog', color:'#64748b', dim:'rgba(100,116,139,.15)' },
  { id:'doing',   label:'Bezig',  color:'#58a6ff', dim:'rgba(88,166,255,.12)'  },
  { id:'waiting', label:'Wacht',  color:'#d29922', dim:'rgba(210,153,34,.12)'  },
  { id:'done',    label:'Klaar',  color:'#3fb950', dim:'rgba(63,185,80,.10)'   },
]

export interface TasksTabProps {
  /** Volledige lijst inclusief prullenbak — die hoort hier thuis. */
  tasks: Task[]
  projects: Project[]
  categories: { id: string; name: string }[]
  onUpdate: (id: number, s: TaskStatus) => void
  onTaskClick: (t: Task) => void
  /** Taak naar een andere horizon slepen (Horizon-weergave); null = terug naar "nog niet ingedeeld". */
  onMoveHorizon: (id: number, horizon: GoalHorizon | null) => void
  /** Handmatig herschikken binnen dezelfde groep (Kanban-kolom/status of horizon-kolom). */
  onReorder: (updates: { id: number; sort_order: number }[]) => void
  onDelete?: (id: number) => void
  onRestore?: (id: number) => void
  onPurge?: (id: number) => void
  onAdd?: (name: string, status: TaskStatus, projId: string | null) => Promise<void> | void
  /** Gebruik meten: welke onderdelen worden echt aangeraakt? */
  onFeature?: (key: string) => void
  /** Per taak-id de eerstvolgende dag waarop hij open in de week staat (zie
   *  lib/planned-tasks.ts). Een ingeplande backlog-taak is daarmee verplaatst
   *  naar "Ingepland", in plaats van dat hij ook nog in de Backlog blijft staan. */
  plannedDates?: Map<number, string>
  isMobile?: boolean
}

const GEEN_PLANNING = new Map<number, string>()

export function TasksTab({ tasks, projects, categories, onUpdate, onTaskClick, onMoveHorizon, onReorder, onDelete, onRestore, onPurge, onAdd, onFeature, plannedDates = GEEN_PLANNING, isMobile = false }: TasksTabProps) {
  const [view,      setView]      = useState<'kanban'|'list'|'horizon'>('kanban')
  useEffect(() => {
    const opgeslagen = localStorage.getItem('taken-weergave')
    if (opgeslagen === 'kanban' || opgeslagen === 'list' || opgeslagen === 'horizon') setView(opgeslagen)
  }, [])
  function kiesView(v: 'kanban'|'list'|'horizon') {
    setView(v)
    try { localStorage.setItem('taken-weergave', v) } catch { /* niet erg */ }
  }
  const [dragId,    setDragId]    = useState<number|null>(null)
  const [dragOver,  setDragOver]  = useState<TaskStatus|null>(null)
  const [catFilter, setCatFilter] = useState<string>('all')
  const [trashOpen, setTrashOpen] = useState(false)
  const [addingIn,  setAddingIn]  = useState<TaskStatus|null>(null)
  const [newName,   setNewName]   = useState('')

  const levend  = tasks.filter(t => !t.deleted_at)
  const trashed = tasks.filter(t => t.deleted_at)

  /** De kleur van het levensgebied waar deze taak onder hangt. */
  function taskColor(t: Task): string {
    const proj = projects.find(p => p.id === t.proj_id)
    if (!proj) return INBOX_COLOR
    const i = categories.findIndex(c => c.id === proj.cat_id)
    return i >= 0 ? CAT_COLORS[i % CAT_COLORS.length] : CAT_COLORS[0]
  }

  const catIds = [...new Set(levend.map(t => projects.find(p => p.id === t.proj_id)?.cat_id).filter(Boolean))] as string[]
  const filtered = catFilter === 'all' ? levend : levend.filter(t => projects.find(p => p.id === t.proj_id)?.cat_id === catFilter)
  const urgentOpen = filtered.filter(t => t.urgent && t.status !== 'done')

  /** Een backlog-taak die al op een dag in de week staat, hoort niet meer in de Backlog. */
  const isIngepland = (t: Task) => t.status === 'backlog' && plannedDates.has(t.id)
  const ingepland = filtered.filter(isIngepland)
    .sort((a, b) => (plannedDates.get(a.id) ?? '').localeCompare(plannedDates.get(b.id) ?? ''))
  /** De taken van één statusgroep, zonder de ingeplande backlog-taken. */
  const inKolom = (status: TaskStatus) => filtered
    .filter(t => t.status === status && !isIngepland(t))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  async function submitNew(status: TaskStatus) {
    const naam = newName.trim()
    if (!naam || !onAdd) return
    await onAdd(naam, status, null)
    setNewName('')
    setAddingIn(null)
  }

  /** Kanban-kolom met taken die al in de week staan. Hier valt niets in te slepen:
   *  inplannen doe je op een dag in Week, dan komt de taak vanzelf hier. */
  function renderIngeplandKolom() {
    return (
      <div style={{ background:'rgba(255,255,255,.015)', border:'1px solid rgba(255,255,255,.07)', borderRadius:10, minHeight:280, display:'flex', flexDirection:'column', ...(isMobile ? { minWidth:'76vw', scrollSnapAlign:'center', flexShrink:0 } : {}) }}>
        <div style={{ padding:'10px 12px 8px', borderBottom:`1px solid ${PLANNED_COLOR}30`, display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:PLANNED_COLOR, flexShrink:0 }} />
          <span title="Staan al op een dag in je weekplanning" style={{ fontSize:11, fontWeight:700, color:PLANNED_COLOR, textTransform:'uppercase', letterSpacing:'0.6px', flex:1 }}>Ingepland</span>
          <span style={{ fontSize:10, color:'var(--dim)', background:'var(--bg3)', padding:'1px 7px', borderRadius:8, border:'1px solid var(--border)' }}>{ingepland.length}</span>
        </div>
        <div style={{ padding:8, flex:1, display:'flex', flexDirection:'column', gap:6 }}>
          {ingepland.map(task => {
            const proj = projects.find(p => p.id === task.proj_id)
            const kleur = taskColor(task)
            return (
              <div key={task.id}
                draggable
                onDragStart={e => { e.dataTransfer.setData(TASK_MIME, String(task.id)); setDragId(task.id) }}
                onDragEnd={() => { setDragId(null); setDragOver(null) }}
                title="Staat al in je weekplanning — sleep naar een andere dag om hem te verzetten"
                style={{ background:'var(--bg2)', border:`1px solid ${task.urgent ? 'rgba(248,81,73,.35)' : 'rgba(255,255,255,.09)'}`,
                  borderLeft:`3px solid ${kleur}`, borderRadius:7, padding:'8px 9px', cursor:'grab', userSelect:'none',
                  opacity: dragId === task.id ? 0.4 : 1, transition:'opacity .1s' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:7 }}>
                  <button onClick={e => { e.stopPropagation(); onUpdate(task.id, 'done') }}
                    title="Afvinken" aria-label={`Afvinken: ${task.name}`}
                    style={{ flexShrink:0, width:16, height:16, marginTop:1, borderRadius:'50%', cursor:'pointer', background:'none', border:'2px solid #374151', padding:0 }} />
                  <div onClick={() => onTaskClick(task)} style={{ flex:1, minWidth:0, cursor:'pointer' }}>
                    <div style={{ fontSize:12, color:'var(--text)', lineHeight:1.45 }}>{task.name}</div>
                    <ProjectChip proj={proj} kleur={kleur} />
                    <PlannedChip date={plannedDates.get(task.id)} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  /** Lijst-groep met taken die al in de week staan. */
  function renderIngeplandLijst() {
    return (
      <div>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.7px', textTransform:'uppercase', color:PLANNED_COLOR, marginBottom:7, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:PLANNED_COLOR }} />
          Ingepland <span style={{ color:'var(--dim)', fontWeight:400 }}>({ingepland.length})</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {ingepland.map(task => {
            const proj = projects.find(p => p.id === task.proj_id)
            const kleur = taskColor(task)
            return (
              <div key={task.id}
                draggable
                onDragStart={e => { e.dataTransfer.setData(TASK_MIME, String(task.id)); setDragId(task.id) }}
                onDragEnd={() => setDragId(null)}
                title="Staat al in je weekplanning — sleep naar een andere dag om hem te verzetten"
                style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 11px', background:'var(--bg2)',
                  border:'1px solid var(--border)', borderLeft:`3px solid ${kleur}`, borderRadius:6, cursor:'grab' }}>
                <button onClick={() => onUpdate(task.id, 'done')}
                  title="Afvinken" aria-label={`Afvinken: ${task.name}`}
                  style={{ flexShrink:0, width:15, height:15, borderRadius:'50%', cursor:'pointer', padding:0, background:'none', border:'2px solid #374151' }} />
                <span onClick={() => onTaskClick(task)} style={{ flex:1, minWidth:0, fontSize:12, cursor:'pointer', color:'var(--text)' }}>
                  {task.name}
                </span>
                <ProjectChip proj={proj} kleur={kleur} inline />
                <PlannedChip date={plannedDates.get(task.id)} inline />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:6, overflow:'hidden' }}>
          {(['kanban','list','horizon'] as const).map(v => (
            <button key={v} onClick={() => kiesView(v)}
              style={{ padding:'5px 12px', fontSize:11, background: view===v ? 'rgba(99,102,241,.2)' : 'none', border:'none', color: view===v ? '#818cf8' : 'var(--dim)', fontWeight: view===v ? 600 : 400, cursor: view===v ? 'default' : 'pointer' }}>
              {v === 'kanban' ? '⊞ Kanban' : v === 'list' ? '≡ Lijst' : '🔭 Horizon'}
            </button>
          ))}
        </div>

        {catIds.length > 1 && (
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            aria-label="Filter op levensgebied"
            style={{ fontSize:11, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', padding:'5px 8px', cursor:'pointer' }}>
            <option value="all">Alle levensgebieden</option>
            {catIds.map(id => <option key={id} value={id}>{categories.find(c => c.id === id)?.name ?? id}</option>)}
          </select>
        )}

        <span style={{ fontSize:11, color:'var(--dim)', marginLeft:'auto' }}>
          {filtered.filter(t => t.status !== 'done').length} open · {filtered.filter(t => t.status === 'done').length} klaar
        </span>
      </div>

      {/* Urgent */}
      {urgentOpen.length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12, padding:'8px 10px', background:'#200d0d', border:'1px solid #4d1a1a', borderRadius:7 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#f87171', textTransform:'uppercase', letterSpacing:'0.5px', alignSelf:'center' }}>🔴 Urgent</span>
          {urgentOpen.map(t => (
            <button key={t.id} onClick={() => onTaskClick(t)}
              style={{ fontSize:11, padding:'2px 9px', background:'rgba(248,81,73,.12)', border:'1px solid rgba(248,81,73,.3)', color:'#f87171', borderRadius:4, cursor:'pointer' }}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {view === 'horizon' ? (
        <TasksHorizonView tasks={filtered} projects={projects} categories={categories}
          onSelect={onTaskClick} onUpdate={onUpdate} onMoveHorizon={onMoveHorizon} onReorder={onReorder} onDelete={onDelete} />
      ) : view === 'kanban' ? (
        <div style={ isMobile
          ? { display:'flex', overflowX:'auto', gap:10, scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch', paddingBottom:6 }
          : { display:'grid', gridTemplateColumns:`repeat(${ingepland.length ? 5 : 4}, minmax(200px, 1fr))`, gap:8, overflowX:'auto', paddingBottom:6 } }>
          {KANBAN_COLS.map(col => {
            const colTasks = inKolom(col.id)
            const isOver   = dragOver === col.id
            return (
              <Fragment key={col.id}>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                onDrop={e => {
                  e.preventDefault()
                  if (dragId !== null) onUpdate(dragId, col.id)
                  setDragId(null); setDragOver(null)
                }}
                style={{ background: isOver ? col.dim : 'rgba(255,255,255,.015)', border:`1px solid ${isOver ? col.color : 'rgba(255,255,255,.07)'}`, borderRadius:10, minHeight:280, display:'flex', flexDirection:'column', transition:'all .15s', ...(isMobile ? { minWidth:'76vw', scrollSnapAlign:'center', flexShrink:0 } : {}) }}>

                <div style={{ padding:'10px 12px 8px', borderBottom:`1px solid ${col.color}30`, display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:col.color, flexShrink:0 }} />
                  <span style={{ fontSize:11, fontWeight:700, color:col.color, textTransform:'uppercase', letterSpacing:'0.6px', flex:1 }}>{col.label}</span>
                  <span style={{ fontSize:10, color:'var(--dim)', background:'var(--bg3)', padding:'1px 7px', borderRadius:8, border:'1px solid var(--border)' }}>{colTasks.length}</span>
                  {onAdd && (
                    <button onClick={() => { setAddingIn(addingIn === col.id ? null : col.id); setNewName('') }}
                      title={`Taak toevoegen in ${col.label}`} aria-label={`Taak toevoegen in ${col.label}`}
                      style={{ background:'none', border:'none', color:col.color, cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px' }}>+</button>
                  )}
                </div>

                <div style={{ padding:8, flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                  {addingIn === col.id && onAdd && (
                    <form onSubmit={e => { e.preventDefault(); submitNew(col.id) }} style={{ display:'flex', gap:4 }}>
                      <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                        onKeyDown={e => { if (e.key === 'Escape') setAddingIn(null) }}
                        placeholder="Wat moet er gebeuren?" aria-label={`Nieuwe taak in ${col.label}`}
                        style={{ flex:1, minWidth:0, fontSize:11.5, background:'var(--bg)', border:`1px solid ${col.color}55`, borderRadius:6, color:'var(--text)', padding:'6px 8px', outline:'none' }} />
                      <button type="submit" disabled={!newName.trim()}
                        style={{ fontSize:11, fontWeight:600, padding:'0 9px', borderRadius:6, border:'none', background: newName.trim() ? col.color : 'var(--bg3)', color: newName.trim() ? '#0b0f16' : 'var(--dim)', cursor: newName.trim() ? 'pointer' : 'default' }}>✓</button>
                    </form>
                  )}

                  {colTasks.map(task => {
                    const proj = projects.find(p => p.id === task.proj_id)
                    const kleur = taskColor(task)
                    const isDragging = dragId === task.id
                    const klaar = task.status === 'done'
                    return (
                      <div key={task.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData(TASK_MIME, String(task.id)); setDragId(task.id) }}
                        onDragEnd={() => { setDragId(null); setDragOver(null) }}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                        onDrop={e => {
                          e.preventDefault(); e.stopPropagation()
                          setDragOver(null)
                          if (dragId === null || dragId === task.id) { setDragId(null); return }
                          const dragged = tasks.find(t => t.id === dragId)
                          setDragId(null)
                          if (!dragged) return
                          if (dragged.status === col.id) {
                            const reordered = reorderList(colTasks, dragged.id, task.id)
                            if (reordered !== colTasks) onReorder(reordered.map(t => ({ id: t.id, sort_order: t.sort_order ?? 0 })))
                          } else {
                            onUpdate(dragged.id, col.id)
                          }
                        }}
                        style={{ background:'var(--bg2)', border:`1px solid ${task.urgent ? 'rgba(248,81,73,.35)' : 'rgba(255,255,255,.09)'}`,
                          borderLeft:`3px solid ${kleur}`, borderRadius:7, padding:'8px 9px', cursor:'grab', userSelect:'none',
                          opacity: isDragging ? 0.4 : 1, transition:'opacity .1s' }}>
                        {(task.urgent || !!task.priority) && !klaar && (
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                            {task.urgent && <span style={{ fontSize:9, color:'#f87171', fontWeight:700, letterSpacing:'0.5px' }}>🔴 URGENT</span>}
                            {!!task.priority && <span style={{ fontSize:9, color:'#fbbf24', fontWeight:700, letterSpacing:'0.5px' }}>🔺 P{task.priority}</span>}
                          </div>
                        )}
                        <div style={{ display:'flex', alignItems:'flex-start', gap:7 }}>
                          <button onClick={e => { e.stopPropagation(); onUpdate(task.id, klaar ? 'backlog' : 'done') }}
                            title={klaar ? 'Weer openzetten' : 'Afvinken'} aria-label={`${klaar ? 'Weer openzetten' : 'Afvinken'}: ${task.name}`}
                            style={{ flexShrink:0, width:16, height:16, marginTop:1, borderRadius:'50%', cursor:'pointer',
                              background: klaar ? 'rgba(63,185,80,.2)' : 'none', border:`2px solid ${klaar ? '#3fb950' : '#374151'}`,
                              color:'#3fb950', fontSize:9, lineHeight:1, padding:0, display:'grid', placeItems:'center' }}>
                            {klaar ? '✓' : ''}
                          </button>
                          <div onClick={() => onTaskClick(task)} style={{ flex:1, minWidth:0, cursor:'pointer' }}>
                            <div style={{ fontSize:12, color: klaar ? 'var(--dim)' : 'var(--text)', textDecoration: klaar ? 'line-through' : 'none', lineHeight:1.45 }}>
                              {task.name}
                            </div>
                            <ProjectChip proj={proj} kleur={kleur} />
                            <DeadlineChip task={task} />
                            {!klaar && <PlannedChip date={plannedDates.get(task.id)} />}
                          </div>
                          {onDelete && (
                            <button onClick={e => { e.stopPropagation(); onDelete(task.id) }}
                              title="Naar de prullenbak" aria-label={`Verwijderen: ${task.name}`}
                              style={{ flexShrink:0, background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:11, padding:'0 2px', opacity:.5 }}
                              onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color='#f85149' }}
                              onMouseLeave={e => { e.currentTarget.style.opacity='.5'; e.currentTarget.style.color='var(--dim)' }}>🗑</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {colTasks.length === 0 && !isOver && addingIn !== col.id && (
                    <div style={{ textAlign:'center', padding:'24px 0', fontSize:11, color:'rgba(255,255,255,.1)', userSelect:'none' }}>
                      Sleep hier naartoe
                    </div>
                  )}
                </div>
              </div>
              {col.id === 'backlog' && ingepland.length > 0 && renderIngeplandKolom()}
              </Fragment>
            )
          })}
        </div>
      ) : (
        /* ── Lijst ────────────────────────────────────────────────────────── */
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
          {KANBAN_COLS.map(col => {
            const colTasks = inKolom(col.id)
            return (
              <Fragment key={col.id}>
              {colTasks.length > 0 && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.7px', textTransform:'uppercase', color:col.color, marginBottom:7, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:col.color }} />
                  {col.label} <span style={{ color:'var(--dim)', fontWeight:400 }}>({colTasks.length})</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  {colTasks.map(task => {
                    const proj = projects.find(p => p.id === task.proj_id)
                    const kleur = taskColor(task)
                    const klaar = task.status === 'done'
                    return (
                      <div key={task.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData(TASK_MIME, String(task.id)); setDragId(task.id) }}
                        onDragEnd={() => setDragId(null)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault()
                          if (dragId === null || dragId === task.id) { setDragId(null); return }
                          const dragged = tasks.find(t => t.id === dragId)
                          setDragId(null)
                          if (!dragged || dragged.status !== task.status) return   // alleen herschikken binnen dezelfde groep
                          const reordered = reorderList(colTasks, dragged.id, task.id)
                          if (reordered !== colTasks) onReorder(reordered.map(t => ({ id: t.id, sort_order: t.sort_order ?? 0 })))
                        }}
                        title="Sleep naar een dag in Week om in te plannen, of op een andere taak om de volgorde te bepalen"
                        style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 11px', background:'var(--bg2)',
                          border:`1px solid ${task.urgent && !klaar ? 'rgba(248,81,73,.35)' : 'var(--border)'}`, borderLeft:`3px solid ${kleur}`, borderRadius:6, cursor:'grab' }}>
                        <button onClick={() => onUpdate(task.id, klaar ? 'backlog' : 'done')}
                          title={klaar ? 'Weer openzetten' : 'Afvinken'} aria-label={`${klaar ? 'Weer openzetten' : 'Afvinken'}: ${task.name}`}
                          style={{ flexShrink:0, width:15, height:15, borderRadius:'50%', cursor:'pointer', padding:0,
                            background: klaar ? 'rgba(63,185,80,.2)' : 'none', border:`2px solid ${klaar ? '#3fb950' : '#374151'}`,
                            color:'#3fb950', fontSize:8, display:'grid', placeItems:'center' }}>
                          {klaar ? '✓' : ''}
                        </button>
                        <span onClick={() => onTaskClick(task)}
                          style={{ flex:1, minWidth:0, fontSize:12, cursor:'pointer', color: klaar ? 'var(--dim)' : 'var(--text)', textDecoration: klaar ? 'line-through' : 'none' }}>
                          {task.name}
                        </span>
                        <ProjectChip proj={proj} kleur={kleur} inline />
                        <DeadlineChip task={task} inline />
                        {!klaar && <PlannedChip date={plannedDates.get(task.id)} inline />}
                        <select value={task.status} onChange={e => onUpdate(task.id, e.target.value as TaskStatus)}
                          aria-label={`Status van ${task.name}`}
                          style={{ fontSize:10, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:4, color:'var(--muted)', padding:'2px 4px', cursor:'pointer', flexShrink:0 }}>
                          <option value="backlog">backlog</option><option value="doing">bezig</option><option value="waiting">wacht</option><option value="done">klaar</option>
                        </select>
                        {onDelete && (
                          <button onClick={() => onDelete(task.id)} title="Naar de prullenbak" aria-label={`Verwijderen: ${task.name}`}
                            style={{ flexShrink:0, background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:11, padding:'0 2px', opacity:.5 }}
                            onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color='#f85149' }}
                            onMouseLeave={e => { e.currentTarget.style.opacity='.5'; e.currentTarget.style.color='var(--dim)' }}>🗑</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              )}
              {col.id === 'backlog' && ingepland.length > 0 && renderIngeplandLijst()}
              </Fragment>
            )
          })}
        </div>
      )}

      {/* ── Prullenbak ─────────────────────────────────────────────────────
          Kleuren blijven hier hetzelfde als in het overzicht: je moet een taak
          kunnen terugvinden aan waar hij bij hoorde. */}
      {trashed.length > 0 && (
        <div style={{ marginTop:24 }}>
          <button onClick={() => { setTrashOpen(o => !o); onFeature?.('taak-prullenbak') }}
            style={{ fontSize:11, color:'var(--dim)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, padding:0 }}>
            {trashOpen ? '▾' : '▸'} 🗑 Prullenbak ({trashed.length})
          </button>
          {trashOpen && (
            <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
              {trashed.map(task => {
                const proj = projects.find(p => p.id === task.proj_id)
                const kleur = taskColor(task)
                return (
                  <div key={task.id}
                    style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 11px', background:'var(--bg2)',
                      border:'1px solid var(--border)', borderLeft:`3px solid ${kleur}`, borderRadius:6 }}>
                    <span style={{ flex:1, minWidth:0, fontSize:12, color:'var(--muted)' }}>{task.name}</span>
                    <ProjectChip proj={proj} kleur={kleur} inline />
                    {onRestore && (
                      <button onClick={() => onRestore(task.id)} aria-label={`Terugzetten: ${task.name}`}
                        style={{ fontSize:10, padding:'2px 8px', borderRadius:5, cursor:'pointer', background:'rgba(63,185,80,.1)', border:'1px solid rgba(63,185,80,.3)', color:'#3fb950' }}>
                        ↩ Terug
                      </button>
                    )}
                    {onPurge && (
                      <button onClick={() => onPurge(task.id)} aria-label={`Definitief verwijderen: ${task.name}`}
                        title="Definitief weg — dit kan niet meer terug"
                        style={{ fontSize:10, padding:'2px 8px', borderRadius:5, cursor:'pointer', background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.25)', color:'#f87171' }}>
                        ✕ Definitief
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Het project waar een taak bij hoort, in de kleur van zijn levensgebied. */
function ProjectChip({ proj, kleur, inline = false }: { proj?: Project; kleur: string; inline?: boolean }) {
  if (!proj) {
    return (
      <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, whiteSpace:'nowrap', flexShrink:0,
        background:`${kleur}14`, border:`1px solid ${kleur}33`, color:kleur, marginTop: inline ? 0 : 5, display:'inline-block' }}
        title="Geen project — staat in de inbox">📥 inbox</span>
    )
  }
  return (
    <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, whiteSpace:'nowrap', flexShrink:0, maxWidth:150, overflow:'hidden', textOverflow:'ellipsis',
      background:`${kleur}14`, border:`1px solid ${kleur}33`, color:kleur, marginTop: inline ? 0 : 5, display:'inline-block' }}
      title={proj.name}>
      {proj.emoji} {proj.name.split('—')[0].trim()}
    </span>
  )
}

/** Deadline-badge, dezelfde stijl als in Doelen/Projecten. Puur informatief
 *  hier — de horizon-schuif-logica zit alleen in de Horizon-weergave. */
function DeadlineChip({ task, inline = false }: { task: Task; inline?: boolean }) {
  if (!task.deadline) return null
  const overdue = task.deadline < new Date().toISOString().slice(0, 10)
  return (
    <span style={{ fontSize:9, color: overdue ? '#f87171' : 'var(--dim)', marginTop: inline ? 0 : 5, display:'inline-block' }}>
      {overdue ? '⚠ ' : ''}{task.deadline}
      {isDeadlinePostponed(task) && (
        <span title={`Deadline verschoven — was ${task.original_deadline}, nu ${task.deadline}`} style={{ marginLeft:3 }}>🔀</span>
      )}
    </span>
  )
}

/** Op welke dag deze taak in je weekplanning staat. */
function PlannedChip({ date, inline = false }: { date?: string; inline?: boolean }) {
  if (!date) return null
  return (
    <span title="Staat in je weekplanning"
      style={{ fontSize:9, padding:'1px 5px', borderRadius:3, whiteSpace:'nowrap', flexShrink:0,
        background:`${PLANNED_COLOR}14`, border:`1px solid ${PLANNED_COLOR}33`, color:PLANNED_COLOR,
        marginTop: inline ? 0 : 5, marginLeft: inline ? 0 : 4, display:'inline-block' }}>
      📅 {formatPlannedDate(date)}
    </span>
  )
}

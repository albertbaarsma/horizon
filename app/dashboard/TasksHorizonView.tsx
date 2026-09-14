'use client'
// ─── TasksHorizonView ───────────────────────────────────────────────────────
// Taken op dezelfde horizon-schaal als Doelen en Projecten (nu..ooit), i.p.v.
// op status. Dit is een vooruitkijk-weergave, geen archief: klaar-gezette
// taken verdwijnen hier meteen (zoals in Kanban/Lijst blijft afvinken gewoon
// mogelijk vanaf de kaart zelf).
import { useState } from 'react'
import type { Task, Project, GoalHorizon, TaskStatus } from '@/lib/types'
import { HORIZON_ORDER, HORIZON_META } from '@/lib/goal-horizons'
import { categoryColorMap } from '@/lib/category-colors'
import { INBOX_COLOR } from '@/lib/graph-layout'
import { effectiveHorizon, isDeadlinePostponed } from '@/lib/deadline-horizon'
import { TASK_MIME } from '@/lib/drag-mime'
import { reorderList } from '@/lib/reorder'
import { HorizonColumns } from './HorizonColumns'

/** Alleen voor het herordenen tussen horizon-kolommen hier — TASK_MIME (het
 *  algemene "dit is een taak"-signaal) gaat er ook op mee, voor dropzones
 *  buiten deze view (bv. een dag in WeekTab). */
const TASK_HORIZON_MIME = 'application/x-albert-task-horizon'

export function TasksHorizonView({ tasks, projects, categories, onSelect, onUpdate, onMoveHorizon, onReorder, onDelete }: {
  /** Alleen levende taken (geen prullenbak) — klaar wordt hier zelf uitgefilterd. */
  tasks: Task[]
  projects: Project[]
  categories: { id: string; name: string }[]
  onSelect: (t: Task) => void
  onUpdate: (id: number, s: TaskStatus) => void
  /** Taak naar een andere horizon slepen; null = terug naar "nog niet ingedeeld". */
  onMoveHorizon: (id: number, horizon: GoalHorizon | null) => void
  /** Handmatig herschikken binnen dezelfde horizon-kolom (drop op een andere kaart, niet op de kolom zelf). */
  onReorder: (updates: { id: number; sort_order: number }[]) => void
  onDelete?: (id: number) => void
}) {
  const [dragId, setDragId] = useState<number | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const catColor = categoryColorMap(categories)
  const today = new Date().toISOString().slice(0, 10)

  const actief = tasks.filter(t => t.status !== 'done')
  const onbekend = actief.filter(t => !effectiveHorizon(t, today))
  const gesleept = dragId !== null ? tasks.find(t => t.id === dragId) ?? null : null

  function kleurVan(t: Task): string {
    const proj = projects.find(p => p.id === t.proj_id)
    if (!proj) return INBOX_COLOR
    return catColor.get(proj.cat_id) ?? '#818cf8'
  }

  function kaart(t: Task, kolomHorizon: GoalHorizon) {
    const proj = projects.find(p => p.id === t.proj_id)
    const kleur = kleurVan(t)
    return (
      <div key={t.id}
        draggable
        title="Sleep naar een andere horizon, of op een andere kaart om de volgorde te bepalen — klik om te openen"
        onDragStart={e => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData(TASK_HORIZON_MIME, String(t.id))
          e.dataTransfer.setData(TASK_MIME, String(t.id))
          e.dataTransfer.setData('text/plain', t.name)
          setDragId(t.id)
        }}
        onDragEnd={() => { setDragId(null); setOverCol(null) }}
        onDragOver={e => {
          if (!e.dataTransfer.types.includes(TASK_HORIZON_MIME)) return
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={e => {
          if (!e.dataTransfer.types.includes(TASK_HORIZON_MIME)) return
          e.preventDefault()
          e.stopPropagation()
          const id = Number(e.dataTransfer.getData(TASK_HORIZON_MIME))
          setDragId(null); setOverCol(null)
          if (id === t.id) return
          const dragged = tasks.find(x => x.id === id)
          if (!dragged) return
          if (effectiveHorizon(dragged, today) === kolomHorizon) {
            const kolomItems = actief.filter(x => effectiveHorizon(x, today) === kolomHorizon)
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            const reordered = reorderList(kolomItems, dragged.id, t.id)
            if (reordered !== kolomItems) onReorder(reordered.map(x => ({ id: x.id, sort_order: x.sort_order ?? 0 })))
          } else {
            onMoveHorizon(dragged.id, kolomHorizon)
          }
        }}
        style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'7px 9px', borderRadius:5, marginBottom:3, fontSize:12, lineHeight:1.4, background:'rgba(255,255,255,.02)', border:`1px solid ${t.urgent ? 'rgba(248,81,73,.35)' : 'var(--border)'}`, cursor: dragId === t.id ? 'grabbing' : 'grab', opacity: dragId === t.id ? .4 : 1, transition:'background .1s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}>
        <button onClick={e => { e.stopPropagation(); onUpdate(t.id, 'done') }}
          title="Afvinken" aria-label={`Afvinken: ${t.name}`}
          style={{ flexShrink:0, width:15, height:15, marginTop:1, borderRadius:'50%', cursor:'pointer', padding:0,
            background:'none', border:'2px solid #374151', color:'#3fb950', fontSize:8, display:'grid', placeItems:'center' }} />
        <div onClick={() => onSelect(t)} style={{ flex:1, minWidth:0 }}>
          {(t.urgent || !!t.priority) && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
              {t.urgent && <span style={{ fontSize:9, color:'#f87171', fontWeight:700, letterSpacing:'0.5px' }}>🔴 URGENT</span>}
              {!!t.priority && <span style={{ fontSize:9, color:'#fbbf24', fontWeight:700, letterSpacing:'0.5px' }}>🔺 P{t.priority}</span>}
            </div>
          )}
          <div style={{ color:'var(--text)' }}>{t.name}</div>
          <div style={{ marginTop:4 }}>
            <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, whiteSpace:'nowrap', maxWidth:170, overflow:'hidden', textOverflow:'ellipsis', display:'inline-block', background:`${kleur}18`, border:`1px solid ${kleur}44`, color:kleur }}>
              {proj ? `${proj.emoji} ${proj.name.split('—')[0].trim()}` : '📥 inbox'}
            </span>
          </div>
          {t.deadline && (() => {
            const overdue = t.deadline < today
            return (
              <div style={{ marginTop:4, fontSize:9, color:overdue?'#f87171':'var(--dim)' }}>
                {overdue?'⚠ ':''}{t.deadline}
                {isDeadlinePostponed(t) && (
                  <span title={`Deadline verschoven — was ${t.original_deadline}, nu ${t.deadline}`} style={{ marginLeft:3 }}>🔀</span>
                )}
              </div>
            )
          })()}
        </div>
        {onDelete && (
          <button onClick={e => { e.stopPropagation(); onDelete(t.id) }}
            title="Naar de prullenbak" aria-label={`Verwijderen: ${t.name}`}
            style={{ flexShrink:0, background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:11, padding:'0 2px', opacity:.5 }}
            onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color='#f85149' }}
            onMouseLeave={e => { e.currentTarget.style.opacity='.5'; e.currentTarget.style.color='var(--dim)' }}>🗑</button>
        )}
      </div>
    )
  }

  function renderKolom(h: GoalHorizon) {
    const meta = HORIZON_META[h]
    const items = actief.filter(t => effectiveHorizon(t, today) === h)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    // Zelfde reden als bij Projecten: geen taken staan hier al ingedeeld, dus
    // elke horizon blijft een zichtbaar sleepdoel, ook leeg.
    const dropHier = gesleept !== null && effectiveHorizon(gesleept, today) !== h && overCol === h
    return (
      <div key={h}
        data-horizon={h}
        onDragOver={e => {
          if (!e.dataTransfer.types.includes(TASK_HORIZON_MIME)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setOverCol(h)
        }}
        onDragLeave={() => setOverCol(k => k === h ? null : k)}
        onDrop={e => {
          e.preventDefault()
          setDragId(null); setOverCol(null)
          const id = Number(e.dataTransfer.getData(TASK_HORIZON_MIME))
          const t = tasks.find(x => x.id === id)
          if (t && effectiveHorizon(t, today) !== h) onMoveHorizon(t.id, h)
        }}
        style={{ background: dropHier ? `${meta.color}14` : 'var(--bg2)', border:`1px solid ${dropHier ? meta.color : 'var(--border)'}`, borderRadius:8, overflow:'hidden', transition:'background .1s, border-color .1s' }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:12, fontWeight:700, color:meta.color, flex:1 }}>{meta.icon} {meta.label}</span>
          <span style={{ fontSize:10, color:'var(--dim)', background:'var(--bg3)', padding:'1px 7px', borderRadius:8, border:'1px solid var(--border)' }}>{items.length}</span>
        </div>
        <div style={{ padding:'8px' }}>
          {items.length === 0
            ? <div style={{ fontSize:11, color:'var(--dim)', fontStyle:'italic', padding:'10px 4px' }}>Sleep hier een taak naartoe</div>
            : items.map(t => kaart(t, h))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Altijd zichtbaar, ook leeg — anders kun je een taak nooit terug naar
          "nog niet ingedeeld" slepen zodra alles al is ingedeeld. */}
      <div style={{ marginBottom:20, padding:'12px 14px', background: onbekend.length ? 'rgba(251,191,36,.05)' : 'var(--bg2)', border: onbekend.length ? '1px dashed rgba(251,191,36,.3)' : '1px dashed var(--border)', borderRadius:8 }}
        onDragOver={e => { if (e.dataTransfer.types.includes(TASK_HORIZON_MIME)) e.preventDefault() }}
        onDrop={e => {
          e.preventDefault()
          const id = Number(e.dataTransfer.getData(TASK_HORIZON_MIME))
          const t = tasks.find(x => x.id === id)
          if (t && effectiveHorizon(t, today)) onMoveHorizon(t.id, null)
          setDragId(null); setOverCol(null)
        }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.4px', textTransform:'uppercase', color: onbekend.length ? '#fbbf24' : 'var(--dim)', marginBottom: onbekend.length ? 8 : 0 }}>
          📥 Nog niet ingedeeld ({onbekend.length}) — sleep naar een horizon hieronder
        </div>
        {onbekend.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {onbekend.map(t => (
              <div key={t.id}
                onClick={() => onSelect(t)}
                draggable
                title="Sleep naar een horizon — klik om te openen"
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData(TASK_HORIZON_MIME, String(t.id)); e.dataTransfer.setData(TASK_MIME, String(t.id)); setDragId(t.id) }}
                onDragEnd={() => setDragId(null)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:20, background:'rgba(255,255,255,.04)', border:'1px solid var(--border)', fontSize:12, cursor: dragId === t.id ? 'grabbing' : 'grab', opacity: dragId === t.id ? .4 : 1 }}>
                <span style={{ color:'var(--text)' }}>{t.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <HorizonColumns columns={HORIZON_ORDER.map(h => ({ key: h, content: renderKolom(h) }))} storageKey="taken-lang-open" />
    </div>
  )
}

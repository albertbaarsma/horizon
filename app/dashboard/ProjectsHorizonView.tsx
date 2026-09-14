'use client'
// ─── ProjectsHorizonView ────────────────────────────────────────────────────
// Projecten op dezelfde horizon-schaal als Doelen (nu..ooit), i.p.v. op
// status/sectie. Een project met sub-projecten valt hier uit elkaar: elk
// sub-project heeft zijn eigen horizon en verschijnt als eigen kaart, met een
// "↳ onder ..." verwijzing naar het hoofdproject — geen geneste groepen zoals
// in de sectie-weergave.
import { useState } from 'react'
import type { Project, Task, GoalHorizon } from '@/lib/types'
import { HORIZON_ORDER, HORIZON_META } from '@/lib/goal-horizons'
import { categoryColorMap } from '@/lib/category-colors'
import { effectiveHorizon, isDeadlinePostponed } from '@/lib/deadline-horizon'
import { reorderList } from '@/lib/reorder'
import { HorizonColumns } from './HorizonColumns'

const PROJ_MIME = 'application/x-albert-project-horizon'

export function ProjectsHorizonView({ projects, tasks, categories, onSelect, onMoveHorizon, onReorder, onToggleDone, onDelete }: {
  projects: Project[]
  tasks: Task[]
  categories: { id: string; name: string }[]
  onSelect: (p: Project) => void
  /** Project naar een andere horizon slepen; null = terug naar "nog niet ingedeeld". */
  onMoveHorizon: (id: string, horizon: GoalHorizon | null) => void
  /** Handmatig herschikken binnen dezelfde horizon-kolom (drop op een andere kaart, niet op de kolom zelf). */
  onReorder: (updates: { id: string; sort_order: number }[]) => void
  /** Project als klaar markeren (naar archief) — verdwijnt daarna uit deze weergave. */
  onToggleDone: (p: Project) => void
  onDelete: (p: Project) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const catColor = categoryColorMap(categories)
  const today = new Date().toISOString().slice(0, 10)

  const actief = projects.filter(p => p.status !== 'archief')
  const onbekend = actief.filter(p => !effectiveHorizon(p, today))
  const gesleept = dragId ? projects.find(p => p.id === dragId) ?? null : null

  function kaart(p: Project, kolomHorizon: GoalHorizon) {
    const cat = categories.find(c => c.id === p.cat_id)
    const parent = p.parent_id ? projects.find(x => x.id === p.parent_id) : null
    const kleur = cat ? catColor.get(cat.id) ?? '#818cf8' : null
    // Eigen taken van dit kaartje — sub-projecten vallen hier al apart uit
    // elkaar, dus geen aggregatie zoals in de sectie-weergave nodig.
    const pt = tasks.filter(t => t.proj_id === p.id)
    const open = pt.filter(t => t.status !== 'done')
    return (
      <div key={p.id}
        onClick={() => onSelect(p)}
        draggable
        title="Sleep naar een andere horizon, of op een andere kaart om de volgorde te bepalen — klik om te openen"
        onDragStart={e => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData(PROJ_MIME, p.id)
          e.dataTransfer.setData('text/plain', p.name)
          setDragId(p.id)
        }}
        onDragEnd={() => { setDragId(null); setOverCol(null) }}
        onDragOver={e => {
          if (!e.dataTransfer.types.includes(PROJ_MIME)) return
          e.preventDefault()
          e.stopPropagation()   // niet ook de kolom-drop laten triggeren
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={e => {
          if (!e.dataTransfer.types.includes(PROJ_MIME)) return
          e.preventDefault()
          e.stopPropagation()
          const id = e.dataTransfer.getData(PROJ_MIME)
          setDragId(null); setOverCol(null)
          if (id === p.id) return
          const dragged = projects.find(x => x.id === id)
          if (!dragged) return
          if (effectiveHorizon(dragged, today) === kolomHorizon) {
            // Zelfde kolom: puur herschikken.
            const kolomItems = actief.filter(x => effectiveHorizon(x, today) === kolomHorizon)
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            const reordered = reorderList(kolomItems, dragged.id, p.id)
            if (reordered !== kolomItems) onReorder(reordered.map(x => ({ id: x.id, sort_order: x.sort_order ?? 0 })))
          } else {
            // Andere kolom: gewoon de horizon aanpassen, zoals een drop op de kolom zelf.
            onMoveHorizon(dragged.id, kolomHorizon)
          }
        }}
        style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'7px 9px', borderRadius:5, marginBottom:3, fontSize:12, lineHeight:1.4, background:'rgba(255,255,255,.02)', border:'1px solid var(--border)', cursor: dragId === p.id ? 'grabbing' : 'grab', opacity: dragId === p.id ? .4 : 1, transition:'background .1s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}>
        <button
          onClick={e => { e.stopPropagation(); onToggleDone(p) }}
          title="Markeer als klaar (naar archief)"
          aria-label={`${p.name} markeren als klaar`}
          style={{ flexShrink:0, marginTop:1, width:15, height:15, borderRadius:'50%', cursor:'pointer', padding:0,
            background:'none', border:'2px solid #374151', color:'#3fb950', fontSize:8, display:'grid', placeItems:'center' }} />
        <span style={{ fontSize:14, flexShrink:0, lineHeight:1.3 }}>{p.emoji}</span>
        <div style={{ flex:1, minWidth:0 }}>
          {parent && <div style={{ fontSize:9, color:'#64748b', marginBottom:2 }}>↳ onder &ldquo;{parent.name.split('—')[0].trim()}&rdquo;</div>}
          <div style={{ color:'var(--text)' }}>{p.name}</div>
          {cat && (
            <div style={{ marginTop:4 }}>
              <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:`${kleur}18`, border:`1px solid ${kleur}44`, color:kleur ?? undefined }}>{cat.name}</span>
            </div>
          )}
          {p.deadline && (() => {
            const overdue = p.deadline < today
            return (
              <div style={{ marginTop:4, fontSize:9, color:overdue?'#f87171':'var(--dim)' }}>
                {overdue?'⚠ ':''}{p.deadline}
                {isDeadlinePostponed(p) && (
                  <span title={`Deadline verschoven — was ${p.original_deadline}, nu ${p.deadline}`} style={{ marginLeft:3 }}>🔀</span>
                )}
              </div>
            )
          })()}
          {/* Welke taken hierbij horen moet je hier al kunnen zien, niet pas na een klik. */}
          {open.length > 0 && (
            <div style={{ marginTop:5 }}>
              {open.slice(0, 3).map(t => (
                <div key={t.id} style={{ fontSize:9.5, color:'var(--dim)', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  · {t.name}
                </div>
              ))}
              {open.length > 3 && <div style={{ fontSize:9, color:'var(--dim)', opacity:.7 }}>+{open.length - 3} meer · {pt.length - open.length}/{pt.length} klaar</div>}
              {open.length <= 3 && pt.length > open.length && <div style={{ fontSize:9, color:'var(--dim)', opacity:.7 }}>{pt.length - open.length}/{pt.length} klaar</div>}
            </div>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(p) }}
          title="Verwijderen"
          style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--dim)', padding:'0 2px', lineHeight:1 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--dim)' }}>
          🗑
        </button>
      </div>
    )
  }

  function renderKolom(h: GoalHorizon) {
    const meta = HORIZON_META[h]
    const items = actief.filter(p => effectiveHorizon(p, today) === h)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    // Anders dan Doelen zijn hier geen 34 items al ingedeeld — elke horizon
    // blijft dus een zichtbaar sleepdoel, ook leeg, anders kun je een lege
    // horizon nooit voor het eerst vullen.
    const dropHier = gesleept !== null && effectiveHorizon(gesleept, today) !== h && overCol === h
    return (
      <div key={h}
        data-horizon={h}
        onDragOver={e => {
          if (!e.dataTransfer.types.includes(PROJ_MIME)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setOverCol(h)
        }}
        onDragLeave={() => setOverCol(k => k === h ? null : k)}
        onDrop={e => {
          e.preventDefault()
          setDragId(null); setOverCol(null)
          const id = e.dataTransfer.getData(PROJ_MIME)
          const p = projects.find(x => x.id === id)
          if (p && effectiveHorizon(p, today) !== h) onMoveHorizon(p.id, h)
        }}
        style={{ background: dropHier ? `${meta.color}14` : 'var(--bg2)', border:`1px solid ${dropHier ? meta.color : 'var(--border)'}`, borderRadius:8, overflow:'hidden', transition:'background .1s, border-color .1s' }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:12, fontWeight:700, color:meta.color, flex:1 }}>{meta.icon} {meta.label}</span>
          <span style={{ fontSize:10, color:'var(--dim)', background:'var(--bg3)', padding:'1px 7px', borderRadius:8, border:'1px solid var(--border)' }}>{items.length}</span>
        </div>
        <div style={{ padding:'8px' }}>
          {items.length === 0
            ? <div style={{ fontSize:11, color:'var(--dim)', fontStyle:'italic', padding:'10px 4px' }}>Sleep hier een project naartoe</div>
            : items.map(p => kaart(p, h))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Altijd zichtbaar, ook leeg — anders kun je een project nooit terug
          naar "nog niet ingedeeld" slepen zodra alles al is ingedeeld. */}
      <div style={{ marginBottom:20, padding:'12px 14px', background: onbekend.length ? 'rgba(251,191,36,.05)' : 'var(--bg2)', border: onbekend.length ? '1px dashed rgba(251,191,36,.3)' : '1px dashed var(--border)', borderRadius:8 }}
        onDragOver={e => { if (e.dataTransfer.types.includes(PROJ_MIME)) e.preventDefault() }}
        onDrop={e => {
          e.preventDefault()
          const id = e.dataTransfer.getData(PROJ_MIME)
          const p = projects.find(x => x.id === id)
          if (p && effectiveHorizon(p, today)) onMoveHorizon(p.id, null)
          setDragId(null); setOverCol(null)
        }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.4px', textTransform:'uppercase', color: onbekend.length ? '#fbbf24' : 'var(--dim)', marginBottom: onbekend.length ? 8 : 0 }}>
          📥 Nog niet ingedeeld ({onbekend.length}) — sleep naar een horizon hieronder
        </div>
        {onbekend.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {onbekend.map(p => (
              <div key={p.id}
                onClick={() => onSelect(p)}
                draggable
                title="Sleep naar een horizon — klik om te openen"
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData(PROJ_MIME, p.id); setDragId(p.id) }}
                onDragEnd={() => setDragId(null)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:20, background:'rgba(255,255,255,.04)', border:'1px solid var(--border)', fontSize:12, cursor: dragId === p.id ? 'grabbing' : 'grab', opacity: dragId === p.id ? .4 : 1 }}>
                <span>{p.emoji}</span>
                <span style={{ color:'var(--text)' }}>{p.name.split('—')[0].trim()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <HorizonColumns columns={HORIZON_ORDER.map(h => ({ key: h, content: renderKolom(h) }))} storageKey="projecten-lang-open" />
    </div>
  )
}

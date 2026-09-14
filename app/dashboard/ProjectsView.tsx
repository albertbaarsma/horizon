'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Project, Task, TaskStatus, ProjectStatus, GoalHorizon } from '@/lib/types'
import { deleteProjectEverywhere } from '@/lib/project-delete'
import { beoordeelUitwerking, uitwerkPrompt } from '@/lib/project-depth'
import { resolveHorizonDrop, withOriginalDeadline, isDeadlinePostponed } from '@/lib/deadline-horizon'
import { reorderList } from '@/lib/reorder'
import { projectSlug } from '@/lib/project-slug'
import { CopyPromptButton } from './PromptButton'
import { Attachments } from './Attachments'
import { ProjectsHorizonView } from './ProjectsHorizonView'

const STATUS_COLORS: Record<string, string> = {
  actief: '#3fb950', lopend: '#58a6ff', urgent: '#f85149',
  soon: '#d29922', visie: '#bc8cff', slapend: '#484f58',
  onzeker: '#fb8f44', love: '#f778ba', archief: '#6e7681',
}
const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: '#484f58', doing: '#58a6ff', waiting: '#d29922', done: '#3fb950',
}

// ─── Secties ──────────────────────────────────────────────────────────────────
// Waar een project kan staan. Slepen naar een sectie en "verplaats naar" in het
// kaartmenu doen precies hetzelfde — daarom staat de vertaling hier, één keer.

export type SectionKind = 'priority' | 'active' | 'routines' | 'sleeping' | 'archive'

export const SECTIES: { kind: SectionKind; label: string; kleur: string }[] = [
  { kind: 'priority', label: '⭐ Prioriteiten',    kleur: '#fbbf24' },
  { kind: 'active',   label: '🗂 Overige projecten', kleur: '#818cf8' },
  { kind: 'routines', label: '🔄 Routines',        kleur: '#34d399' },
  { kind: 'sleeping', label: '💤 Slapend / visie', kleur: '#7d8590' },
  { kind: 'archive',  label: '✅ Gedaan / archief', kleur: '#3fb950' },
]

/** Wat er met een project gebeurt als het in deze sectie belandt. */
export function sectionPatch(kind: SectionKind, p: Pick<Project, 'status'>): Partial<Project> {
  const wakker = ['slapend','visie','archief'].includes(p.status)
  switch (kind) {
    case 'priority': return { is_priority: true,  proj_type: 'project', status: wakker ? 'actief' : p.status }
    case 'active':   return { is_priority: false, proj_type: 'project', status: wakker ? 'lopend' : p.status }
    case 'routines': return { is_priority: false, proj_type: 'routine', status: wakker ? 'actief' : p.status }
    case 'sleeping': return { is_priority: false, proj_type: 'project', status: 'slapend' }
    case 'archive':  return { is_priority: false, status: 'archief' }
  }
}

/** In welke sectie staat dit project nu? Voorkomt "verplaats naar waar je al staat". */
export function huidigeSectie(p: Pick<Project, 'status' | 'proj_type' | 'is_priority'>): SectionKind {
  if (p.status === 'archief') return 'archive'
  if (p.status === 'slapend' || p.status === 'visie') return 'sleeping'
  if (p.proj_type === 'routine') return 'routines'
  return p.is_priority ? 'priority' : 'active'
}

// ─── RpmSectionHead ───────────────────────────────────────────────────────────

export function RpmSectionHead({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.9px', textTransform:'uppercase', color, marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
      {icon} {label}
      <span style={{ flex:1, height:1, background:`${color}33`, display:'block' }} />
    </div>
  )
}

// ─── ProjectActions ───────────────────────────────────────────────────────────
// Afvinken, verplaatsen en weggooien zonder de kaart eerst te openen. Stond
// eerder verspreid: klaar kon alleen door naar het archief te slepen, en
// verwijderen alleen binnenin het projectvenster.

export interface ProjectActieProps {
  p: Project
  categories: { id: string; name: string }[]
  /** Aantal taken dat aan dit project hangt — voor de bevestigingsvraag. */
  taakAantal?: number
  subAantal?: number
  onMove: (kind: SectionKind) => void
  onMoveCategory: (catId: string) => void
  onDelete: () => void
}

type Menu = null | 'verplaats' | 'weg'

export function ProjectActions({ p, categories, taakAantal = 0, subAantal = 0, onMove, onMoveCategory, onDelete, menu, setMenu }:
  ProjectActieProps & { menu: Menu; setMenu: (m: Menu) => void }) {
  const klaar = p.status === 'archief'
  const nu    = huidigeSectie(p)
  const stop  = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault() }

  // Losse randeigenschappen, geen `border`-afkorting: React waarschuwt terecht
  // als je beide door elkaar gebruikt en de kleur per knop overschrijft.
  const knop = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    fontSize: 11, lineHeight: 1, padding: '4px 7px', borderRadius: 6, cursor: 'pointer',
    background: 'var(--bg3)', color: 'var(--muted)',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', ...extra,
  })

  return (
    <div onClick={stop} onDragStart={stop} style={{ display: 'flex', gap: 4, position: 'relative' }}>
      <button
        onClick={e => { stop(e); onMove(klaar ? 'active' : 'archive') }}
        title={klaar ? 'Weer oppakken — terug naar je projecten' : 'Markeer als klaar (naar archief)'}
        aria-label={klaar ? `${p.name} weer oppakken` : `${p.name} markeren als klaar`}
        style={knop(klaar
          ? { color: '#58a6ff', borderColor: 'rgba(88,166,255,.35)', background: 'rgba(88,166,255,.1)' }
          : { color: '#3fb950', borderColor: 'rgba(63,185,80,.35)', background: 'rgba(63,185,80,.1)' })}>
        {klaar ? '↩' : '✓'}
      </button>

      <button
        onClick={e => { stop(e); setMenu(menu === 'verplaats' ? null : 'verplaats') }}
        title="Verplaats naar een andere sectie of categorie"
        aria-label={`${p.name} verplaatsen`}
        style={knop(menu === 'verplaats' ? { color: '#818cf8', borderColor: 'rgba(99,102,241,.45)' } : {})}>
        ⇄
      </button>

      <button
        onClick={e => { stop(e); setMenu(menu === 'weg' ? null : 'weg') }}
        title="Project verwijderen"
        aria-label={`${p.name} verwijderen`}
        style={knop(menu === 'weg' ? { color: '#f85149', borderColor: 'rgba(248,81,73,.45)' } : {})}>
        🗑
      </button>

      {menu === 'verplaats' && (
        <div role="menu" aria-label="Verplaats naar"
          style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, zIndex: 30, width: 210,
            background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 9, padding: 6,
            boxShadow: '0 12px 32px rgba(0,0,0,.55)', maxHeight: 300, overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--dim)', padding: '4px 7px' }}>Sectie</div>
          {SECTIES.map(s => (
            <button key={s.kind} role="menuitem" disabled={s.kind === nu}
              onClick={e => { stop(e); onMove(s.kind); setMenu(null) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 11.5, padding: '6px 7px', borderRadius: 6,
                background: 'none', border: 'none', cursor: s.kind === nu ? 'default' : 'pointer',
                color: s.kind === nu ? 'var(--dim)' : s.kleur, opacity: s.kind === nu ? .5 : 1 }}
              onMouseEnter={e => { if (s.kind !== nu) e.currentTarget.style.background = 'var(--bg3)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
              {s.label}{s.kind === nu && ' · staat hier'}
            </button>
          ))}
          {categories.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--dim)', padding: '8px 7px 4px', borderTop: '1px solid var(--border)', marginTop: 4 }}>Levensgebied</div>
              {categories.map(c => (
                <button key={c.id} role="menuitem" disabled={c.id === p.cat_id}
                  onClick={e => { stop(e); onMoveCategory(c.id); setMenu(null) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 11.5, padding: '6px 7px', borderRadius: 6,
                    background: 'none', border: 'none', cursor: c.id === p.cat_id ? 'default' : 'pointer',
                    color: c.id === p.cat_id ? 'var(--dim)' : 'var(--text)', opacity: c.id === p.cat_id ? .5 : 1 }}
                  onMouseEnter={e => { if (c.id !== p.cat_id) e.currentTarget.style.background = 'var(--bg3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                  {c.name}{c.id === p.cat_id && ' · huidig'}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {menu === 'weg' && (
        <div role="dialog" aria-label={`${p.name} verwijderen`}
          style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, zIndex: 30, width: 236,
            background: 'var(--bg2)', border: '1px solid rgba(248,81,73,.4)', borderRadius: 9, padding: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,.55)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>“{p.name}” verwijderen?</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 10 }}>
            Dit kan niet ongedaan worden — projecten hebben geen prullenbak.
            {taakAantal > 0 && <> {taakAantal} {taakAantal === 1 ? 'taak gaat' : 'taken gaan'} naar je inbox.</>}
            {subAantal > 0 && <> {subAantal} sub-{subAantal === 1 ? 'project blijft' : 'projecten blijven'} bestaan, los van dit project.</>}
            <br />
            <span style={{ color: 'var(--dim)' }}>Klaar in plaats van weg? Gebruik ✓.</span>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={e => { stop(e); setMenu(null) }} style={knop({ padding: '5px 11px', fontSize: 11.5 })}>Annuleer</button>
            <button onClick={e => { stop(e); setMenu(null); onDelete() }}
              style={knop({ padding: '5px 11px', fontSize: 11.5, color: '#fff', background: '#b62324', borderColor: '#f85149', fontWeight: 600 })}>
              Verwijder
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

export function ProjectCard({ p, tasks, subProjects = [], expanded = false, onToggleExpand, onArchiveGroup, onSelect, onTogglePriority, dragging, dragOver,
  onDragStart, onDragEnter, onDragEnd, onSubDragStart, onSubDragEnd, nestDropActive = false, onNestDrop,
  categories = [], onMove, onMoveCategory, onDelete }: {
  p: Project; tasks: Task[]
  subProjects?: Project[]
  expanded?: boolean
  onToggleExpand?: () => void
  onArchiveGroup?: () => void
  onSelect: (p: Project) => void
  onTogglePriority: (p: Project) => void
  dragging: boolean; dragOver: boolean
  onDragStart: () => void; onDragEnter: () => void; onDragEnd: () => void
  onSubDragStart?: (id: string) => void
  onSubDragEnd?: () => void
  nestDropActive?: boolean         // er wordt een sub-project gesleept en deze kaart is een geldig doel
  onNestDrop?: () => void
  categories?: { id: string; name: string }[]
  /** Zonder deze drie verschijnt de actiebalk niet — handig voor read-only weergaves. */
  onMove?: (p: Project, kind: SectionKind) => void
  onMoveCategory?: (p: Project, catId: string) => void
  onDelete?: (p: Project) => void
}) {
  const isGroup = subProjects.length > 0
  const [menu, setMenu] = useState<Menu>(null)

  const acties = onMove && onMoveCategory && onDelete ? (
    <div>
      <ProjectActions
        p={p} categories={categories} menu={menu} setMenu={setMenu}
        taakAantal={tasks.filter(t => t.proj_id === p.id).length}
        subAantal={subProjects.length}
        onMove={kind => onMove(p, kind)}
        onMoveCategory={catId => onMoveCategory(p, catId)}
        onDelete={() => onDelete(p)}
      />
    </div>
  ) : null
  // Drop-handler voor het nesten van een gesleept (sub-)project op deze kaart.
  // Nest alleen als er op het midden van de kaart gedropt wordt; de randen
  // blijven voor het gewone herordenen/verplaatsen — anders kun je nooit meer
  // twee losse projecten naast elkaar zetten zonder ze meteen te groeperen.
  const nestHandlers = {
    onDrop: (e: React.DragEvent) => {
      if (!nestDropActive) return
      const rect = e.currentTarget.getBoundingClientRect()
      const relY = (e.clientY - rect.top) / rect.height
      if (relY < 0.25 || relY > 0.75) return
      e.preventDefault(); e.stopPropagation()
      onNestDrop?.()
    },
  }
  // Taken van het project zelf + van alle sub-projecten
  const subIds = new Set(subProjects.map(s => s.id))
  const pt     = tasks.filter(t => t.proj_id === p.id || (t.proj_id && subIds.has(t.proj_id)))
  const done   = pt.filter(t => t.status === 'done').length
  const urgent = pt.some(t => t.urgent && t.status !== 'done')

  const starBtn = (
    <button
      onClick={e => { e.stopPropagation(); onTogglePriority(p) }}
      title={p.is_priority ? 'Verwijder uit prioriteiten' : 'Voeg toe aan prioriteiten'}
      aria-label={p.is_priority ? 'Verwijder uit prioriteiten' : 'Voeg toe aan prioriteiten'}
      style={{ position:'absolute', top:6, right:8, background:'none', border:'none', cursor:'pointer', fontSize:13, color: p.is_priority ? '#fbbf24' : 'rgba(255,255,255,.15)', padding:'2px', lineHeight:1, transition:'color .15s' }}
      onMouseEnter={e => { e.stopPropagation(); (e.target as HTMLElement).style.color='#fbbf24' }}
      onMouseLeave={e => { (e.target as HTMLElement).style.color = p.is_priority ? '#fbbf24' : 'rgba(255,255,255,.15)' }}>
      ★
    </button>
  )

  // ── Uitgeklapte projectgroep: 2×2 kaartvakken, sub-projecten als mini-kaarten ──
  if (isGroup && expanded) {
    const ownTasks = tasks.filter(t => t.proj_id === p.id)
    return (
      <div
        draggable
        onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd}
        onDragOver={e => e.preventDefault()}
        {...nestHandlers}
        style={{ gridColumn:'span 2', gridRow:'span 2', background:'linear-gradient(160deg, rgba(99,102,241,.09) 0%, var(--bg2) 45%)', border:`2px solid ${dragOver?'#6366f1':'rgba(99,102,241,.35)'}`, borderRadius:12, padding:'14px 16px', position:'relative', opacity: dragging ? 0.4 : 1, display:'flex', flexDirection:'column', gap:10 }}>
        {starBtn}
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingRight:20 }}>
          <span style={{ fontSize:26 }}>{p.emoji}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, lineHeight:1.25 }}>{p.name}</div>
            <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:3 }}>
              <span style={{ fontSize:9, padding:'1px 7px', borderRadius:10, background:'var(--bg3)', color:STATUS_COLORS[p.status]??'var(--muted)', border:`1px solid ${STATUS_COLORS[p.status]??'var(--border)'}33` }}>{p.status}</span>
              <span style={{ fontSize:10, color:'var(--dim)' }}>🧩 {subProjects.length} sub-projecten · {done}/{pt.length} taken · sleep een sub eruit om te verplaatsen</span>
            </div>
          </div>
          {p.status !== 'archief' && (
            <button onClick={e => { e.stopPropagation(); onArchiveGroup?.() }} title="Hele groep (incl. sub-projecten) als klaar/archief markeren"
              style={{ fontSize:10, padding:'4px 10px', borderRadius:6, border:'1px solid rgba(63,185,80,.4)', background:'rgba(63,185,80,.1)', color:'#3fb950', cursor:'pointer', fontWeight:600, flexShrink:0 }}>
              ✓ Alles klaar
            </button>
          )}
          {acties}
          <button onClick={e => { e.stopPropagation(); onSelect(p) }} title="Open dit hoofdproject"
            style={{ fontSize:10, padding:'4px 10px', borderRadius:6, border:'1px solid rgba(99,102,241,.4)', background:'rgba(99,102,241,.12)', color:'#818cf8', cursor:'pointer', fontWeight:600, flexShrink:0 }}>
            Open ↗
          </button>
          <button onClick={e => { e.stopPropagation(); onToggleExpand?.() }} title="Inklappen" aria-label={`${p.name} inklappen`}
            style={{ fontSize:12, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--muted)', cursor:'pointer', flexShrink:0, lineHeight:1 }}>
            ▴
          </button>
        </div>
        {p.description && <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</div>}
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:8, alignContent:'start' }}>
          {subProjects.map(sub => {
            const st     = tasks.filter(t => t.proj_id === sub.id)
            const stDone = st.filter(t => t.status === 'done').length
            const stUrg  = st.some(t => t.urgent && t.status !== 'done')
            const klaar  = sub.status === 'archief'
            return (
              <div key={sub.id} onClick={e => { e.stopPropagation(); onSelect(sub) }} title={`${sub.name} — sleep om te verplaatsen`}
                draggable
                onDragStart={e => { e.stopPropagation(); onSubDragStart?.(sub.id) }}
                onDragEnd={e => { e.stopPropagation(); onSubDragEnd?.() }}
                style={{ background:'var(--bg2)', border:`1.5px solid ${stUrg ? 'rgba(248,81,73,.4)' : 'rgba(99,102,241,.22)'}`, borderRadius:8, padding:'9px 11px', cursor:'grab', transition:'border-color .12s, transform .12s', opacity: klaar ? 0.45 : 1 }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.borderColor='#6366f1' }}
                onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.borderColor = stUrg ? 'rgba(248,81,73,.4)' : 'rgba(99,102,241,.22)' }}>
                <div style={{ fontSize:18, marginBottom:3 }}>{sub.emoji}</div>
                <div style={{ fontSize:11, fontWeight:600, lineHeight:1.3, marginBottom:5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', textDecoration: klaar ? 'line-through' : 'none' }}>{sub.name}</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:9, padding:'1px 6px', borderRadius:10, background:'var(--bg3)', color:STATUS_COLORS[sub.status]??'var(--muted)', border:`1px solid ${STATUS_COLORS[sub.status]??'var(--border)'}33` }}>{sub.status}</span>
                  {st.length > 0 && <span style={{ fontSize:9, color:'var(--dim)' }}>{stDone}/{st.length}</span>}
                </div>
              </div>
            )
          })}
          {ownTasks.length > 0 && (() => {
            const openOwn = ownTasks.filter(t => t.status !== 'done')
            return (
              <div onClick={e => { e.stopPropagation(); onSelect(p) }} title="Taken die direct onder het hoofdproject vallen"
                style={{ border:'1.5px dashed rgba(255,255,255,.14)', borderRadius:8, padding:'9px 11px', cursor:'pointer', display:'flex', flexDirection:'column', gap:3 }}>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>📋 Eigen taken</div>
                {openOwn.slice(0, 3).map(t => (
                  <div key={t.id} style={{ fontSize:10, color:'var(--dim)', lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                    · {t.name}
                  </div>
                ))}
                {openOwn.length > 3 && <div style={{ fontSize:9, color:'var(--dim)', opacity:.7 }}>+{openOwn.length - 3} meer</div>}
                <div style={{ fontSize:10, color:'var(--dim)', marginTop:1 }}>{ownTasks.length - openOwn.length}/{ownTasks.length} klaar</div>
              </div>
            )
          })()}
        </div>
      </div>
    )
  }

  // ── Normale (ingeklapte) kaart ─────────────────────────────────────────────
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      {...nestHandlers}
      onClick={() => isGroup ? onToggleExpand?.() : onSelect(p)}
      style={{ background:'var(--bg2)', border:`2px ${nestDropActive && dragOver ? 'dashed' : 'solid'} ${dragOver?'#6366f1':urgent?'#f85149':isGroup?'rgba(99,102,241,.3)':'var(--border)'}`, borderRadius:8, padding:'10px 12px', cursor:'pointer', transition:'border-color .12s, transform .12s, opacity .12s', position:'relative', opacity: dragging ? 0.4 : 1,
        boxShadow: isGroup ? '3px 3px 0 rgba(99,102,241,.13), 6px 6px 0 rgba(99,102,241,.06)' : undefined }}
      onMouseEnter={e => { if (!dragging) e.currentTarget.style.transform='translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform='' }}>
      {starBtn}
      <div style={{ fontSize:20, marginBottom:5 }}>{p.emoji}</div>
      <div style={{ fontSize:12, fontWeight:600, marginBottom:4, lineHeight:1.3, paddingRight:18 }}>{p.name}</div>
      {p.description && <div style={{ fontSize:11, color:'var(--muted)', marginBottom:7, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</div>}
      {isGroup && (
        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:7, fontSize:10, color:'#a5b4fc' }}>
          🧩 {subProjects.length} sub-projecten
          <span style={{ display:'flex', gap:3 }}>{subProjects.slice(0, 4).map(s => <span key={s.id}>{s.emoji}</span>)}</span>
          <span style={{ marginLeft:'auto', color:'var(--dim)' }}>▾ uitklappen</span>
        </div>
      )}
      {(() => {
        // Welke taken bij dit project horen moet je op de kaart al kunnen zien,
        // niet pas na een klik — vandaar deze mini-preview i.p.v. alleen een getal.
        const open = pt.filter(t => t.status !== 'done')
        return open.length > 0 ? (
          <div style={{ marginBottom:7 }}>
            {open.slice(0, 3).map(t => (
              <div key={t.id} style={{ fontSize:10, color:'var(--dim)', lineHeight:1.35, display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                · {t.name}
              </div>
            ))}
            {open.length > 3 && <div style={{ fontSize:9, color:'var(--dim)', opacity:.7 }}>+{open.length - 3} meer</div>}
          </div>
        ) : null
      })()}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
        <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:'var(--bg3)', color:STATUS_COLORS[p.status]??'var(--muted)', border:`1px solid ${STATUS_COLORS[p.status]??'var(--border)'}33` }}>{p.status}</span>
        {pt.length > 0 && <span style={{ fontSize:10, color:'var(--dim)' }}>{done}/{pt.length}</span>}
        {p.deadline && (() => {
          const overdue = p.deadline < new Date().toISOString().slice(0, 10)
          return (
            <span style={{ fontSize:10, color: overdue ? '#f87171' : 'var(--dim)' }}>
              {overdue ? '⚠ ' : ''}{p.deadline}
              {isDeadlinePostponed(p) && (
                <span title={`Deadline verschoven — was ${p.original_deadline}, nu ${p.deadline}`} style={{ marginLeft:3 }}>🔀</span>
              )}
            </span>
          )
        })()}
        <span style={{ marginLeft:'auto' }}>{acties}</span>
      </div>
    </div>
  )
}

// ─── ProjectsTab ──────────────────────────────────────────────────────────────

export function ProjectsTab({ projects, tasks, categories, onSelect, onUpdateProjects, onCreate }: {
  projects: Project[]; tasks: Task[]; categories: {id:string;name:string}[]
  onSelect: (p: Project) => void
  onUpdateProjects: (updated: Project[]) => void
  onCreate: () => void
}) {
  const supabase = createClient()
  // Twee weergaves: 'secties' (status/activiteit, zoals nu) en 'horizon' (op
  // termijn, zoals Doelen) — een project valt daar uit elkaar in zijn losse
  // sub-projecten, elk met een eigen horizon.
  const [weergave, setWeergave] = useState<'secties'|'horizon'>('secties')
  useEffect(() => {
    const opgeslagen = localStorage.getItem('projecten-weergave')
    if (opgeslagen === 'horizon' || opgeslagen === 'secties') setWeergave(opgeslagen)
  }, [])
  function kiesWeergave(w: 'secties'|'horizon') {
    setWeergave(w)
    try { localStorage.setItem('projecten-weergave', w) } catch { /* niet erg */ }
  }
  const [dragId,    setDragId]    = useState<string|null>(null)
  const [dragOver,  setDragOver]  = useState<string|null>(null)
  const [dragSubId, setDragSubId] = useState<string|null>(null)   // sub-project dat uit een groep wordt gesleept
  // Een top-level project op een ander droppen (midden van de kaart) nest het:
  // zo wordt bv. 'Water op het land' een sub-project van 'Paradijstuin'. Deze
  // ref voorkomt dat de gewone herorden-logica in onDragEnd daarna nog een
  // keer over dezelfde drag heen loopt (dat zou de zojuist gezette parent_id
  // niet ongedaan maken, maar wel onnodig sort_order overschrijven).
  const justNestedRef = useRef(false)
  // Altijd starten met een lege Set — ook op de client, óók als localStorage al
  // uitgeklapte groepen kent. Anders wijkt de eerste client-render af van wat de
  // server rendert (die kent geen localStorage), en gooit React de hele SSR-HTML
  // weg om alsnog client-side te hertekenen (een echte, geziene hydration-fout).
  // De opgeslagen stand komt binnen een tel na de eerste render alsnog binnen.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    try { setExpandedGroups(new Set<string>(JSON.parse(localStorage.getItem('proj-expanded') ?? '[]'))) } catch { /* leeg dan */ }
  }, [])
  // De eerste keer dat dit effect draait komt van het inlezen hierboven, niet
  // van een echte wijziging — zonder deze guard zou het meteen de net gelezen
  // stand overschrijven met de lege beginwaarde van vóór dat het laden klaar was.
  const sloegAlOp = useRef(false)
  useEffect(() => {
    if (!sloegAlOp.current) { sloegAlOp.current = true; return }
    try { localStorage.setItem('proj-expanded', JSON.stringify([...expandedGroups])) } catch { /* quota */ }
  }, [expandedGroups])

  function toggleGroup(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function patchProject(id: string, patch: Partial<Project>) {
    onUpdateProjects(projects.map(x => x.id === id ? { ...x, ...patch } : x))
    await supabase.from('projects').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  }

  /** Heeft het project een deadline, dan verschuift die mee met het slepen
   *  (of laat los bij een langetermijn-kolom of "nog niet ingedeeld") i.p.v.
   *  alleen het horizon-veld te zetten — zie lib/deadline-horizon.ts. */
  function moveProjectHorizon(id: string, horizon: GoalHorizon | null) {
    const p = projects.find(x => x.id === id)
    if (!p) return
    const today = new Date().toISOString().slice(0, 10)
    return patchProject(id, resolveHorizonDrop(p, horizon, today))
  }

  /** Herschikken binnen een horizon-kolom — ProjectsHorizonView heeft de nieuwe
   *  sort_order-waarden al berekend (reorderList), hier alleen nog toepassen + opslaan. */
  function reorderProjectsInHorizon(updates: { id: string; sort_order: number }[]) {
    onUpdateProjects(projects.map(p => {
      const u = updates.find(x => x.id === p.id)
      return u ? { ...p, sort_order: u.sort_order } : p
    }))
    updates.forEach(u => { supabase.from('projects').update({ sort_order: u.sort_order }).eq('id', u.id) })
  }

  // Hele groep (hoofdproject + subs) in één keer naar klaar/archief
  async function archiveGroup(p: Project) {
    const ids = [p.id, ...projects.filter(x => x.parent_id === p.id).map(x => x.id)]
    onUpdateProjects(projects.map(x => ids.includes(x.id) ? { ...x, status: 'archief' as const, is_priority: false } : x))
    await Promise.all(ids.map(id =>
      supabase.from('projects').update({ status: 'archief', is_priority: false, updated_at: new Date().toISOString() }).eq('id', id)
    ))
  }

  const bySort = (a: Project, b: Project) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name)
  // Sub-projecten verschijnen niet als eigen kaart maar als chip op hun hoofdproject
  const top      = projects.filter(p => !p.parent_id)
  const byParent = new Map<string, Project[]>()
  for (const p of projects) {
    if (!p.parent_id) continue
    byParent.set(p.parent_id, [...(byParent.get(p.parent_id) ?? []), p])
  }
  const priority = top.filter(p => p.proj_type === 'project' && p.is_priority && p.status !== 'archief').sort(bySort)
  const active   = top.filter(p => p.proj_type === 'project' && !p.is_priority && !['slapend','visie','archief'].includes(p.status)).sort(bySort)
  const routines = top.filter(p => p.proj_type === 'routine' && p.status !== 'archief').sort(bySort)
  const sleeping = top.filter(p => p.proj_type === 'project' && (p.status === 'slapend' || p.status === 'visie')).sort(bySort)
  const archived = top.filter(p => p.status === 'archief').sort(bySort)

  async function togglePriority(p: Project) {
    const updated = projects.map(x => x.id === p.id ? { ...x, is_priority: !x.is_priority } : x)
    onUpdateProjects(updated)
    await supabase.from('projects').update({ is_priority: !p.is_priority }).eq('id', p.id)
  }

  // Verplaatsen via het kaartmenu doet precies wat slepen naar die sectie doet.
  // Een groep die klaar is neemt zijn sub-projecten mee — anders blijven die
  // los rondzwerven terwijl het hoofdproject in het archief staat.
  async function moveProject(p: Project, kind: SectionKind) {
    if (kind === 'archive' && projects.some(x => x.parent_id === p.id)) return archiveGroup(p)
    await patchProject(p.id, sectionPatch(kind, p))
  }

  async function moveToCategory(p: Project, catId: string) {
    await patchProject(p.id, { cat_id: catId })
  }

  async function removeProject(p: Project) {
    // Optimistisch: kaart weg, sub-projecten worden zelfstandig
    onUpdateProjects(projects
      .filter(x => x.id !== p.id)
      .map(x => x.parent_id === p.id ? { ...x, parent_id: null } : x))
    const res = await deleteProjectEverywhere(supabase, p, projects)
    if (!res.ok) onUpdateProjects(projects)   // mislukt? zet de lijst terug
  }

  async function handleDrop(targetId: string | null, section: Project[], kind: SectionKind) {
    if (justNestedRef.current) { justNestedRef.current = false; return }   // net al genest, niet ook nog herordenen
    const dragged = dragId ? projects.find(p => p.id === dragId) : null
    setDragId(null); setDragOver(null)
    if (!dragged || dragged.id === targetId) return

    const fromIdx = section.findIndex(p => p.id === dragged.id)
    if (fromIdx === -1) {
      // Sleep naar een ANDERE sectie: pas type/status/prioriteit aan
      const patch = sectionPatch(kind, dragged)
      onUpdateProjects(projects.map(p => p.id === dragged.id ? { ...p, ...patch, sort_order: section.length } : p))
      await supabase.from('projects').update({ ...patch, sort_order: section.length, updated_at: new Date().toISOString() }).eq('id', dragged.id)
      return
    }
    // Binnen dezelfde sectie: herordenen — zelfde functie als Horizon/Taken/Doelen/Week gebruiken.
    if (!targetId) return
    const withOrder = reorderList(section, dragged.id, targetId)
    if (withOrder === section) return   // geen echte verandering (bv. op zichzelf gedropt)
    const rest = projects.filter(p => !section.find(s => s.id === p.id))
    onUpdateProjects([...rest, ...withOrder])
    await Promise.all(withOrder.map(p => supabase.from('projects').update({ sort_order: p.sort_order }).eq('id', p.id)))
  }

  function SectionGrid({ items, label, color = 'var(--muted)', badge, kind }: {
    items: Project[]; label: string; color?: string; badge?: string; kind: SectionKind
  }) {
    // Tijdens slepen blijven ook lege secties zichtbaar als dropzone
    if (!items.length && !dragId && !dragSubId) return null
    const isDropTarget = (dragId !== null && !items.some(p => p.id === dragId)) || dragSubId !== null
    return (
      <div style={{ marginBottom:28, borderRadius:10, outline: isDropTarget && dragOver === `sec-${kind}` ? `2px dashed ${color}` : 'none', outlineOffset:4 }}
        onDragOver={e => { e.preventDefault(); if (isDropTarget) setDragOver(`sec-${kind}`) }}
        onDrop={e => {
          e.preventDefault()
          if (dragSubId) {
            // Sub-project uit zijn groep gesleept naar een sectie: losmaken + sectie-transformatie
            const sub = projects.find(x => x.id === dragSubId)
            if (sub) patchProject(sub.id, { parent_id: null, ...sectionPatch(kind, sub) })
            setDragSubId(null); setDragOver(null)
            return
          }
          handleDrop(null, items, kind)
        }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.7px', textTransform:'uppercase', color, marginBottom:9, display:'flex', alignItems:'center', gap:8 }}>
          {label}
          {badge && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:8, background:`${color}18`, border:`1px solid ${color}30`, color, fontWeight:400, textTransform:'none', letterSpacing:0 }}>{badge}</span>}
          <span style={{ flex:1, height:1, background:'var(--border)', display:'block' }} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gridAutoFlow:'dense', gap:8, minHeight: items.length ? undefined : 44 }}>
          {items.map(p => (
            <ProjectCard key={p.id} p={p} tasks={tasks} onSelect={onSelect}
              categories={categories}
              onMove={moveProject} onMoveCategory={moveToCategory} onDelete={removeProject}
              subProjects={(byParent.get(p.id) ?? []).sort(bySort)}
              expanded={expandedGroups.has(p.id)}
              onToggleExpand={() => toggleGroup(p.id)}
              onArchiveGroup={() => archiveGroup(p)}
              onTogglePriority={togglePriority}
              dragging={dragId === p.id}
              dragOver={dragOver === p.id}
              onDragStart={() => setDragId(p.id)}
              onDragEnter={() => setDragOver(p.id)}
              onDragEnd={() => handleDrop(dragOver?.startsWith('sec-') ? null : (dragOver ?? p.id), items, kind)}
              onSubDragStart={id => setDragSubId(id)}
              onSubDragEnd={() => { setDragSubId(null); setDragOver(null) }}
              nestDropActive={
                (dragSubId !== null && dragSubId !== p.id && !projects.find(x => x.id === dragSubId && x.parent_id === p.id))
                // Een los (top-level) project op een andere kaart: maakt er een groep van.
                // Alleen als het gesleepte project zelf nog geen subs heeft — twee niveaus is genoeg.
                || (dragId !== null && dragId !== p.id && !projects.some(x => x.parent_id === dragId))
              }
              onNestDrop={() => {
                if (dragSubId) {
                  // Sub-project op een andere kaart gedropt: verhuis naar die groep
                  patchProject(dragSubId, { parent_id: p.id })
                  setDragSubId(null); setDragOver(null)
                } else if (dragId) {
                  // Los project midden op een andere kaart gedropt: wordt er een sub van
                  justNestedRef.current = true
                  patchProject(dragId, { parent_id: p.id, sort_order: 999 })
                  setDragId(null); setDragOver(null)
                }
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:6, overflow:'hidden' }}>
          <button onClick={() => kiesWeergave('secties')}
            style={{ padding:'5px 12px', fontSize:11, fontWeight:600, background: weergave==='secties' ? 'rgba(99,102,241,.2)' : 'none', border:'none', color: weergave==='secties' ? '#818cf8' : 'var(--dim)', cursor:'pointer' }}>
            🗂 Secties
          </button>
          <button onClick={() => kiesWeergave('horizon')}
            style={{ padding:'5px 12px', fontSize:11, fontWeight:600, background: weergave==='horizon' ? 'rgba(99,102,241,.2)' : 'none', border:'none', color: weergave==='horizon' ? '#818cf8' : 'var(--dim)', cursor:'pointer' }}>
            🔭 Horizon
          </button>
        </div>
        <button onClick={onCreate}
          style={{ background:'rgba(99,102,241,.15)', border:'1px solid rgba(99,102,241,.35)', borderRadius:7, padding:'6px 14px', color:'#818cf8', cursor:'pointer', fontSize:12, fontWeight:600, transition:'all .15s' }}
          onMouseEnter={e => (e.currentTarget.style.background='rgba(99,102,241,.25)')}
          onMouseLeave={e => (e.currentTarget.style.background='rgba(99,102,241,.15)')}>
          + Nieuw project
        </button>
      </div>
      <div style={{ fontSize:11, color:'var(--dim)', marginBottom:20 }}>
        {weergave === 'secties'
          ? `${projects.length} projecten · klik ★ voor prioriteit · sleep om te sorteren óf naar een andere sectie`
          : `${projects.length} projecten · sleep een kaart naar een andere horizon`}
      </div>
      {weergave === 'secties' ? (
        <>
          <SectionGrid items={priority} label="⭐ Prioriteiten" color="#fbbf24" badge={`${priority.length}/7`} kind="priority" />
          <SectionGrid items={active}   label="🗂 Overige projecten" color="#818cf8" kind="active" />
          <SectionGrid items={routines} label="🔄 Routines" color="#34d399" kind="routines" />
          <SectionGrid items={sleeping} label="💤 Slapend / visie" kind="sleeping" />
          <SectionGrid items={archived} label="✅ Gedaan / archief" color="#6e7681" kind="archive" />
        </>
      ) : (
        <ProjectsHorizonView
          projects={projects}
          tasks={tasks}
          categories={categories}
          onSelect={onSelect}
          onMoveHorizon={moveProjectHorizon}
          onReorder={reorderProjectsInHorizon}
          onToggleDone={p => patchProject(p.id, sectionPatch('archive', p))}
          onDelete={removeProject}
        />
      )}
    </div>
  )
}

// ─── CreateProjectModal ───────────────────────────────────────────────────────

export function CreateProjectModal({ categories, projects = [], userId, onClose, onCreated }: {
  categories: { id: string; name: string }[]
  projects?: Project[]
  userId: string
  onClose: () => void
  onCreated: (p: Project) => void
}) {
  const supabase = createClient()
  const [name,       setName]       = useState('')
  const [emoji,      setEmoji]      = useState('🗂')
  const [catId,      setCatId]      = useState(categories[0]?.id ?? '')
  const [parentId,   setParentId]   = useState('')
  const [type,       setType]       = useState<'project'|'routine'>('project')
  const [status,     setStatus]     = useState<ProjectStatus>('actief')
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState<string|null>(null)
  const [aiPaste,    setAiPaste]    = useState(false)
  const [pasteText,  setPasteText]  = useState('')
  const [aiLoading,  setAiLoading]  = useState(false)
  // Prefilled by AI — passed to onCreated after insert
  const aiFields = useRef<{ vision: string; description: string; notes: string }>({ vision:'', description:'', notes:'' })

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function runAiParse() {
    if (!pasteText.trim()) return
    setAiLoading(true); setErr(null)
    const res = await fetch('/api/projects/parse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: pasteText }),
    })
    const json = await res.json()
    if (!res.ok) { setErr(json.error ?? 'AI-fout'); setAiLoading(false); return }
    if (json.name)        setName(json.name)
    if (json.emoji)       setEmoji(json.emoji)
    if (json.vision)      aiFields.current.vision      = json.vision
    if (json.description) aiFields.current.description = json.description
    if (json.notes)       aiFields.current.notes       = json.notes
    setAiPaste(false); setPasteText(''); setAiLoading(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('Naam is verplicht'); return }
    setSaving(true); setErr(null)
    const { data, error } = await supabase.from('projects').insert({
      // projects.id heeft geen standaardwaarde in de database — zelf een slug meegeven.
      id: projectSlug(name.trim(), projects.map(p => p.id)),
      user_id: userId, name: name.trim(), emoji, cat_id: catId,
      proj_type: type, status,
      parent_id:   parentId || null,
      vision:      aiFields.current.vision,
      description: aiFields.current.description,
      notes:       aiFields.current.notes || null,
      html_content: null, is_priority: false, sort_order: 999,
    }).select().single()
    if (error || !data) { setErr(error?.message ?? 'Fout bij aanmaken'); setSaving(false); return }
    onCreated(data as Project)
  }

  const STATUS_OPTIONS: ProjectStatus[] = ['actief','lopend','urgent','soon','visie','slapend','onzeker','love']
  const inputStyle: React.CSSProperties = { width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)', borderRadius:7, color:'#e2e8f0', fontSize:13, padding:'8px 11px', outline:'none', boxSizing:'border-box' }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9300, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', padding:16 }}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit}
        style={{ background:'#0c1323', border:'1px solid rgba(99,102,241,.25)', borderRadius:14, width:'100%', maxWidth:480, padding:'24px 28px', boxShadow:'0 20px 60px rgba(0,0,0,.8)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>✨ Nieuw project aanmaken</div>
          <button type="button" onClick={() => setAiPaste(s => !s)}
            style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:`1px solid ${aiPaste?'rgba(99,102,241,.5)':'rgba(255,255,255,.12)'}`, background: aiPaste?'rgba(99,102,241,.15)':'none', color: aiPaste?'#818cf8':'#64748b', cursor:'pointer', fontWeight:600 }}>
            🤖 AI-import
          </button>
        </div>

        {/* AI paste panel */}
        {aiPaste && (
          <div style={{ marginBottom:16, padding:12, background:'rgba(99,102,241,.06)', border:'1px solid rgba(99,102,241,.2)', borderRadius:8 }}>
            <div style={{ fontSize:11, color:'#818cf8', marginBottom:7, fontWeight:600 }}>Plak je projecttekst — AI vult de velden in</div>
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
              placeholder="Plak hier een RPM-document, notities, e-mail, of gewoon een vrije beschrijving van het project..."
              rows={6}
              style={{ ...inputStyle, resize:'vertical', lineHeight:1.5, fontSize:12 }} />
            <div style={{ display:'flex', gap:8, marginTop:8, justifyContent:'flex-end' }}>
              <button type="button" onClick={() => { setAiPaste(false); setPasteText('') }}
                style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,.1)', background:'none', color:'#64748b', cursor:'pointer' }}>
                Annuleer
              </button>
              <button type="button" onClick={runAiParse} disabled={!pasteText.trim() || aiLoading}
                style={{ fontSize:11, padding:'5px 14px', borderRadius:6, border:'none', background: pasteText.trim()&&!aiLoading?'#4f46e5':'#2d2f4a', color:'#fff', cursor: pasteText.trim()&&!aiLoading?'pointer':'default', fontWeight:600 }}>
                {aiLoading ? '⏳ Analyseren...' : '✨ Analyseer'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4}
            aria-label="Emoji"
            style={{ ...inputStyle, width:56, textAlign:'center', fontSize:22, padding:'6px 4px' }} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Projectnaam..."
            autoFocus={!aiPaste}
            aria-label="Projectnaam"
            style={{ ...inputStyle, flex:1 }} />
        </div>

        {(aiFields.current.vision || aiFields.current.description) && (
          <div style={{ marginBottom:14, padding:'8px 11px', background:'rgba(52,211,153,.06)', border:'1px solid rgba(52,211,153,.18)', borderRadius:7, fontSize:11, color:'#34d399' }}>
            ✓ AI heeft {[aiFields.current.vision&&'resultaat', aiFields.current.description&&'doel', aiFields.current.notes&&'notities'].filter(Boolean).join(', ')} ingevuld
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:10, fontWeight:700, letterSpacing:'0.7px', textTransform:'uppercase', color:'#64748b', display:'block', marginBottom:5 }}>Categorie</label>
          <select value={catId} onChange={e => setCatId(e.target.value)} aria-label="Categorie" style={{ ...inputStyle, cursor:'pointer' }}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:10, fontWeight:700, letterSpacing:'0.7px', textTransform:'uppercase', color:'#64748b', display:'block', marginBottom:5 }}>Hoofdproject (optioneel)</label>
          <select value={parentId} aria-label="Hoofdproject"
            onChange={e => {
              setParentId(e.target.value)
              const parent = projects.find(p => p.id === e.target.value)
              if (parent) setCatId(parent.cat_id)   // sub-project erft de categorie
            }}
            style={{ ...inputStyle, cursor:'pointer' }}>
            <option value="">— los project —</option>
            {projects.filter(p => !p.parent_id && p.status !== 'archief').map(p => (
              <option key={p.id} value={p.id}>↳ onder {p.emoji} {p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:10, fontWeight:700, letterSpacing:'0.7px', textTransform:'uppercase', color:'#64748b', display:'block', marginBottom:7 }}>Type</label>
          <div style={{ display:'flex', gap:8 }}>
            {(['project','routine'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                style={{ flex:1, padding:'7px 0', borderRadius:7, border:`1px solid ${type===t?'rgba(99,102,241,.5)':'rgba(255,255,255,.1)'}`, background: type===t?'rgba(99,102,241,.15)':'none', color: type===t?'#818cf8':'#64748b', cursor:'pointer', fontSize:12, fontWeight: type===t?600:400 }}>
                {t === 'project' ? '🗂 Project' : '🔄 Routine'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:10, fontWeight:700, letterSpacing:'0.7px', textTransform:'uppercase', color:'#64748b', display:'block', marginBottom:5 }}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as ProjectStatus)} aria-label="Status" style={{ ...inputStyle, cursor:'pointer' }}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {err && <div role="alert" style={{ fontSize:11, color:'#f87171', marginBottom:12 }}>{err}</div>}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button type="button" onClick={onClose}
            style={{ padding:'8px 16px', borderRadius:7, border:'1px solid rgba(255,255,255,.1)', background:'none', color:'#64748b', cursor:'pointer', fontSize:12 }}>
            Annuleren
          </button>
          <button type="submit" disabled={saving}
            style={{ padding:'8px 20px', borderRadius:7, border:'none', background: saving?'#4338ca':'#4f46e5', color:'#fff', cursor: saving?'wait':'pointer', fontSize:12, fontWeight:600 }}>
            {saving ? 'Aanmaken...' : 'Aanmaken'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Links uit notities ───────────────────────────────────────────────────────

// Elke regel met een URL wordt een klikbare chip; de tekst vóór de URL is het label.
export function extractNoteLinks(text: string): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/(https?:\/\/\S+)/)
    if (!m || m.index === undefined) continue
    const url = m[1]
    let label = line.slice(0, m.index).replace(/[•→\-:\s]+$/g, '').replace(/^[•\s]+/, '').trim()
    if (!label) { try { label = new URL(url).hostname.replace('www.', '') } catch { label = url } }
    out.push({ label, url })
  }
  return out
}

// ─── ProjectModal ─────────────────────────────────────────────────────────────

export function ProjectModal({ project, tasks, allProjects = [], onUpdateTask, onUpdated, onDeleted, onOpenProject, onSubCreated, onClose }: {
  project: Project; tasks: Task[]; allProjects?: Project[]; onUpdateTask:(id:number,s:TaskStatus)=>void
  onUpdated?: (patch: Partial<Project> & { id: string }) => void
  onDeleted?: (id: string) => void
  onOpenProject?: (p: Project) => void
  onSubCreated?: (p: Project) => void
  onClose:()=>void
}) {
  const supabase  = createClient()
  const open      = tasks.filter(t => t.status !== 'done')
  const done      = tasks.filter(t => t.status === 'done')
  const [speaking,    setSpeaking]    = useState(false)
  const [vision,      setVision]      = useState(project.vision ?? '')
  const [desc,        setDesc]        = useState(project.description ?? '')
  const [notes,       setNotes]       = useState(project.notes ?? '')
  const [htmlContent, setHtmlContent] = useState(project.html_content ?? '')
  const [aiPaste,     setAiPaste]     = useState(false)
  const [pasteText,   setPasteText]   = useState('')
  const [aiLoading,   setAiLoading]   = useState(false)
  const [editName,    setEditName]    = useState(false)
  const [nameDraft,   setNameDraft]   = useState(project.name)
  const [emojiDraft,  setEmojiDraft]  = useState<string | null>(null)   // null = niet aan het bewerken
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  // AI-voorstellen: niets wordt opgeslagen zonder expliciete klik per veld
  const [aiPreview,   setAiPreview]   = useState<{ field: 'vision'|'description'|'notes'; label: string; value: string }[]>([])
  // AI-oordeel: de geplakte tekst gaat eigenlijk over een ander initiatief → sub-project voorstellen
  const [aiSubSuggestion, setAiSubSuggestion] = useState<{ name: string; emoji: string; vision: string; description: string; notes: string } | null>(null)
  const [creatingSub, setCreatingSub] = useState(false)
  // Aanbod om dit project uit te werken — één keer wegklikken is genoeg voor nu
  const [uitwerkAf, setUitwerkAf] = useState(false)
  const uitwerking = beoordeelUitwerking(project, tasks, allProjects)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function saveField(field: string, value: string | null) {
    const patch: Record<string, unknown> = field === 'deadline'
      ? withOriginalDeadline(project, value)
      : { [field]: field === 'parent_id' ? (value || null) : value }
    const { error } = await supabase.from('projects').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', project.id)
    if (!error) onUpdated?.({ id: project.id, ...patch } as Partial<Project> & { id: string })
  }

  // Kandidaat-hoofdprojecten: geen zichzelf, geen eigen sub-projecten (voorkomt cycli)
  const ownChildren = new Set(allProjects.filter(p => p.parent_id === project.id).map(p => p.id))
  const parentOptions = allProjects.filter(p => p.id !== project.id && !ownChildren.has(p.id) && !p.parent_id)
  const subProjects = allProjects.filter(p => p.parent_id === project.id)
  const parentProj  = project.parent_id ? allProjects.find(p => p.id === project.parent_id) : null

  async function deleteProject() {
    setDeleting(true)
    // Taken en week-items belanden in de 📥 inbox, sub-projecten gaan zelfstandig
    // verder. Zie lib/project-delete.ts — het kaartmenu gebruikt dezelfde route.
    const res = await deleteProjectEverywhere(supabase, project, allProjects)
    setDeleting(false)
    if (res.ok) { onDeleted?.(project.id); onClose() }
  }

  function schedSave(field: string, value: string, setter: (v: string) => void) {
    setter(value)
    clearTimeout(timers.current[field])
    timers.current[field] = setTimeout(() => saveField(field, value), 800)
  }

  // AI-import doet alleen VOORSTELLEN — opslaan gebeurt pas per veld, na een klik.
  // (Voorheen overschreef dit direct alle velden; zo is per ongeluk een project gewist.)
  async function runAiParse() {
    if (!pasteText.trim()) return
    setAiLoading(true)
    const res = await fetch('/api/projects/parse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: pasteText,
        currentProject: { name: project.name, description: desc || undefined },
      }),
    })
    const json = await res.json()
    setAiLoading(false)
    if (!res.ok) return
    const preview: typeof aiPreview = []
    if (json.description) preview.push({ field: 'description', label: 'Doel', value: json.description })
    if (json.vision)      preview.push({ field: 'vision',      label: 'Visie', value: json.vision })
    if (json.notes)       preview.push({ field: 'notes',       label: 'Notities', value: json.notes })
    if (json.past_bij_project === false && json.name) {
      // De tekst gaat over iets anders: stel een sub-project voor i.p.v. dit project aan te passen
      setAiSubSuggestion({ name: json.name, emoji: json.emoji || '🧩', vision: json.vision ?? '', description: json.description ?? '', notes: json.notes ?? '' })
      setAiPreview([])
    } else {
      setAiSubSuggestion(null)
      setAiPreview(preview)
    }
    setAiPaste(false); setPasteText('')
  }

  function slugify(name: string): string {
    let base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project'
    let slug = base, n = 2
    while (allProjects.some(p => p.id === slug)) slug = `${base}-${n++}`
    return slug
  }

  async function createSubFromSuggestion() {
    if (!aiSubSuggestion || creatingSub) return
    setCreatingSub(true)
    const { data, error } = await supabase.from('projects').insert({
      id: slugify(aiSubSuggestion.name),
      user_id: project.user_id,
      cat_id: project.cat_id,
      parent_id: project.id,
      name: aiSubSuggestion.name,
      emoji: aiSubSuggestion.emoji,
      status: 'actief',
      proj_type: 'project',
      description: aiSubSuggestion.description,
      vision: aiSubSuggestion.vision,
      notes: aiSubSuggestion.notes || null,
      html_content: null, is_priority: false, sort_order: 999,
    }).select('*').single()
    setCreatingSub(false)
    if (!error && data) {
      onSubCreated?.(data as Project)
      setAiSubSuggestion(null)
    }
  }

  const fieldState: Record<'vision'|'description'|'notes', [string, (v: string) => void]> = {
    vision: [vision, setVision], description: [desc, setDesc], notes: [notes, setNotes],
  }

  function applyAiField(item: { field: 'vision'|'description'|'notes'; value: string }, mode: 'replace' | 'append') {
    const [current, setter] = fieldState[item.field]
    const next = mode === 'replace' ? item.value : (current.trim() ? `${current.trimEnd()}\n\n${item.value}` : item.value)
    setter(next)
    saveField(item.field, next)
    setAiPreview(prev => prev.filter(p => p.field !== item.field))
  }

  function speakProject() {
    if (!window.speechSynthesis) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    const parts: string[] = [project.name]
    if (vision) parts.push('Visie: ' + vision)
    if (desc)   parts.push(desc)
    if (notes)  parts.push('Notities: ' + notes)
    if (open.length) parts.push('Open taken: ' + open.map(t => t.name).join('. '))
    const utt = new SpeechSynthesisUtterance(parts.join('. '))
    utt.lang = 'nl-NL'; utt.rate = 0.88
    const voices = window.speechSynthesis.getVoices()
    const nl = voices.find(v => v.lang.startsWith('nl'))
    if (nl) utt.voice = nl
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utt)
  }

  const isRoutine = project.proj_type === 'routine'

  function fieldStyle(accent: string): React.CSSProperties {
    return {
      width:'100%', background:`${accent}08`, border:`1px solid ${accent}28`,
      borderRadius:8, color:'#e2e8f0', fontSize:13, padding:'10px 14px',
      resize:'vertical', lineHeight:1.65, outline:'none',
      fontFamily:'inherit', boxSizing:'border-box', transition:'border-color .15s',
    }
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9200, background:'rgba(0,0,0,.72)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(5px)', padding:'16px' }}>
      <div onClick={e => e.stopPropagation()}
        role="dialog" aria-label={`Project: ${project.name}`}
        style={{ background:'#0c1323', border:'1px solid rgba(99,102,241,.2)', borderRadius:14, width:'100%', maxWidth:840, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 72px rgba(0,0,0,.85)' }}>

        <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', gap:12, rowGap:10, flexWrap:'wrap', flexShrink:0, background:'rgba(255,255,255,.015)' }}>
          {emojiDraft === null ? (
            <button onClick={() => setEmojiDraft(project.emoji)} title="Emoji wijzigen"
              style={{ fontSize:30, background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1 }}>
              {project.emoji}
            </button>
          ) : (
            <input autoFocus value={emojiDraft} onChange={e => setEmojiDraft(e.target.value)} aria-label="Project emoji"
              onBlur={() => { if (emojiDraft.trim() && emojiDraft.trim() !== project.emoji) saveField('emoji', emojiDraft.trim()); setEmojiDraft(null) }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEmojiDraft(null) }}
              style={{ width:52, fontSize:24, textAlign:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(99,102,241,.4)', borderRadius:8, color:'#f1f5f9', outline:'none', padding:'4px 0' }} />
          )}
          {/* flex-basis zorgt dat de knoppenrij op smalle schermen naar een eigen regel wrapt */}
          <div style={{ flex:'1 1 200px', minWidth:0 }}>
            {editName ? (
              <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)} aria-label="Projectnaam"
                onBlur={() => { if (nameDraft.trim() && nameDraft.trim() !== project.name) saveField('name', nameDraft.trim()); setEditName(false) }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setNameDraft(project.name); setEditName(false) } }}
                style={{ fontSize:18, fontWeight:700, width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,.06)', border:'1px solid rgba(99,102,241,.4)', borderRadius:7, color:'#f1f5f9', outline:'none', padding:'3px 8px', fontFamily:'inherit' }} />
            ) : (
              <div onClick={() => { setNameDraft(project.name); setEditName(true) }} title="Klik om te hernoemen"
                style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', lineHeight:1.2, cursor:'text' }}>
                {project.name}
              </div>
            )}
            <div style={{ display:'flex', gap:7, marginTop:5, alignItems:'center', flexWrap:'wrap' }}>
              <button onClick={() => saveField('proj_type', isRoutine ? 'project' : 'routine')} title="Wissel tussen project en routine"
                style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background: isRoutine ? 'rgba(52,211,153,.1)' : 'rgba(99,102,241,.1)', border:`1px solid ${isRoutine ? 'rgba(52,211,153,.25)' : 'rgba(99,102,241,.25)'}`, color: isRoutine ? '#34d399' : '#818cf8', cursor:'pointer' }}>
                {isRoutine ? '🔄 routine' : '🗂 project'}
              </button>
              <select value={project.status} onChange={e => saveField('status', e.target.value)} aria-label="Projectstatus"
                style={{ fontSize:10, padding:'2px 6px', borderRadius:10, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)', color: STATUS_COLORS[project.status] ?? '#94a3b8', cursor:'pointer', outline:'none' }}>
                {(Object.keys(STATUS_COLORS) as ProjectStatus[]).map(s => (
                  <option key={s} value={s} style={{ background:'#0c1323', color:'#e2e8f0' }}>{s}</option>
                ))}
              </select>
              <select value={project.parent_id ?? ''} onChange={e => saveField('parent_id', e.target.value)} aria-label="Hoofdproject"
                title="Koppel dit project als sub-project aan een hoofdproject"
                style={{ fontSize:10, padding:'2px 6px', borderRadius:10, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)', color: project.parent_id ? '#a5b4fc' : '#64748b', cursor:'pointer', outline:'none', maxWidth:170 }}>
                <option value="" style={{ background:'#0c1323', color:'#e2e8f0' }}>↳ los project</option>
                {parentOptions.map(p => (
                  <option key={p.id} value={p.id} style={{ background:'#0c1323', color:'#e2e8f0' }}>↳ onder {p.emoji} {p.name.split('—')[0].trim()}</option>
                ))}
              </select>
              {parentProj && onOpenProject && (
                <button onClick={() => onOpenProject(parentProj)} title={`Open hoofdproject ${parentProj.name}`}
                  style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(99,102,241,.08)', border:'1px solid rgba(99,102,241,.25)', color:'#a5b4fc', cursor:'pointer' }}>
                  ↰ {parentProj.emoji} {parentProj.name.split('—')[0].trim()}
                </button>
              )}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto' }}>
            <button onClick={() => setAiPaste(s => !s)} title="AI-import: vul velden in vanuit tekst"
              style={{ background: aiPaste?'rgba(99,102,241,.15)':'none', border:`1px solid ${aiPaste?'rgba(99,102,241,.4)':'rgba(255,255,255,.12)'}`, borderRadius:20, padding:'5px 12px', color: aiPaste?'#818cf8':'#64748b', cursor:'pointer', fontSize:12, transition:'all .15s', whiteSpace:'nowrap' }}>
              🤖 AI
            </button>
            <button onClick={speakProject} title={speaking ? 'Stop' : 'Lees hardop'}
              style={{ background: speaking ? 'rgba(99,102,241,.15)' : 'none', border:`1px solid ${speaking ? '#818cf8' : 'rgba(255,255,255,.15)'}`, borderRadius:20, padding:'5px 14px', color: speaking ? '#c7d2fe' : '#94a3b8', cursor:'pointer', fontSize:12, transition:'all .15s', whiteSpace:'nowrap' }}>
              {speaking ? '⏹ Stop' : '🔊 Lees voor'}
            </button>
            {confirmDel ? (
              <span style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.35)', borderRadius:20, padding:'4px 10px' }}>
                <span style={{ fontSize:11, color:'#f87171', whiteSpace:'nowrap' }}>
                  {tasks.length > 0 ? `${tasks.length} taken → 📥 inbox. ` : ''}Zeker?
                </span>
                <button onClick={deleteProject} disabled={deleting} aria-label="Definitief verwijderen"
                  style={{ fontSize:11, padding:'2px 10px', borderRadius:12, border:'none', background:'#b91c1c', color:'#fff', cursor:'pointer', fontWeight:700 }}>
                  {deleting ? '…' : 'Ja, weg'}
                </button>
                <button onClick={() => setConfirmDel(false)} aria-label="Verwijderen annuleren"
                  style={{ fontSize:11, padding:'2px 8px', borderRadius:12, border:'none', background:'none', color:'#94a3b8', cursor:'pointer' }}>
                  Nee
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmDel(true)} title="Project verwijderen (taken gaan naar de inbox)" aria-label="Project verwijderen"
                style={{ background:'none', border:'1px solid rgba(248,81,73,.25)', borderRadius:20, padding:'5px 12px', color:'#f87171', cursor:'pointer', fontSize:12, whiteSpace:'nowrap' }}>
                🗑
              </button>
            )}
            <button onClick={onClose} aria-label="Sluiten"
              style={{ background:'none', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#64748b', cursor:'pointer', fontSize:20, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center' }}>
              ×
            </button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px', display:'flex', flexDirection:'column', gap:28 }}>

          {/* Sub-projecten */}
          {subProjects.length > 0 && (
            <section aria-label="Sub-projecten">
              <RpmSectionHead icon="🧩" label={`SUB-PROJECTEN (${subProjects.length})`} color="#a5b4fc" />
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {subProjects.map(sub => (
                  <button key={sub.id} onClick={() => onOpenProject?.(sub)}
                    style={{ fontSize:12, padding:'6px 12px', borderRadius:8, background:'rgba(99,102,241,.08)', border:'1px solid rgba(99,102,241,.25)', color:'#c7d2fe', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                    <span>{sub.emoji} {sub.name}</span>
                    <span style={{ fontSize:9, color: STATUS_COLORS[sub.status] ?? '#94a3b8' }}>{sub.status}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* AI-oordeel: dit hoort een eigen (sub-)project te zijn */}
          {aiSubSuggestion && (
            <div style={{ padding:'14px 16px', background:'rgba(99,102,241,.07)', border:'1px solid rgba(99,102,241,.35)', borderRadius:10 }} role="region" aria-label="Sub-project voorstel">
              <div style={{ fontSize:11, color:'#818cf8', fontWeight:700, marginBottom:6 }}>
                🧩 DIT LIJKT EEN EIGEN PROJECT — niet iets om "{project.name}" mee te overschrijven
              </div>
              <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:600, marginBottom:4 }}>{aiSubSuggestion.emoji} {aiSubSuggestion.name}</div>
              {aiSubSuggestion.description && <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.5, marginBottom:10 }}>{aiSubSuggestion.description}</div>}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button onClick={createSubFromSuggestion} disabled={creatingSub}
                  style={{ fontSize:11, padding:'5px 14px', borderRadius:6, border:'none', background:'#4f46e5', color:'#fff', cursor:'pointer', fontWeight:600 }}>
                  {creatingSub ? '⏳…' : `🧩 Maak sub-project onder ${project.emoji} ${project.name.split('—')[0].trim()}`}
                </button>
                <button onClick={() => {
                    // Toch op dit project toepassen → toon de gewone per-veld voorstellen
                    const p: typeof aiPreview = []
                    if (aiSubSuggestion.description) p.push({ field:'description', label:'Doel', value: aiSubSuggestion.description })
                    if (aiSubSuggestion.vision)      p.push({ field:'vision',      label:'Visie', value: aiSubSuggestion.vision })
                    if (aiSubSuggestion.notes)       p.push({ field:'notes',       label:'Notities', value: aiSubSuggestion.notes })
                    setAiPreview(p); setAiSubSuggestion(null)
                  }}
                  style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid rgba(217,119,6,.5)', background:'rgba(217,119,6,.12)', color:'#fbbf24', cursor:'pointer' }}>
                  Toch op dit project toepassen
                </button>
                <button onClick={() => setAiSubSuggestion(null)}
                  style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,.1)', background:'none', color:'#64748b', cursor:'pointer' }}>
                  Negeer
                </button>
              </div>
            </div>
          )}

          {/* AI-voorstellen — expliciet toepassen per veld */}
          {aiPreview.length > 0 && (
            <div style={{ padding:'14px 16px', background:'rgba(52,211,153,.06)', border:'1px solid rgba(52,211,153,.3)', borderRadius:10 }} role="region" aria-label="AI-voorstellen">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontSize:11, color:'#34d399', fontWeight:700 }}>🤖 AI-VOORSTELLEN — kies per veld wat ermee gebeurt</div>
                <button onClick={() => setAiPreview([])} aria-label="Alle voorstellen verwerpen"
                  style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,.12)', background:'none', color:'#94a3b8', cursor:'pointer' }}>
                  Alles verwerpen
                </button>
              </div>
              <div style={{ fontSize:10, color:'#64748b', marginBottom:10 }}>
                Er wordt niets opgeslagen zonder jouw klik. Gaat de tekst eigenlijk over iets anders? Maak er dan een nieuw project van (+ Nieuw project in de Projecten-tab).
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {aiPreview.map(item => (
                  <div key={item.field} style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', color:'#94a3b8', marginBottom:5 }}>{item.label}</div>
                    <div style={{ fontSize:12, color:'#cbd5e1', lineHeight:1.5, maxHeight:110, overflowY:'auto', whiteSpace:'pre-wrap', marginBottom:8 }}>{item.value}</div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => applyAiField(item, 'append')}
                        style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'none', background:'#047857', color:'#fff', cursor:'pointer', fontWeight:600 }}>
                        ＋ Toevoegen
                      </button>
                      <button onClick={() => applyAiField(item, 'replace')}
                        style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid rgba(217,119,6,.5)', background:'rgba(217,119,6,.12)', color:'#fbbf24', cursor:'pointer', fontWeight:600 }}>
                        ⚠ Vervangen
                      </button>
                      <button onClick={() => setAiPreview(prev => prev.filter(p => p.field !== item.field))}
                        style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,.1)', background:'none', color:'#64748b', cursor:'pointer' }}>
                        Overslaan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI-import panel */}
          {aiPaste && (
            <div style={{ padding:'14px 16px', background:'rgba(99,102,241,.07)', border:'1px solid rgba(99,102,241,.25)', borderRadius:10 }}>
              <div style={{ fontSize:11, color:'#818cf8', marginBottom:8, fontWeight:700 }}>🤖 AI-IMPORT — plak een tekst, de AI doet een voorstel per veld</div>
              <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                placeholder="Plak hier een RPM-document, notities, een e-mail, of een vrije beschrijving van het project..."
                rows={5}
                style={{ width:'100%', background:'rgba(255,255,255,.04)', border:'1px solid rgba(99,102,241,.2)', borderRadius:7, color:'#e2e8f0', fontSize:12, padding:'8px 11px', outline:'none', resize:'vertical', lineHeight:1.5, fontFamily:'inherit', boxSizing:'border-box' }} />
              <div style={{ display:'flex', gap:8, marginTop:8, justifyContent:'flex-end' }}>
                <button onClick={() => { setAiPaste(false); setPasteText('') }}
                  style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,.1)', background:'none', color:'#64748b', cursor:'pointer' }}>
                  Annuleer
                </button>
                <button onClick={runAiParse} disabled={!pasteText.trim() || aiLoading}
                  style={{ fontSize:11, padding:'5px 14px', borderRadius:6, border:'none', background: pasteText.trim()&&!aiLoading?'#4f46e5':'#2d2f4a', color:'#fff', cursor: pasteText.trim()&&!aiLoading?'pointer':'default', fontWeight:600 }}>
                  {aiLoading ? '⏳ Analyseren...' : '✨ Vul in'}
                </button>
              </div>
            </div>
          )}

          {/* Alleen als dit project gewicht draagt én er weinig onder hangt.
              Een aanbod, geen por: niet elk project hoeft uitgewerkt te worden. */}
          {uitwerking.vraagtErom && !uitwerkAf && (
            <div style={{ padding:'12px 14px', borderRadius:9, marginBottom:4,
              background:'rgba(168,139,250,.07)', border:'1px solid rgba(168,139,250,.25)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <span style={{ fontSize:16, lineHeight:1.2 }}>🪴</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#c4b5fd', marginBottom:4 }}>
                    Dit project draagt gewicht maar staat nog dun opgeschreven
                  </div>
                  <div style={{ fontSize:11.5, color:'#94a3b8', lineHeight:1.6 }}>
                    Er ontbreekt {uitwerking.ontbreekt.join(', ')}. Zal ik je helpen het uit te werken?
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => setUitwerkAf(true)} title="Laat maar — dit project is prima zoals het is"
                    style={{ fontSize:11, padding:'5px 10px', borderRadius:6, cursor:'pointer',
                      background:'none', borderWidth:1, borderStyle:'solid', borderColor:'rgba(255,255,255,.12)', color:'#64748b' }}>
                    Prima zo
                  </button>
                  <CopyPromptButton text={uitwerkPrompt(project, uitwerking, tasks)} />
                </div>
              </div>
            </div>
          )}

          <section aria-label="Result">
            <RpmSectionHead icon="🎯" label="RESULT" color="#6366f1" />
            <textarea value={vision} rows={3} aria-label="Result"
              onChange={e => schedSave('vision', e.target.value, setVision)}
              placeholder="Wat is het gewenste resultaat? Wat ga je bereiken?"
              style={fieldStyle('#6366f1')}
              onFocus={e => (e.target.style.borderColor='rgba(99,102,241,.55)')}
              onBlur={e => (e.target.style.borderColor='rgba(99,102,241,.28)')}
            />
          </section>

          <section aria-label="Doel">
            <RpmSectionHead icon="📖" label="DOEL / PURPOSE" color="#34d399" />
            <textarea value={desc} rows={3} aria-label="Doel"
              onChange={e => schedSave('description', e.target.value, setDesc)}
              placeholder="Waarom is dit project belangrijk? Wat drijft je?"
              style={fieldStyle('#34d399')}
              onFocus={e => (e.target.style.borderColor='rgba(52,211,153,.5)')}
              onBlur={e => (e.target.style.borderColor='rgba(52,211,153,.28)')}
            />
          </section>

          <section aria-label="Tijdlijn-sectie">
            <RpmSectionHead icon="⏳" label="TIJDLIJN" color="#d29922" />
            <input type="date" value={project.deadline ?? ''} aria-label="Deadline"
              onChange={e => saveField('deadline', e.target.value || null)}
              style={{ background:'rgba(210,153,34,.06)', border:'1px solid rgba(210,153,34,.28)', borderRadius:8, color:'#e2e8f0', fontSize:13, padding:'8px 12px', outline:'none' }} />
            <div style={{ fontSize:10.5, color:'var(--dim)', marginTop:6 }}>
              Aangemaakt: {new Date(project.created_at).toLocaleDateString('nl-NL')}
              {isDeadlinePostponed(project) && (
                <> · 🔀 deadline verschoven (was {project.original_deadline})</>
              )}
            </div>
          </section>

          <section aria-label="Notities">
            <RpmSectionHead icon="📋" label="NOTITIES & ACTIEPLAN" color="#fb923c" />
            {extractNoteLinks(notes).length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                {extractNoteLinks(notes).map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}
                    style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid rgba(96,165,250,.3)', background:'rgba(96,165,250,.08)', color:'#60a5fa', textDecoration:'none', maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {l.label.toLowerCase().startsWith('map') ? '📁' : '📄'} {l.label}
                  </a>
                ))}
              </div>
            )}
            <textarea value={notes} rows={7} aria-label="Notities"
              onChange={e => schedSave('notes', e.target.value, setNotes)}
              placeholder="Stand van zaken, fasen, kernteam, referenties, actiepunten..."
              style={fieldStyle('#fb923c')}
              onFocus={e => (e.target.style.borderColor='rgba(251,146,60,.5)')}
              onBlur={e => (e.target.style.borderColor='rgba(251,146,60,.28)')}
            />
          </section>

          <section aria-label="Bijlagen">
            <RpmSectionHead icon="📎" label="BIJLAGEN" color="#f472b6" />
            <Attachments entityType="project" entityId={project.id} />
          </section>

          <section aria-label="Taken">
            <RpmSectionHead icon="✅" label={`TAKEN  ·  ${open.length} open · ${done.length} klaar`} color="#3fb950" />
            {tasks.length === 0 ? (
              <div style={{ fontSize:12, color:'#64748b', fontStyle:'italic', padding:'10px 0' }}>Geen taken voor dit project.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {open.map(t => (
                  <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'rgba(255,255,255,.03)', borderRadius:8, border:`1px solid ${t.urgent ? 'rgba(248,81,73,.3)' : 'rgba(255,255,255,.07)'}` }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: t.urgent ? '#f85149' : TASK_STATUS_COLORS[t.status] }} />
                    <span style={{ flex:1, fontSize:13, color:'#cbd5e1', lineHeight:1.4 }}>{t.name}</span>
                    {t.urgent && <span style={{ fontSize:9, color:'#f87171', fontWeight:700, letterSpacing:'0.4px' }}>URGENT</span>}
                    <select value={t.status} onChange={e => onUpdateTask(t.id, e.target.value as TaskStatus)}
                      aria-label={`Status van ${t.name}`}
                      style={{ fontSize:11, background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'#94a3b8', cursor:'pointer', borderRadius:6, padding:'4px 8px' }}>
                      <option value="backlog">Backlog</option>
                      <option value="doing">Bezig</option>
                      <option value="waiting">Wacht</option>
                      <option value="done">Klaar ✓</option>
                    </select>
                  </div>
                ))}
                {done.length > 0 && <>
                  <div style={{ fontSize:9, color:'#475569', marginTop:10, marginBottom:3, paddingLeft:2, textTransform:'uppercase', letterSpacing:'0.6px', fontWeight:600 }}>Afgerond</div>
                  {done.map(t => (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,.04)', opacity:.5 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:'#3fb950' }} />
                      <span style={{ flex:1, fontSize:12, color:'#64748b', textDecoration:'line-through', lineHeight:1.4 }}>{t.name}</span>
                    </div>
                  ))}
                </>}
              </div>
            )}
          </section>

          <section aria-label="Visualisaties">
            <RpmSectionHead icon="📊" label="VISUALISATIES & EXTRA" color="#06b6d4" />
            <textarea value={htmlContent} rows={5} aria-label="HTML content"
              onChange={e => schedSave('html_content', e.target.value, setHtmlContent)}
              placeholder="Plak hier HTML — grafieken, afbeeldingen, tabellen... De AI kan dit voor je genereren."
              style={fieldStyle('#06b6d4')}
              onFocus={e => (e.target.style.borderColor='rgba(6,182,212,.55)')}
              onBlur={e => (e.target.style.borderColor='rgba(6,182,212,.28)')}
            />
            {htmlContent.trim() && (
              <div
                dangerouslySetInnerHTML={{ __html: htmlContent }}
                style={{ marginTop:12, padding:'14px 16px', background:'rgba(6,182,212,.04)', border:'1px solid rgba(6,182,212,.15)', borderRadius:8, overflowX:'auto' }}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

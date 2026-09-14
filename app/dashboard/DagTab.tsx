'use client'
import { useState, useMemo } from 'react'
import type { Task, WeekItem, Project, RecurringTask } from '@/lib/types'
import { computeStreak } from '@/lib/streaks'
import { parseQuickAdd, describeParsed } from '@/lib/parse-quick-add'
import { plannedTaskDates } from '@/lib/planned-tasks'

const DAY_NL   = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
const MONTH_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']

// 7:00–22:30, 30-min slots
const TIME_SLOTS = Array.from({ length: 32 }, (_, i) => {
  const h = Math.floor(i / 2) + 7
  const m = (i % 2) * 30
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`
})

// ─── DagTab ───────────────────────────────────────────────────────────────────

export function DagTab({ today, weekItems, tasks, projects, recurringTasks, onToggle, onDelete, onAddItem, onSetTime, onTaskClick }: {
  today:          string
  weekItems:      WeekItem[]
  tasks:          Task[]
  projects:       Project[]
  recurringTasks: RecurringTask[]
  onToggle:       (id: number) => void
  /** Item van de dag verwijderen — werkt door in week, maand en inzicht. Bij
   *  een herhalende taak slaat dit alleen vandaag over (het patroon blijft
   *  lopen); onDelete zelf weet dat al (zie DashboardClient.deleteWeekItem). */
  onDelete?:      (id: number) => void
  onAddItem:      (date: string, text: string, type: WeekItem['type'], projId: string | null, timeBlock?: string) => void
  onSetTime:      (id: number, timeBlock: string | null) => void
  onTaskClick:    (t: Task) => void
}) {
  const [quickText,    setQuickText]    = useState('')
  const [quickProjId,  setQuickProjId]  = useState<string>('')
  const [adding,       setAdding]       = useState(false)
  const [showTimeGrid, setShowTimeGrid] = useState(false)
  const [slotInput,    setSlotInput]    = useState<string | null>(null)   // which slot has inline form open
  const [slotText,     setSlotText]     = useState('')

  const todayDate = new Date(today + 'T12:00:00')
  const dayLabel  = DAY_NL[todayDate.getDay()]
  const dateLabel = `${todayDate.getDate()} ${MONTH_NL[todayDate.getMonth()]} ${todayDate.getFullYear()}`

  const todayItems = weekItems.filter(w => w.date === today)
  const calItems   = todayItems.filter(w => w.type === 'cal').sort((a,b) => (a.time_block ?? '').localeCompare(b.time_block ?? '') || a.text.localeCompare(b.text))
  // Herhalende taken zijn hier gewoon taskItems (met recur_id gezet) — ze
  // worden vooruit gematerialiseerd (lib/recurring.ts), dus tegen de tijd dat
  // je Dag opent bestaat de rij al.
  const taskItems  = todayItems.filter(w => w.type === 'task')

  // Backlog: open taken die niet vandaag al vastgepind staan, en ook niet op een
  // andere dag in de week — ingepland is verplaatst, niet gekopieerd.
  const pinnedNames = new Set(taskItems.map(w => w.text.toLowerCase()))
  const ingepland   = plannedTaskDates(weekItems, today)
  const backlog = tasks.filter(t => t.status !== 'done' && !pinnedNames.has(t.name.toLowerCase()) && !ingepland.has(t.id)).sort((a, b) => b.priority - a.priority)

  const doneCount  = taskItems.filter(w => w.done).length
  const totalCount = taskItems.length
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0

  const streakMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const rt of recurringTasks) {
      map.set(rt.id, computeStreak(rt, today, weekItems))
    }
    return map
  }, [recurringTasks, today, weekItems])

  // Time-grid: items with time_block
  const timedItems = [...taskItems, ...calItems].filter(w => w.time_block)

  const parsedQuick = parseQuickAdd(quickText, today)
  const quickHint   = quickText.trim() ? describeParsed(parsedQuick, today) : null

  async function addQuick(e: React.FormEvent) {
    e.preventDefault()
    if (!quickText.trim()) return
    setAdding(true)
    await onAddItem(parsedQuick.date ?? today, parsedQuick.text, 'task', quickProjId || null, parsedQuick.timeBlock ?? undefined)
    setQuickText(''); setAdding(false)
  }

  async function addAtSlot(slot: string) {
    if (!slotText.trim()) { setSlotInput(null); return }
    await onAddItem(today, slotText.trim(), 'task', null, slot)
    setSlotText(''); setSlotInput(null)
  }

  async function pinTask(t: Task) {
    await onAddItem(today, t.name, 'task', t.proj_id)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
          {dayLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{dateLabel}</div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('jarvis-prompt', { detail: { text: 'Plan mijn dag' } }))}
              title="Laat Horizon AI je open taken over lege tijdblokken verdelen"
              style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(167,139,250,.4)', background: 'rgba(139,92,246,.1)', color: '#a78bfa', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              🪄 Plan mijn dag
            </button>
            <button
              onClick={() => setShowTimeGrid(v => !v)}
              title="Tijdblokken aan/uit"
              style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${showTimeGrid ? 'rgba(99,102,241,.5)' : 'var(--border)'}`, background: showTimeGrid ? 'rgba(99,102,241,.12)' : 'none', color: showTimeGrid ? '#818cf8' : 'var(--muted)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              {showTimeGrid ? '📅 Tijdblokken aan' : '📅 Tijdblokken'}
            </button>
          </div>
        </div>
        {totalCount > 0 && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#3fb950' : '#6366f1', borderRadius: 2, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 11, color: pct === 100 ? '#3fb950' : 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>
              {doneCount}/{totalCount} gedaan
            </span>
          </div>
        )}
      </div>

      {/* Time grid */}
      {showTimeGrid && (
        <div style={{ marginBottom: 28 }}>
          <SectionLabel icon="📅" label="Tijdblokken" color="#58a6ff" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {TIME_SLOTS.map(slot => {
              const isHour  = slot.endsWith(':00')
              const slotTasks = timedItems.filter(w => w.time_block === slot)
              const isOpen  = slotInput === slot
              return (
                <div key={slot} style={{ display: 'flex', minHeight: 30, borderTop: isHour ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
                  <div style={{ width: 48, fontSize: 10, color: isHour ? 'var(--muted)' : 'var(--dim)', paddingTop: 6, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {isHour ? slot : ''}
                  </div>
                  <div style={{ flex: 1, paddingLeft: 8, paddingBottom: 2 }}>
                    {slotTasks.map(item => (
                      <TimeItem key={item.id} item={item} projects={projects} onToggle={onToggle} onSetTime={onSetTime} />
                    ))}
                    {isOpen ? (
                      <form onSubmit={e => { e.preventDefault(); addAtSlot(slot) }} style={{ display: 'flex', gap: 5, marginTop: 2 }}>
                        <input autoFocus value={slotText} onChange={e => setSlotText(e.target.value)}
                          onBlur={() => { if (!slotText.trim()) setSlotInput(null) }}
                          placeholder={`Taak om ${slot}…`}
                          style={{ flex: 1, background: 'var(--bg2)', border: '1px solid rgba(99,102,241,.4)', borderRadius: 5, color: 'var(--text)', fontSize: 11, padding: '3px 8px', outline: 'none', fontFamily: 'inherit' }} />
                        <button type="submit" style={{ fontSize: 10, padding: '3px 8px', background: '#4f46e5', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer' }}>OK</button>
                      </form>
                    ) : slotTasks.length === 0 && (
                      <button onClick={() => { setSlotInput(slot); setSlotText('') }}
                        style={{ fontSize: 10, color: 'transparent', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', width: '100%', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--dim)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'transparent'}>
                        + {slot}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Calendar events */}
      {calItems.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionLabel icon="📅" label="Agenda vandaag" color="#58a6ff" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {calItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg2)', border: '1px solid rgba(88,166,255,.2)', borderRadius: 7 }}>
                {item.time_block && <span style={{ fontSize: 10, color: '#58a6ff', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{item.time_block}</span>}
                <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's tasks */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel icon="✅" label="Vandaag plannen" color="#6366f1" />

        {taskItems.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '10px 0', marginBottom: 8 }}>
            Nog niets gepland voor vandaag — voeg hieronder taken toe.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {taskItems.map(item => (
            <DagItem key={item.id} item={item} projects={projects} onToggle={onToggle} onDelete={onDelete} onSetTime={onSetTime} showTime={showTimeGrid}
              streak={item.recur_id ? streakMap.get(item.recur_id) ?? 0 : 0} />
          ))}
        </div>

        {/* Quick add */}
        {quickHint && (
          <div style={{ fontSize: 10, color: '#818cf8', marginBottom: 4, paddingLeft: 2 }}>{quickHint}</div>
        )}
        <form onSubmit={addQuick} style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <input
            value={quickText}
            onChange={e => setQuickText(e.target.value)}
            placeholder="Voeg taak toe… (bijv. 'vr 15:00 pianoles')"
            aria-label="Taak toevoegen voor vandaag"
            style={{ flex: '1 1 200px', minWidth: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, padding: '8px 12px', outline: 'none', fontFamily: 'inherit' }}
          />
          <select value={quickProjId} onChange={e => setQuickProjId(e.target.value)} aria-label="Project koppelen"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--muted)', fontSize: 12, padding: '8px 10px', cursor: 'pointer', maxWidth: 160 }}>
            <option value="">Geen project</option>
            {projects.filter(p => p.status !== 'slapend' && p.status !== 'visie').map(p => (
              <option key={p.id} value={p.id}>{p.emoji} {p.name.split('—')[0].trim()}</option>
            ))}
          </select>
          <button type="submit" disabled={!quickText.trim() || adding}
            style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: quickText.trim() ? '#4f46e5' : 'var(--bg3)', color: quickText.trim() ? '#fff' : 'var(--dim)', cursor: quickText.trim() ? 'pointer' : 'default', fontSize: 12, fontWeight: 600, flexShrink: 0, transition: 'background .15s' }}>
            + Toevoegen
          </button>
        </form>
      </div>

      {/* Backlog picker */}
      {backlog.length > 0 && (
        <div>
          <SectionLabel icon="📋" label="Openstaande taken — klik om te pinnen voor vandaag" color="var(--muted)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {backlog.slice(0, 15).map(t => {
              const proj = projects.find(p => p.id === t.proj_id)
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', background: 'var(--bg2)', border: `1px solid ${t.urgent ? 'rgba(248,81,73,.25)' : 'var(--border)'}`, borderRadius: 6 }}>
                  <button onClick={() => pinTask(t)} title="Plan voor vandaag"
                    style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 5, border: '1px solid rgba(99,102,241,.3)', background: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    +
                  </button>
                  <span onClick={() => onTaskClick(t)} style={{ flex: 1, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                    {t.name}
                  </span>
                  {t.urgent && <span style={{ fontSize: 9, color: '#f87171', fontWeight: 700, flexShrink: 0 }}>URGENT</span>}
                  {!!t.priority && <span style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700, flexShrink: 0 }}>🔺P{t.priority}</span>}
                  {proj && <span style={{ fontSize: 9, color: 'var(--dim)', flexShrink: 0, whiteSpace: 'nowrap' }}>{proj.emoji} {proj.name.split('—')[0].trim()}</span>}
                </div>
              )
            })}
            {backlog.length > 15 && (
              <div style={{ fontSize: 11, color: 'var(--dim)', padding: '5px 11px' }}>
                +{backlog.length - 15} meer — open Taken-tab voor volledig overzicht
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── DagItem ──────────────────────────────────────────────────────────────────

function DagItem({ item, projects, onToggle, onDelete, onSetTime, showTime, streak = 0 }: {
  item: WeekItem; projects: Project[]; onToggle: (id: number) => void
  onDelete?: (id: number) => void
  onSetTime: (id: number, t: string | null) => void; showTime: boolean
  /** Streak (dagen op rij) voor een herhalende taak — 0 = geen badge. */
  streak?: number
}) {
  const [pickingTime, setPickingTime] = useState(false)
  const proj = item.proj_id ? projects.find(p => p.id === item.proj_id) : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: item.done ? 'transparent' : 'var(--bg2)', border: `1px solid ${item.done ? 'var(--border)' : 'rgba(99,102,241,.2)'}`, borderRadius: 7, cursor: 'pointer', opacity: item.done ? 0.5 : 1 }}
      onMouseEnter={e => { if (!item.done) e.currentTarget.style.background = 'rgba(99,102,241,.06)' }}
      onMouseLeave={e => { if (!item.done) e.currentTarget.style.background = item.done ? 'transparent' : 'var(--bg2)' }}>
      <div onClick={() => onToggle(item.id)} style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', border: `2px solid ${item.done ? '#3fb950' : 'rgba(99,102,241,.4)'}`, background: item.done ? 'rgba(63,185,80,.15)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#3fb950' }}>
        {item.done ? '✓' : ''}
      </div>
      <span onClick={() => onToggle(item.id)} style={{ flex: 1, fontSize: 13, color: item.done ? 'var(--dim)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.4 }}>
        {item.text}
      </span>
      {item.recur_id && (
        <span title="Herhalende taak" style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: 'rgba(129,140,248,.1)', border: '1px solid rgba(129,140,248,.25)', color: '#818cf8', flexShrink: 0 }}>↻</span>
      )}
      {streak > 1 && (
        <span title={`${streak} dagen op rij`} style={{ fontSize: 11, color: '#fb923c', fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
          🔥{streak}
        </span>
      )}
      {showTime && (
        pickingTime ? (
          <input type="time" autoFocus defaultValue={item.time_block ?? ''}
            onBlur={e => { onSetTime(item.id, e.target.value || null); setPickingTime(false) }}
            onKeyDown={e => { if (e.key === 'Escape') setPickingTime(false) }}
            style={{ fontSize: 10, background: 'var(--bg3)', border: '1px solid rgba(99,102,241,.4)', borderRadius: 4, color: 'var(--text)', padding: '2px 5px', outline: 'none', width: 80 }} />
        ) : (
          <button onClick={() => setPickingTime(true)} title={item.time_block ? `${item.time_block} — klik om te wijzigen` : 'Tijdblok instellen'}
            style={{ fontSize: 10, color: item.time_block ? '#818cf8' : 'var(--dim)', background: 'none', border: '1px solid transparent', borderRadius: 4, cursor: 'pointer', padding: '2px 5px', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,.3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
            {item.time_block ?? '🕐'}
          </button>
        )
      )}
      {proj && <span style={{ fontSize: 9, color: 'var(--dim)', flexShrink: 0, whiteSpace: 'nowrap' }}>{proj.emoji} {proj.name.split('—')[0].trim()}</span>}
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(item.id) }} aria-label={`Verwijderen: ${item.text}`} title="Verwijderen"
          style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 11, padding: '2px 4px', flexShrink: 0, opacity: .55 }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#f85149' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '.55'; e.currentTarget.style.color = 'var(--dim)' }}>
          🗑
        </button>
      )}
    </div>
  )
}

// ─── TimeItem (in time-grid) ──────────────────────────────────────────────────

function TimeItem({ item, projects, onToggle, onSetTime }: {
  item: WeekItem; projects: Project[]; onToggle: (id: number) => void; onSetTime: (id: number, t: string | null) => void
}) {
  const proj = item.proj_id ? projects.find(p => p.id === item.proj_id) : null
  return (
    <div onClick={() => onToggle(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px', background: item.done ? 'rgba(63,185,80,.06)' : 'rgba(99,102,241,.08)', border: `1px solid ${item.done ? 'rgba(63,185,80,.2)' : 'rgba(99,102,241,.25)'}`, borderRadius: 6, cursor: 'pointer', marginBottom: 2, opacity: item.done ? 0.6 : 1 }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${item.done ? '#3fb950' : 'rgba(99,102,241,.5)'}`, background: item.done ? 'rgba(63,185,80,.2)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#3fb950', flexShrink: 0 }}>
        {item.done ? '✓' : ''}
      </div>
      <span style={{ flex: 1, fontSize: 11, color: item.done ? 'var(--dim)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
      {proj && <span style={{ fontSize: 8, color: 'var(--dim)' }}>{proj.emoji}</span>}
      <button onClick={e => { e.stopPropagation(); onSetTime(item.id, null) }} title="Tijdblok verwijderen"
        style={{ fontSize: 9, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--dim)'}>×</button>
    </div>
  )
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color, marginBottom: 9, display: 'flex', alignItems: 'center', gap: 7 }}>
      {icon} {label}
      <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'block' }} />
    </div>
  )
}

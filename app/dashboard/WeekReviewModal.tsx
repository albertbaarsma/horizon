'use client'
import { useState, useMemo } from 'react'
import type { WeekItem, Achievement, Task, Goal } from '@/lib/types'

const DAY_NL_SHORT = ['Zo','Ma','Di','Wo','Do','Vr','Za']
const MONTH_NL     = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function getWeekDates(anchor: string): { date: string; label: string; dow: number }[] {
  const d    = new Date(anchor + 'T12:00:00')
  const dow  = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow   // back to monday
  const mon  = new Date(d)
  mon.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(mon)
    day.setDate(mon.getDate() + i)
    const date = day.toISOString().slice(0, 10)
    return { date, label: DAY_NL_SHORT[day.getDay()], dow: day.getDay() }
  })
}

function fmt(date: string) {
  const d = new Date(date + 'T12:00:00')
  return `${d.getDate()} ${MONTH_NL[d.getMonth()]}`
}

// ─── WeekReviewModal ──────────────────────────────────────────────────────────

export function WeekReviewModal({ today, weekItems, achievements, tasks, goals, onClose }: {
  today:        string
  weekItems:    WeekItem[]
  achievements: Achievement[]
  tasks:        Task[]
  goals:        Goal[]
  onClose:      () => void
}) {
  const [note, setNote] = useState('')

  const days = useMemo(() => getWeekDates(today), [today])
  const weekStart = days[0].date
  const weekEnd   = days[6].date

  // Items for this week
  const weekDone   = weekItems.filter(w => w.date >= weekStart && w.date <= weekEnd && w.done && w.type === 'task')
  const weekOpen   = weekItems.filter(w => w.date >= weekStart && w.date <= weekEnd && !w.done && w.type === 'task')
  const weekAch    = achievements.filter(a => a.date >= weekStart && a.date <= weekEnd)
  const doneTasks  = tasks.filter(t => t.status === 'done')
  const weekGoals  = goals.filter(g => g.done)

  const totalMinutes = weekDone.reduce((acc, w) => {
    const t = tasks.find(tk => tk.name === w.text)
    return acc + (t?.duration_min ?? 0)
  }, 0)

  const actualMinutes = weekDone.reduce((acc, w) => {
    const t = tasks.find(tk => tk.name === w.text)
    return acc + (t?.actual_min ?? 0)
  }, 0)

  function fmtDur(min: number) {
    return min >= 60 ? `${Math.floor(min/60)}u${min%60 ? ` ${min%60}m` : ''}` : `${min}m`
  }

  const pct = weekDone.length + weekOpen.length > 0
    ? Math.round(weekDone.length / (weekDone.length + weekOpen.length) * 100)
    : 0

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9200, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', backdropFilter: 'blur(4px)', paddingTop: 48, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: Math.min(680, typeof window !== 'undefined' ? window.innerWidth - 24 : 680), background: '#0d1117', border: '1px solid rgba(99,102,241,.35)', borderRadius: 16, boxShadow: '0 32px 80px rgba(0,0,0,.8)', overflow: 'hidden', marginBottom: 40 }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', background: 'rgba(99,102,241,.08)', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#6366f1' }}>Weekreview</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
              {fmt(weekStart)} – {fmt(weekEnd)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 15, padding: '5px 9px', borderRadius: 7 }}>✕</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }} role="region" aria-label="Weekstatistieken">
            <StatCard value={weekDone.length}    label="Taken klaar"   color="#3fb950" />
            <StatCard value={weekOpen.length}    label="Openstaand"    color="#f85149" />
            <StatCard value={weekAch.length}     label="Achievements"  color="#fbbf24" />
            <StatCard value={`${pct}%`}          label="Voltooiing"    color="#6366f1" />
          </div>

          {/* Progress bar */}
          {(weekDone.length + weekOpen.length) > 0 && (
            <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#3fb950' : '#6366f1', borderRadius: 3, transition: 'width .4s' }} />
            </div>
          )}

          {/* Per-day breakdown */}
          <div>
            <SLabel>Dag voor dag</SLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {days.map(({ date, label }) => {
                const dayDone = weekItems.filter(w => w.date === date && w.done && w.type === 'task')
                const dayOpen = weekItems.filter(w => w.date === date && !w.done && w.type === 'task')
                const dayAch  = achievements.filter(a => a.date === date)
                const isToday = date === today
                const isFuture = date > today
                return (
                  <div key={date} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', opacity: isFuture ? 0.35 : 1 }}>
                    <div style={{ width: 40, flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: 10, fontWeight: isToday ? 700 : 400, color: isToday ? '#818cf8' : '#4b5563' }}>{label}</div>
                      <div style={{ fontSize: 9, color: '#374151' }}>{fmt(date)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      {dayDone.length === 0 && dayOpen.length === 0 && dayAch.length === 0 && (
                        <span style={{ fontSize: 11, color: '#374151', fontStyle: 'italic' }}>Niets gepland</span>
                      )}
                      {dayDone.map(w => (
                        <div key={w.id} style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 9 }}>✓</span> {w.text}
                        </div>
                      ))}
                      {dayOpen.map(w => (
                        <div key={w.id} style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 9 }}>○</span> {w.text}
                        </div>
                      ))}
                      {dayAch.map(a => (
                        <div key={a.id} style={{ fontSize: 11, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span>{a.emoji}</span> {a.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Achievements this week */}
          {weekAch.length > 0 && (
            <div>
              <SLabel>Achievements deze week</SLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {weekAch.map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 9, padding: '7px 11px', background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.18)', borderRadius: 7 }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{a.emoji}</span>
                    <span style={{ fontSize: 12, color: '#e2e8f0' }}>{a.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done tasks */}
          {weekDone.length > 0 && (
            <div>
              <SLabel>Voltooide taken</SLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {weekDone.map(w => (
                  <span key={w.id} style={{ fontSize: 11, color: '#4ade80', background: 'rgba(74,222,128,.07)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 5, padding: '3px 8px' }}>✓ {w.text}</span>
                ))}
              </div>
            </div>
          )}

          {/* Open tasks */}
          {weekOpen.length > 0 && (
            <div>
              <SLabel>Niet afgerond</SLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {weekOpen.map(w => (
                  <span key={w.id} style={{ fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,.07)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 5, padding: '3px 8px' }}>○ {w.text}</span>
                ))}
              </div>
            </div>
          )}

          {/* Duration summary */}
          {(totalMinutes > 0 || actualMinutes > 0) && (
            <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)', borderRadius: 8, fontSize: 12, color: '#818cf8' }}>
              {totalMinutes > 0 && <>⏱ Geschatte tijd besteed: <strong>{fmtDur(totalMinutes)}</strong></>}
              {actualMinutes > 0 && (
                <span style={{ marginLeft: totalMinutes > 0 ? 12 : 0, color: totalMinutes > 0 && actualMinutes > totalMinutes ? '#fb923c' : '#3fb950' }}>
                  ▶ Werkelijk gewerkt: <strong>{fmtDur(actualMinutes)}</strong>
                  {totalMinutes > 0 && actualMinutes > totalMinutes && ' — meer dan geschat'}
                </span>
              )}
            </div>
          )}

          {/* Quick note */}
          <div>
            <SLabel>Notitie voor deze week</SLabel>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Wat nam je mee uit deze week? Wat kon beter?"
              aria-label="Weeknotitie"
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', background: '#0a1020', border: '1px solid rgba(99,102,241,.3)', color: '#e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

        </div>
      </div>
    </div>
  )
}

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div style={{ background: `${color}0f`, border: `1px solid ${color}28`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }} role="article" aria-label={label}>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#4b5563', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function SLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#4b5563', marginBottom: 8 }}>{children}</div>
}

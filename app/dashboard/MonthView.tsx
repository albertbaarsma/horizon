'use client'
import { useState } from 'react'
import type { WeekItem, Project } from '@/lib/types'

const MONTHS_FULL = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const DAY_HEADERS = ['Ma','Di','Wo','Do','Vr','Za','Zo']

const WEEK_TYPE: Record<string,{bg:string;color:string;border:string;icon:string}> = {
  cal:   {bg:'#132030',color:'#7dd3fc',border:'#1e4a7f',icon:'📅'},
  sport: {bg:'#0d2018',color:'#4ade80',border:'#1a4731',icon:'💪'},
  kids:  {bg:'#221500',color:'#fbbf24',border:'#4d3000',icon:'👧'},
  urgent:{bg:'#200d0d',color:'#f87171',border:'#4d1a1a',icon:'🔴'},
  task:  {bg:'#1c2128',color:'#94a3b8',border:'#30363d',icon:'○'},
}

function getWeekNumber(d: Date): number {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

export default function MonthView({ items, onToggle, onCtx, onAddItem, onOpenRecurModal, onSwitchToWeek, projects }: {
  items: WeekItem[]
  onToggle: (id: number) => void
  onCtx: (e: React.MouseEvent, item: WeekItem) => void
  onAddItem: (date: string, text: string, type: WeekItem['type'], projId: string | null) => void
  onOpenRecurModal: () => void
  onSwitchToWeek: (date?: string) => void
  projects: Project[]
}) {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [addingDate,   setAddingDate]   = useState<string | null>(null)
  const [addText,  setAddText]  = useState('')
  const [addType,  setAddType]  = useState<WeekItem['type']>('task')
  const [addProj,  setAddProj]  = useState('')

  const today = now.toISOString().slice(0, 10)

  function prevMonth() { if (month === 0) { setYear(y => y-1); setMonth(11) } else setMonth(m => m-1) }
  function nextMonth() { if (month === 11) { setYear(y => y+1); setMonth(0) } else setMonth(m => m+1) }
  function goToday()   { setYear(now.getFullYear()); setMonth(now.getMonth()) }

  // Build 6-week grid, Monday-first
  const firstDay  = new Date(year, month, 1)
  const startDow  = (firstDay.getDay() + 6) % 7
  const startDate = new Date(year, month, 1 - startDow)
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDate); d.setDate(startDate.getDate() + i); return d
  })
  const rows: Date[][] = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7))

  // Herhalende taken zijn hier gewoon een week_item (met recur_id gezet) —
  // ze worden vooruit gematerialiseerd (lib/recurring.ts), dus `real` bevat ze al.
  function getForDate(dateStr: string) {
    return { real: items.filter(w => w.date === dateStr) }
  }

  function submitAdd(dateStr: string) {
    if (!addText.trim()) return
    onAddItem(dateStr, addText.trim(), addType, addProj || null)
    setAddText(''); setAddType('task'); setAddProj(''); setAddingDate(null)
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:6, overflow:'hidden', marginRight:4 }}>
          <button onClick={() => onSwitchToWeek()}
            style={{ padding:'5px 12px', fontSize:11, background:'none', border:'none', color:'var(--dim)', cursor:'pointer' }}>
            📋 Week
          </button>
          <button style={{ padding:'5px 12px', fontSize:11, background:'rgba(99,102,241,.2)', border:'none', color:'#818cf8', fontWeight:600, cursor:'default' }}>
            🗓 Maand
          </button>
        </div>

        <button onClick={prevMonth} style={navBtnStyle}>‹</button>
        <select value={month} onChange={e => setMonth(+e.target.value)}
          style={{ fontSize:13, fontWeight:700, color:'var(--text)', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:5, padding:'4px 8px', cursor:'pointer' }}>
          {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)}
          style={{ fontSize:13, fontWeight:700, color:'var(--text)', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:5, padding:'4px 8px', cursor:'pointer', width:80 }}>
          {Array.from({ length: 8 }, (_, i) => 2024 + i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={nextMonth} style={navBtnStyle}>›</button>
        <button onClick={goToday}
          style={{ fontSize:11, padding:'5px 10px', background:'none', border:'1px solid var(--border)', color:'var(--dim)', borderRadius:5, cursor:'pointer' }}>
          Vandaag
        </button>

        <div style={{ marginLeft:'auto' }}>
          <button onClick={onOpenRecurModal}
            style={{ fontSize:11, padding:'5px 12px', background:'rgba(129,140,248,.1)', border:'1px solid rgba(129,140,248,.25)', color:'#818cf8', borderRadius:6, cursor:'pointer' }}>
            ↻ Herhaaltaken beheren
          </button>
        </div>
      </div>

      {/* Column headers — blank + 7 day labels */}
      <div style={{ display:'grid', gridTemplateColumns:'30px repeat(7, minmax(0, 1fr))', gap:2, marginBottom:3 }}>
        <div />
        {DAY_HEADERS.map((d, i) => (
          <div key={d} style={{
            textAlign:'center', fontSize:10, fontWeight:700, letterSpacing:'0.5px',
            textTransform:'uppercase',
            color: i >= 5 ? '#475569' : 'var(--dim)',
            padding:'4px 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Calendar rows — one row per week, with week number on the left */}
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {rows.map((week, rowIdx) => {
          const weekNum = getWeekNumber(week[0])
          return (
            <div key={rowIdx} style={{ display:'grid', gridTemplateColumns:'30px repeat(7, minmax(0, 1fr))', gap:2 }}>
              {/* Week number */}
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:7 }}>
                <span style={{ fontSize:9, color:'#2d3748', fontWeight:700, userSelect:'none' }}>{weekNum}</span>
              </div>

              {/* 7 day cells */}
              {week.map((d, colIdx) => {
                const dateStr   = d.toISOString().slice(0, 10)
                const inMonth   = d.getMonth() === month
                const isToday   = dateStr === today
                const isSel     = dateStr === selectedDate
                const isWeekend = colIdx >= 5
                const { real } = getForDate(dateStr)
                const openCount = real.filter(w => !w.done).length
                const doneCount = real.filter(w => w.done).length
                const total     = real.length
                const allItems  = real.map(w => ({ key:`r${w.id}`, type:w.type, text:w.text, done:w.done, virtual: !!w.recur_id,
                  onClick:(e:React.MouseEvent) => { e.stopPropagation(); onCtx(e, w) } }))

                return (
                  <div key={colIdx}
                    onClick={() => inMonth && setSelectedDate(isSel ? null : dateStr)}
                    style={{
                      minHeight: 110,
                      padding: '4px 4px 3px',
                      background: isToday
                        ? 'rgba(99,102,241,.08)'
                        : isSel
                        ? 'rgba(99,102,241,.05)'
                        : isWeekend && inMonth
                        ? 'rgba(255,255,255,.012)'
                        : inMonth
                        ? 'rgba(255,255,255,.022)'
                        : 'transparent',
                      border: `1px solid ${isToday ? 'rgba(99,102,241,.45)' : isSel ? 'rgba(99,102,241,.28)' : inMonth ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)'}`,
                      borderRadius: 7,
                      opacity: inMonth ? 1 : 0.22,
                      cursor: inMonth ? 'pointer' : 'default',
                      transition: 'background .1s',
                      position: 'relative',
                    }}>

                    {/* Day number — Google Calendar circle for today */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: isToday ? '#6366f1' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        fontSize: 11,
                        fontWeight: isToday ? 800 : inMonth ? 500 : 400,
                        color: isToday ? '#fff' : isWeekend ? '#64748b' : inMonth ? 'var(--muted)' : '#2d3748',
                      }}>
                        {d.getDate()}
                      </div>
                      {total > 0 && inMonth && (
                        <span style={{ fontSize:9, color: openCount > 0 ? '#64748b' : '#3fb950', marginRight:2 }}>
                          {doneCount > 0 && openCount === 0 ? '✓' : `${openCount}`}
                        </span>
                      )}
                    </div>

                    {/* Event pills — max 4 visible */}
                    {allItems.slice(0, 4).map(item => (
                      <div key={item.key}
                        onClick={item.onClick}
                        title={item.text}
                        style={{
                          fontSize: 10, padding: '2px 5px', borderRadius: 3, marginBottom: 2,
                          background: WEEK_TYPE[item.type]?.bg ?? '#1c2128',
                          color: WEEK_TYPE[item.type]?.color ?? '#94a3b8',
                          border: item.virtual ? `1px dashed ${WEEK_TYPE[item.type]?.border ?? '#30363d'}` : 'none',
                          textDecoration: item.done ? 'line-through' : 'none',
                          opacity: item.done ? 0.45 : 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          cursor: 'pointer', lineHeight: 1.4,
                        }}>
                        {WEEK_TYPE[item.type]?.icon} {item.text}
                      </div>
                    ))}
                    {total > 4 && (
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedDate(dateStr) }}
                        style={{ fontSize:9, color:'#818cf8', background:'none', border:'none', cursor:'pointer', padding:'1px 3px', display:'block' }}>
                        +{total - 4} meer
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Selected day detail panel */}
      {selectedDate && (() => {
        const { real } = getForDate(selectedDate)
        const d = new Date(selectedDate + 'T12:00:00')
        return (
          <div style={{ marginTop:12, padding:'14px 16px', background:'rgba(255,255,255,.03)', border:'1px solid rgba(99,102,241,.2)', borderRadius:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <span style={{ fontSize:14, fontWeight:700, color:'#e2e8f0' }}>
                {DAY_HEADERS[(d.getDay()+6)%7]} {d.getDate()} {MONTHS_FULL[d.getMonth()]} {d.getFullYear()}
              </span>
              <button onClick={() => onSwitchToWeek(selectedDate)}
                style={{ fontSize:10, padding:'3px 8px', background:'none', border:'1px solid rgba(99,102,241,.3)', color:'#818cf8', borderRadius:4, cursor:'pointer' }}>
                Ga naar weekview →
              </button>
              <button onClick={() => setSelectedDate(null)}
                style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:16 }}>✕</button>
            </div>

            {real.length === 0 && (
              <div style={{ fontSize:12, color:'var(--dim)', marginBottom:8 }}>Geen items gepland</div>
            )}

            {real.map(w => ({ id:`r${w.id}`, type:w.type, text:w.text, done:w.done, virtual: !!w.recur_id,
              onCheck:(e:React.MouseEvent) => { e.stopPropagation(); onToggle(w.id) },
              onCtxFn:(e:React.MouseEvent) => onCtx(e, w) })
            ).map(item => (
              <div key={item.id} onContextMenu={item.onCtxFn}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', background:'rgba(255,255,255,.02)', borderRadius:6, marginBottom:4 }}>
                <button onClick={item.onCheck}
                  style={{ flexShrink:0, width:18, height:18, borderRadius:'50%', background: item.done ? 'rgba(74,222,128,.2)' : 'none', border:`2px solid ${item.done ? '#4ade80' : WEEK_TYPE[item.type]?.color ?? '#94a3b8'}`, color: item.done ? '#4ade80' : WEEK_TYPE[item.type]?.color, fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {item.done ? '✓' : ''}
                </button>
                <span style={{ fontSize:12, flex:1, color: item.done ? '#374151' : '#94a3b8', textDecoration: item.done ? 'line-through' : 'none' }}>
                  {item.text}
                </span>
                {item.virtual && <span style={{ fontSize:9, color:'#4b5563' }}>↻</span>}
              </div>
            ))}

            {/* Inline add form */}
            {addingDate === selectedDate ? (
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
                <input autoFocus value={addText} onChange={e => setAddText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitAdd(selectedDate); if (e.key === 'Escape') setAddingDate(null) }}
                  placeholder="Nieuwe taak…"
                  style={{ background:'#0a1020', border:'1px solid rgba(99,102,241,.3)', color:'#e2e8f0', borderRadius:5, padding:'6px 9px', fontSize:12, outline:'none', fontFamily:'inherit' }} />
                <div style={{ display:'flex', gap:6 }}>
                  <select value={addType} onChange={e => setAddType(e.target.value as WeekItem['type'])}
                    style={{ fontSize:11, background:'var(--bg3,#161b22)', border:'1px solid #30363d', color:'#8b949e', borderRadius:4, padding:'3px 6px' }}>
                    <option value="task">○ Taak</option>
                    <option value="cal">📅 Afspraak</option>
                    <option value="sport">💪 Sport</option>
                    <option value="kids">👧 Kinderen</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                  <select value={addProj} onChange={e => setAddProj(e.target.value)}
                    style={{ flex:1, fontSize:11, background:'var(--bg3,#161b22)', border:'1px solid #30363d', color:'#8b949e', borderRadius:4, padding:'3px 6px' }}>
                    <option value="">— geen project —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name.split('—')[0].trim()}</option>)}
                  </select>
                  <button onClick={() => submitAdd(selectedDate)}
                    style={{ padding:'3px 12px', background:'rgba(99,102,241,.25)', border:'1px solid #6366f1', color:'#a5b4fc', borderRadius:5, fontSize:11, cursor:'pointer' }}>＋</button>
                  <button onClick={() => setAddingDate(null)}
                    style={{ padding:'3px 8px', background:'none', border:'1px solid #30363d', color:'#8b949e', borderRadius:5, fontSize:11, cursor:'pointer' }}>✕</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingDate(selectedDate)}
                style={{ marginTop:6, width:'100%', padding:'5px', fontSize:11, color:'var(--dim)', background:'none', border:'1px dashed rgba(255,255,255,.07)', borderRadius:5, cursor:'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(99,102,241,.4)'; e.currentTarget.style.color='#818cf8' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.07)'; e.currentTarget.style.color='var(--dim)' }}>
                + toevoegen
              </button>
            )}
          </div>
        )
      })()}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, padding: '2px 10px', background: 'none',
  border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 5, cursor: 'pointer', lineHeight: 1.4,
}

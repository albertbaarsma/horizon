'use client'
import { useState, useEffect } from 'react'
import type { RecurringTask, Category } from '@/lib/types'
import {
  DAY_KEYS, DAY_LABELS_NL, weekLoad, minutesFor, routinesOnDay,
  formatMinutes, formatHours, DEFAULT_WAKING_HOURS,
} from '@/lib/routine-hours'
import { WEEK_TYPE } from './WeekTab'

const WAKING_KEY = 'routines-waking-hours'

/**
 * Routines vanuit een andere hoek: een ma→zo raster van je wekelijkse ritme,
 * met hoeveel tijd het kost en hoeveel er overblijft. Toggle taken aan/uit om
 * te zien wat dat met je week doet.
 */
export function RoutinesPanel({ tasks, categories, onToggle, onSetDuration, onClose }: {
  tasks: RecurringTask[]
  categories: Pick<Category, 'id' | 'name'>[]
  onToggle: (id: number) => void
  onSetDuration?: (id: number, minutes: number | null) => void
  onClose: () => void
}) {
  const [waking, setWaking] = useState(DEFAULT_WAKING_HOURS)
  const [editing, setEditing] = useState<number | null>(null)

  useEffect(() => {
    const saved = Number(localStorage.getItem(WAKING_KEY))
    if (saved > 0 && saved <= 24) setWaking(saved)
  }, [])

  function changeWaking(h: number) {
    const clamped = Math.min(24, Math.max(1, h))
    setWaking(clamped)
    localStorage.setItem(WAKING_KEY, String(clamped))
  }

  const active   = tasks.filter(t => t.active)
  const inactive = tasks.filter(t => !t.active)
  const load     = weekLoad(tasks, waking)
  const maxDay   = Math.max(...load.perDay, 1)

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:9300, background:'rgba(0,0,0,.6)', backdropFilter:'blur(3px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 16px', overflowY:'auto' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Routine-overzicht"
        style={{ background:'#0c1323', border:'1px solid rgba(99,102,241,.25)', borderRadius:14, width:'100%', maxWidth:760, boxShadow:'0 24px 72px rgba(0,0,0,.8)', overflow:'hidden' }}>

        {/* Kop */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>↻ Mijn week-ritme</div>
            <div style={{ fontSize:11, color:'var(--dim)', marginTop:2 }}>
              wat komt er elke week terug — en wat kost dat aan tijd?
            </div>
          </div>
          <button onClick={onClose} aria-label="Sluiten"
            style={{ background:'none', border:'none', color:'#64748b', fontSize:20, cursor:'pointer', padding:'0 4px', lineHeight:1 }}>×</button>
        </div>

        {/* Urenoverzicht */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,.07)', background:'rgba(99,102,241,.04)' }}>
          <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'flex-end' }}>
            <Stat label="Routines per week" value={`${load.occurrences}×`} sub={`${active.length} routines`} />
            <Stat label="Tijd kwijt" value={formatHours(load.totalMin)} sub={formatMinutes(load.totalMin)} color="#a78bfa" />
            <Stat
              label="Vrij over"
              value={formatHours(load.freeMin)}
              sub={load.freeMin < 0 ? 'overboekt!' : `van ${Math.round(load.budgetMin / 60)}u wakker`}
              color={load.freeMin < 0 ? '#f87171' : '#4ade80'} />
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
              <label htmlFor="waking" style={{ fontSize:10, color:'var(--dim)' }}>wakkere uren/dag</label>
              <input id="waking" type="number" min={1} max={24} value={waking}
                onChange={e => changeWaking(Number(e.target.value))}
                style={{ width:52, fontSize:12, textAlign:'center', background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:6, padding:'4px 6px' }} />
            </div>
          </div>

          {/* Verhouding routines vs vrije tijd */}
          <div style={{ marginTop:12 }}>
            <div style={{ height:8, borderRadius:4, background:'rgba(255,255,255,.06)', overflow:'hidden', display:'flex' }}>
              <div style={{ width:`${load.pctBusy}%`, background:'linear-gradient(90deg,#818cf8,#a78bfa)', transition:'width .2s' }} />
            </div>
            <div style={{ fontSize:10, color:'var(--dim)', marginTop:5 }}>
              {load.pctBusy}% van je wakkere tijd gaat naar vaste routines
              {load.busiestDay.min > 0 && ` · drukste dag: ${DAY_LABELS_NL[load.busiestDay.index]} (${formatMinutes(load.busiestDay.min)})`}
            </div>
          </div>
        </div>

        {/* Ma→zo raster */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
          {/* minmax(0,1fr): zonder de 0-min krimpen kolommen niet onder hun inhoud
              en vallen za/zo buiten het paneel */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0, 1fr))', gap:6 }}>
            {DAY_KEYS.map((day, i) => {
              const dayTasks = routinesOnDay(tasks, day)
              const min = load.perDay[i]
              return (
                <div key={day} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 6px', minHeight:96, display:'flex', flexDirection:'column', gap:4 }}>
                  <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--muted)' }}>{DAY_LABELS_NL[i]}</span>
                    {min > 0 && <span style={{ fontSize:9, color:'#a78bfa' }}>{formatMinutes(min)}</span>}
                  </div>
                  {/* mini-staaf: hoe zwaar is deze dag t.o.v. de drukste */}
                  <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,.06)', overflow:'hidden' }}>
                    <div style={{ width:`${Math.round((min / maxDay) * 100)}%`, height:'100%', background:'#818cf8' }} />
                  </div>
                  {dayTasks.length === 0
                    ? <span style={{ fontSize:9, color:'var(--dim)', fontStyle:'italic', marginTop:2 }}>vrij</span>
                    : dayTasks.map(rt => {
                        const s = WEEK_TYPE[rt.type] ?? WEEK_TYPE.task
                        return (
                          <div key={rt.id} title={`${rt.name} — ${formatMinutes(minutesFor(rt))}`}
                            style={{ fontSize:9, lineHeight:1.3, color:s.color, background:s.bg, border:`1px solid ${s.border}`, borderRadius:4, padding:'2px 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {rt.name}
                          </div>
                        )
                      })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Toggle-lijst */}
        <div style={{ padding:'14px 20px', maxHeight:300, overflowY:'auto' }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 }}>
            Aan / uit ({active.length} aan{inactive.length > 0 ? `, ${inactive.length} uit` : ''})
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {[...active, ...inactive].map(rt => {
              const s = WEEK_TYPE[rt.type] ?? WEEK_TYPE.task
              const cat = rt.cat_id ? categories.find(c => c.id === rt.cat_id) : null
              const perWeek = minutesFor(rt) * rt.days.length
              return (
                <div key={rt.id}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 10px', borderRadius:7, background: rt.active ? 'var(--bg2)' : 'transparent', border:`1px solid ${rt.active ? 'var(--border)' : 'rgba(255,255,255,.05)'}`, opacity: rt.active ? 1 : 0.5 }}>
                  {/* aan/uit-schakelaar */}
                  <button onClick={() => onToggle(rt.id)}
                    title={rt.active ? 'Zet uit — verdwijnt uit je weekplanning' : 'Zet aan'}
                    aria-label={`${rt.name} ${rt.active ? 'uitzetten' : 'aanzetten'}`}
                    style={{ width:32, height:18, borderRadius:9, flexShrink:0, cursor:'pointer', position:'relative', background: rt.active ? 'rgba(99,102,241,.5)' : 'var(--bg4)', border:`1px solid ${rt.active ? '#6366f1' : 'var(--border)'}`, transition:'all .15s' }}>
                    <span style={{ position:'absolute', top:1, left: rt.active ? 15 : 1, width:14, height:14, borderRadius:'50%', background: rt.active ? '#c7d2fe' : '#64748b', transition:'left .15s' }} />
                  </button>
                  <span style={{ fontSize:13, flexShrink:0 }}>{s.icon}</span>
                  <span style={{ flex:1, fontSize:12, color: rt.active ? 'var(--text)' : 'var(--dim)', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {rt.name}
                  </span>
                  {cat && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(129,140,248,.08)', border:'1px solid rgba(129,140,248,.2)', color:'#818cf8', flexShrink:0 }}>{cat.name}</span>}
                  {/* welke dagen */}
                  <span style={{ display:'flex', gap:2, flexShrink:0 }}>
                    {DAY_KEYS.map((day, i) => (
                      <span key={day} title={day}
                        style={{ fontSize:8, width:13, textAlign:'center', borderRadius:3, padding:'1px 0', background: rt.days.includes(day) ? 'rgba(99,102,241,.25)' : 'transparent', color: rt.days.includes(day) ? '#a5b4fc' : 'var(--dim)' }}>
                        {DAY_LABELS_NL[i]}
                      </span>
                    ))}
                  </span>
                  {/* duur, klikbaar om aan te passen */}
                  {editing === rt.id && onSetDuration ? (
                    <input autoFocus type="number" min={0} max={600} step={5} defaultValue={minutesFor(rt)}
                      onBlur={e => { onSetDuration(rt.id, Number(e.target.value) || null); setEditing(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null) }}
                      style={{ width:52, fontSize:11, textAlign:'center', background:'var(--bg)', border:'1px solid rgba(99,102,241,.5)', color:'var(--text)', borderRadius:5, padding:'3px 4px', flexShrink:0 }} />
                  ) : (
                    <button onClick={() => onSetDuration && setEditing(rt.id)}
                      title={onSetDuration ? 'Klik om de duur per keer aan te passen' : undefined}
                      style={{ fontSize:10, minWidth:72, textAlign:'right', background:'none', border:'none', color: rt.duration_min ? '#a78bfa' : 'var(--dim)', cursor: onSetDuration ? 'pointer' : 'default', flexShrink:0, padding:0 }}>
                      {formatMinutes(minutesFor(rt))}{rt.duration_min ? '' : '*'} · {formatHours(perWeek)}/wk
                    </button>
                  )}
                </div>
              )
            })}
            {tasks.length === 0 && (
              <div style={{ fontSize:12, color:'var(--dim)', textAlign:'center', padding:'20px 0' }}>
                Nog geen herhaaltaken. Maak ze aan via “↻ Herhaaltaken beheren”.
              </div>
            )}
          </div>
          <div style={{ fontSize:9, color:'var(--dim)', marginTop:10 }}>
            * geen duur ingevuld — gerekend met 30m. Klik op de tijd om aan te passen.
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--dim)' }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, color: color ?? 'var(--text)', lineHeight:1.2 }}>{value}</div>
      {sub && <div style={{ fontSize:9, color:'var(--dim)' }}>{sub}</div>}
    </div>
  )
}

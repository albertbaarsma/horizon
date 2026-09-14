'use client'
import { useState } from 'react'
import type { WeekItem, Achievement } from '@/lib/types'

// ─── ShutdownModal — avondritueel: dag reviewen + open taken bewust verwerken ──

const DAY_NL   = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
const MONTH_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function ShutdownModal({ today, weekItems, achievements, onToggle, onMove, onDelete, onAddWin, onClose }: {
  today:        string
  weekItems:    WeekItem[]
  achievements: Achievement[]
  onToggle:     (id: number) => void
  onMove:       (id: number, date: string) => void
  onDelete:     (id: number) => void
  onAddWin:     (text: string) => void | Promise<void>
  onClose:      () => void
}) {
  const [winText,   setWinText]   = useState('')
  const [winSaved,  setWinSaved]  = useState(false)
  const [pickerFor, setPickerFor] = useState<number | null>(null)   // item-id met open datumkiezer
  const [showOlder, setShowOlder] = useState(false)

  const tomorrow = addDays(today, 1)
  const d = new Date(today + 'T12:00:00')
  const dateLabel = `${DAY_NL[d.getDay()]} ${d.getDate()} ${MONTH_NL[d.getMonth()]}`

  const todayItems = weekItems.filter(w => w.date === today && w.type !== 'cal')
  const doneItems  = todayItems.filter(w => w.done)
  const openItems  = todayItems.filter(w => !w.done)
  const olderOpen  = weekItems.filter(w => w.date < today && !w.done && w.type !== 'cal')
    .sort((a, b) => a.date.localeCompare(b.date))
  const winsToday  = achievements.filter(a => a.date === today)

  async function saveWin() {
    if (!winText.trim()) return
    await onAddWin(winText.trim())
    setWinText('')
    setWinSaved(true)
    setTimeout(() => setWinSaved(false), 2500)
  }

  const allProcessed = openItems.length === 0

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)', padding:12 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Dag afsluiten" style={{
        width:'min(560px, 100%)', maxHeight:'86vh', background:'#0d1117',
        border:'1px solid rgba(139,92,246,.35)', borderRadius:16,
        boxShadow:'0 32px 80px rgba(0,0,0,.8)',
        display:'flex', flexDirection:'column', overflow:'hidden',
        animation:'bubbleIn .2s ease',
      }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', background:'rgba(139,92,246,.08)', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>🌙 Dag afsluiten</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{dateLabel}</div>
          </div>
          <button onClick={onClose} aria-label="Sluiten" style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', color:'#94a3b8', cursor:'pointer', fontSize:15, padding:'5px 9px', borderRadius:7 }}>✕</button>
        </div>

        {/* Stats */}
        <div role="region" aria-label="Dagstatistieken" style={{ display:'flex', gap:20, padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
          {[
            { label: 'Klaar',       value: doneItems.length, color: '#3fb950' },
            { label: 'Nog open',    value: openItems.length, color: openItems.length ? '#f59e0b' : '#3fb950' },
            { label: 'Wins vandaag', value: winsToday.length, color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} role="article" style={{ textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:9, color:'var(--dim)', marginTop:3, letterSpacing:'.4px', textTransform:'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'14px 20px', display:'flex', flexDirection:'column', gap:16 }}>

          {/* Done */}
          {doneItems.length > 0 && (
            <div>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:'#3fb950', marginBottom:6 }}>✓ Gedaan vandaag</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {doneItems.map(w => (
                  <span key={w.id} style={{ fontSize:11, color:'#86efac', background:'rgba(63,185,80,.08)', border:'1px solid rgba(63,185,80,.2)', borderRadius:6, padding:'3px 9px' }}>
                    ✓ {w.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Open items → verwerken */}
          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color: allProcessed ? '#3fb950' : '#f59e0b', marginBottom:6 }}>
              {allProcessed ? '🎉 Alles verwerkt' : `⭕ Nog open — kies wat ermee gebeurt (${openItems.length})`}
            </div>
            {allProcessed && doneItems.length === 0 && (
              <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>Niets gepland vandaag.</div>
            )}
            {allProcessed && doneItems.length > 0 && (
              <div style={{ fontSize:12, color:'#86efac' }}>Alle taken van vandaag zijn verwerkt. Lekker bezig! 💪</div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {openItems.map(w => (
                <OpenItemRow key={w.id} item={w} tomorrow={tomorrow}
                  pickerOpen={pickerFor === w.id}
                  onOpenPicker={() => setPickerFor(pickerFor === w.id ? null : w.id)}
                  onToggle={() => onToggle(w.id)}
                  onMove={date => { onMove(w.id, date); setPickerFor(null) }}
                  onDelete={() => onDelete(w.id)} />
              ))}
            </div>
          </div>

          {/* Older open items */}
          {olderOpen.length > 0 && (
            <div>
              <button onClick={() => setShowOlder(v => !v)}
                style={{ fontSize:11, color:'#f87171', background:'none', border:'none', cursor:'pointer', padding:0, fontWeight:600 }}>
                {showOlder ? '▾' : '▸'} {olderOpen.length} oudere open items {showOlder ? '' : '— klik om te verwerken'}
              </button>
              {showOlder && (
                <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:8 }}>
                  {olderOpen.slice(0, 15).map(w => (
                    <OpenItemRow key={w.id} item={w} tomorrow={tomorrow} showDate
                      pickerOpen={pickerFor === w.id}
                      onOpenPicker={() => setPickerFor(pickerFor === w.id ? null : w.id)}
                      onToggle={() => onToggle(w.id)}
                      onMove={date => { onMove(w.id, date); setPickerFor(null) }}
                      onDelete={() => onDelete(w.id)} />
                  ))}
                  {olderOpen.length > 15 && (
                    <div style={{ fontSize:10, color:'var(--dim)' }}>…nog {olderOpen.length - 15} — verwerk deze eerst, dan komen de volgende</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Win van vandaag */}
          <div style={{ padding:'12px 14px', background:'rgba(251,191,36,.05)', border:'1px solid rgba(251,191,36,.18)', borderRadius:10 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:'#fbbf24', marginBottom:8 }}>🏆 Wat was je win vandaag?</div>
            {winsToday.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                {winsToday.map(a => (
                  <span key={a.id} style={{ fontSize:11, color:'#fde68a', background:'rgba(251,191,36,.08)', borderRadius:6, padding:'3px 9px' }}>{a.emoji} {a.text}</span>
                ))}
              </div>
            )}
            <form onSubmit={e => { e.preventDefault(); saveWin() }} style={{ display:'flex', gap:7 }}>
              <input value={winText} onChange={e => setWinText(e.target.value)}
                placeholder={winSaved ? 'Opgeslagen! 🎉' : 'Iets waar je trots op bent…'}
                aria-label="Win van vandaag"
                style={{ flex:1, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:7, color:'var(--text)', fontSize:12, padding:'7px 11px', outline:'none', fontFamily:'inherit' }} />
              <button type="submit" disabled={!winText.trim()}
                style={{ padding:'7px 14px', borderRadius:7, border:'none', background: winText.trim() ? '#b45309' : 'var(--bg3)', color: winText.trim() ? '#fff' : 'var(--dim)', cursor: winText.trim() ? 'pointer' : 'default', fontSize:11, fontWeight:600 }}>
                Bewaar
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 20px', borderTop:'1px solid rgba(255,255,255,.06)', display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClose}
            style={{ padding:'8px 20px', borderRadius:8, border:'none', background: allProcessed ? '#7c3aed' : 'rgba(255,255,255,.07)', color: allProcessed ? '#fff' : '#94a3b8', cursor:'pointer', fontSize:12, fontWeight:700 }}>
            {allProcessed ? '🌙 Klaar voor vandaag' : 'Later afmaken'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── OpenItemRow ──────────────────────────────────────────────────────────────

function OpenItemRow({ item, tomorrow, showDate, pickerOpen, onOpenPicker, onToggle, onMove, onDelete }: {
  item: WeekItem; tomorrow: string; showDate?: boolean; pickerOpen: boolean
  onOpenPicker: () => void
  onToggle: () => void
  onMove: (date: string) => void
  onDelete: () => void
}) {
  const postponed = item.postponed_count ?? 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'var(--bg2)', border:'1px solid rgba(245,158,11,.2)', borderRadius:7, flexWrap:'wrap' }}>
      <button onClick={onToggle} title="Toch gedaan — afvinken" aria-label={`${item.text} afvinken`}
        style={{ flexShrink:0, width:18, height:18, borderRadius:'50%', border:'2px solid rgba(63,185,80,.4)', background:'none', cursor:'pointer', color:'#3fb950', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', padding:0 }} />
      <span style={{ flex:1, fontSize:12, color:'var(--text)', minWidth:120 }}>
        {item.text}
        {showDate && <span style={{ fontSize:9, color:'#f87171', marginLeft:6 }}>{item.date.slice(5)}</span>}
        {postponed >= 2 && (
          <span title={`Al ${postponed}× doorgeschoven`} style={{ fontSize:9, color:'#fb923c', marginLeft:6, fontWeight:700 }}>↷{postponed}</span>
        )}
      </span>
      <div style={{ display:'flex', gap:4, flexShrink:0 }}>
        <button onClick={() => onMove(tomorrow)} aria-label={`${item.text} naar morgen`}
          style={{ fontSize:10, padding:'3px 9px', borderRadius:5, border:'1px solid rgba(99,102,241,.35)', background:'rgba(99,102,241,.1)', color:'#818cf8', cursor:'pointer', fontWeight:600 }}>
          → Morgen
        </button>
        <button onClick={onOpenPicker} aria-label={`${item.text} naar andere dag`}
          style={{ fontSize:10, padding:'3px 8px', borderRadius:5, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.04)', color:'#94a3b8', cursor:'pointer' }}>
          📅
        </button>
        <button onClick={onDelete} aria-label={`${item.text} verwijderen`}
          style={{ fontSize:10, padding:'3px 8px', borderRadius:5, border:'1px solid rgba(248,81,73,.25)', background:'rgba(248,81,73,.06)', color:'#f87171', cursor:'pointer' }}>
          🗑
        </button>
      </div>
      {pickerOpen && (
        <input type="date" autoFocus min={tomorrow} defaultValue={tomorrow} aria-label={`Datum voor ${item.text}`}
          onChange={e => { if (e.target.value) onMove(e.target.value) }}
          style={{ fontSize:11, background:'var(--bg3)', border:'1px solid rgba(99,102,241,.4)', borderRadius:5, color:'var(--text)', padding:'3px 7px', outline:'none', width:'100%' }} />
      )}
    </div>
  )
}

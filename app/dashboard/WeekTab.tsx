'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import type { Project, Goal, WeekItem, RecurringTask, Task, Subtask } from '@/lib/types'
import { forecastEmoji, currentEmoji } from '@/lib/weather-utils'
import { taskWantsIdeas } from '@/lib/task-ideas'
import { toLocalISODate, todayLocal } from '@/lib/dates'
import { TASK_MIME } from '@/lib/drag-mime'
import { reorderList } from '@/lib/reorder'

const MONTHS_S = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

export const WEEK_TYPE: Record<string,{bg:string;color:string;border:string;icon:string}> = {
  cal:   {bg:'#132030',color:'#7dd3fc',border:'#1e4a7f',icon:'📅'},
  sport: {bg:'#0d2018',color:'#4ade80',border:'#1a4731',icon:'💪'},
  kids:  {bg:'#221500',color:'#fbbf24',border:'#4d3000',icon:'👧'},
  urgent:{bg:'#200d0d',color:'#f87171',border:'#4d1a1a',icon:'🔴'},
  task:  {bg:'#1c2128',color:'#94a3b8',border:'#30363d',icon:'○'},
}

// ─── CtxItem ──────────────────────────────────────────────────────────────────

export function CtxItem({ label, sub, onClick }: { label:string; sub?:string; onClick:()=>void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', textAlign:'left', padding:'9px 16px', background:hov?'rgba(99,102,241,.12)':'none', border:'none', color:hov?'#c7d2fe':'#cbd5e1', fontSize:12, cursor:'pointer', transition:'all .1s' }}>
      <span>{label}</span>
      {sub && <span style={{ fontSize:10, color:'#64748b' }}>{sub}</span>}
    </button>
  )
}

// ─── WeekItemDetailPanel ──────────────────────────────────────────────────────

export interface DetailPanelState { item: WeekItem; date: string; openAi?: boolean }

const RECUR_DAY_NAMES_NL = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag']
const RECUR_DAY_NAMES_EN = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

export function WeekItemDetailPanel({
  panel, categories, projects, goals, recurringTasks, tasks,
  onClose, onToggle, onDeleteItem, onDeleteRecur, onMakeOneTime, onMakeRecurring, onLinkCat,
  onGotoVisie, onAddSuggestion, onToggleSubtask, onSetTaskNotes,
}: {
  panel: DetailPanelState
  categories: { id:string; name:string; vision?:string }[]
  projects: Project[]
  goals: Goal[]
  recurringTasks: RecurringTask[]
  tasks?: Task[]
  onClose: () => void
  onToggle: (id: number) => void
  onDeleteItem: (id: number) => void
  onDeleteRecur: (recurId: number) => void
  onMakeOneTime: (item: WeekItem) => void
  /** Van deze (nog niet-herhalende) taak een herhaalpatroon maken. */
  onMakeRecurring?: (item: WeekItem, days: string[]) => void
  onLinkCat: (item: WeekItem | null, rt: RecurringTask | null, catId: string) => void
  onGotoVisie: (catId: string) => void
  onAddSuggestion: (text: string, date: string, projId: string | null) => Promise<boolean>
  onToggleSubtask?: (taskId: number, subtasks: Subtask[]) => void
  /** Notities van de gekoppelde taak bewerken — dezelfde notities als in het taakvenster. */
  onSetTaskNotes?: (taskId: number, notes: string) => void
}) {
  const [linkCatId, setLinkCatId] = useState('')
  const [localCatId, setLocalCatId] = useState<string | null>(null)
  const [showRecurPicker, setShowRecurPicker] = useState(false)
  const [recurDays, setRecurDays] = useState<string[]>([])

  const { item } = panel
  const rt = item.recur_id ? recurringTasks.find(r => r.id === item.recur_id) ?? null : null

  const proj    = item.proj_id ? projects.find(p => p.id === item.proj_id) : null
  const computedCatId: string | null =
    proj?.cat_id ??
    rt?.cat_id ??
    (item.type === 'kids' ? categories.find(c => /familie|kinderen|vrienden/i.test(c.name))?.id ?? null : null) ??
    (item.type === 'sport' ? categories.find(c => /gezondheid|sport|fit|vitaliteit/i.test(c.name))?.id ?? null : null)
  const catId = localCatId ?? computedCatId

  const cat       = catId ? categories.find(c => c.id === catId) : null
  const yearGoals = catId ? goals.filter(g => g.cat_id === catId && g.horizon === 'jaar' && !g.done).slice(0, 2) : []
  const kwGoals   = catId ? goals.filter(g => g.cat_id === catId && g.horizon === 'kwartaal' && !g.done).slice(0, 2) : []

  const name   = item.text
  const type   = item.type
  const isDone = item.done
  const isRecur = !!item.recur_id

  const typeLabels: Record<string, string> = { task:'taak', cal:'agenda', sport:'sport', kids:'kids', urgent:'urgent' }

  function toggleRecurDay(d: string) {
    setRecurDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }
  function openRecurPicker() {
    const dayEn = RECUR_DAY_NAMES_EN[(new Date(panel.date + 'T12:00:00').getDay() + 6) % 7]
    setRecurDays([dayEn])
    setShowRecurPicker(true)
  }
  function submitRecur() {
    if (recurDays.length === 0 || !onMakeRecurring) return
    onMakeRecurring(item, recurDays)
    setShowRecurPicker(false)
  }

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-start', justifyContent:'flex-end' }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 360, maxWidth:'92vw', height:'100vh', background:'#0d1117',
          borderLeft:'1px solid rgba(255,255,255,.1)', overflowY:'auto', padding:'24px 20px',
          display:'flex', flexDirection:'column', gap:16,
          animation:'slideInRight .18s ease-out',
        }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:11, color:'#475569', textTransform:'uppercase', letterSpacing:'.06em' }}>
            {panel.date}
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', fontSize:18, cursor:'pointer', padding:'0 4px' }}>×</button>
        </div>

        <div>
          <div style={{ fontSize:17, fontWeight:700, color:'#f1f5f9', lineHeight:1.3, marginBottom:10 }}>{name}</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', color:'#94a3b8' }}>
              ○ {typeLabels[type] ?? type}
            </span>
            {isRecur && (
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(129,140,248,.1)', border:'1px solid rgba(129,140,248,.3)', color:'#818cf8' }}>
                ↺ herhalend
              </span>
            )}
            {proj && (
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'#64748b' }}>
                {proj.emoji} {proj.name.split('—')[0].trim()}
              </span>
            )}
          </div>
        </div>

        {cat ? (
          <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#6366f1', letterSpacing:'.07em', marginBottom:10 }}>RPM KETEN</div>
            <div style={{ fontSize:13, fontWeight:700, color:'#e2e8f0', marginBottom:6 }}>
              {categories.indexOf(cat) + 1} {cat.name}
            </div>
            {cat.vision && (
              <div style={{ fontSize:11, color:'#64748b', lineHeight:1.5, marginBottom:10, fontStyle:'italic' }}>
                {cat.vision.slice(0, 120)}{cat.vision.length > 120 ? '…' : ''}
              </div>
            )}
            {yearGoals.map(g => (
              <div key={g.id} style={{ fontSize:11, color:'#94a3b8', marginBottom:5, display:'flex', gap:6 }}>
                <span style={{ color:'#818cf8', flexShrink:0 }}>Jaar:</span>
                <span>{g.text}</span>
              </div>
            ))}
            {kwGoals.map(g => (
              <div key={g.id} style={{ fontSize:11, color:'#94a3b8', marginBottom:5, display:'flex', gap:6 }}>
                <span style={{ color:'#d29922', flexShrink:0 }}>Kwartaal:</span>
                <span>{g.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#6366f1', letterSpacing:'.07em', marginBottom:8 }}>VISIE KOPPELEN</div>
            <div style={{ fontSize:11, color:'#64748b', marginBottom:10 }}>
              Deze taak is nog niet gekoppeld aan een visie-categorie.
            </div>
            <select
              value={linkCatId}
              onChange={e => setLinkCatId(e.target.value)}
              style={{ width:'100%', padding:'6px 10px', background:'#161b22', border:'1px solid rgba(255,255,255,.1)', color:'#e2e8f0', borderRadius:6, fontSize:11, marginBottom:8 }}>
              <option value=''>— Kies categorie —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {linkCatId && (
              <button
                onClick={() => { onLinkCat(item, rt ?? null, linkCatId); setLocalCatId(linkCatId) }}
                style={{ width:'100%', padding:'6px', fontSize:11, fontWeight:600, background:'rgba(99,102,241,.2)', border:'1px solid rgba(99,102,241,.4)', color:'#818cf8', borderRadius:6, cursor:'pointer' }}>
                ＋ Koppelen
              </button>
            )}
          </div>
        )}

        {(() => {
          const linkedTask = item?.task_id
            ? tasks?.find(t => t.id === parseInt(item.task_id!))
            : null
          const subtasks = linkedTask?.subtasks
          if (!subtasks || subtasks.length === 0) return null
          return (
            <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#6366f1', letterSpacing:'.07em', marginBottom:10 }}>SUBTAKEN</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {subtasks.map((st, idx) => (
                  <label key={idx} style={{ display:'flex', alignItems:'flex-start', gap:10, cursor: onToggleSubtask ? 'pointer' : 'default' }}>
                    <input
                      type='checkbox'
                      checked={st.done}
                      onChange={() => {
                        if (!onToggleSubtask || !linkedTask) return
                        const updated = subtasks.map((s, i) => i === idx ? { ...s, done: !s.done } : s)
                        onToggleSubtask(linkedTask.id, updated)
                      }}
                      style={{ marginTop:2, accentColor:'#6366f1', width:14, height:14, flexShrink:0 }}
                    />
                    <span style={{ fontSize:12, color: st.done ? '#4d5563' : '#cbd5e1', textDecoration: st.done ? 'line-through' : 'none', lineHeight:1.4 }}>
                      {st.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )
        })()}

        {(() => {
          // Notities horen bij de taak zelf; hier zie en bewerk je dezelfde tekst als in het taakvenster.
          const linkedTask = item.task_id ? tasks?.find(t => t.id === parseInt(item.task_id!)) : null
          if (!linkedTask || !onSetTaskNotes) return null
          return (
            <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#6366f1', letterSpacing:'.07em', marginBottom:8 }}>NOTITIES</div>
              <textarea key={linkedTask.id} defaultValue={linkedTask.notes ?? ''} rows={4}
                aria-label="Notities bij deze taak" placeholder="Aantekeningen bij deze taak…"
                onBlur={e => { if (e.currentTarget.value !== (linkedTask.notes ?? '')) onSetTaskNotes(linkedTask.id, e.currentTarget.value) }}
                style={{ width:'100%', boxSizing:'border-box', background:'#161b22', border:'1px solid rgba(255,255,255,.1)', borderRadius:7, color:'#e2e8f0', fontSize:12, padding:'8px 11px', outline:'none', fontFamily:'inherit', resize:'vertical', lineHeight:1.5 }} />
            </div>
          )
        })()}

        {!isDone && type !== 'cal' && (
          <AiSuggestions
            task={name}
            project={proj ? { name: proj.name, description: proj.description ?? undefined } : undefined}
            onAdd={text => onAddSuggestion(text, panel.date, item.proj_id ?? null)}
            defaultOpen={panel.openAi}
            addedText={`staat in de planning van ${parseInt(panel.date.slice(8, 10))} ${['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][parseInt(panel.date.slice(5, 7)) - 1]}`}
          />
        )}

        {isRecur && rt ? (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#64748b', letterSpacing:'.07em', marginBottom:2 }}>HERHAALTAAK BEHEER</div>
            <button
              onClick={() => { onMakeOneTime(item); onClose() }}
              style={{ padding:'7px 12px', fontSize:11, background:'rgba(251,191,36,.07)', border:'1px solid rgba(251,191,36,.2)', color:'#fbbf24', borderRadius:6, cursor:'pointer', textAlign:'left' }}>
              ✂️ Maak éénmalig (alleen voor {panel.date})
            </button>
            <button
              onClick={() => { onDeleteItem(item.id); onClose() }}
              style={{ padding:'7px 12px', fontSize:11, background:'rgba(248,81,73,.05)', border:'1px solid rgba(248,81,73,.15)', color:'#f87171', borderRadius:6, cursor:'pointer', textAlign:'left' }}>
              🗑 Deze dag overslaan (alleen {panel.date}, herhaling blijft)
            </button>
            <button
              onClick={() => { onDeleteRecur(rt.id); onClose() }}
              style={{ padding:'7px 12px', fontSize:11, background:'rgba(248,81,73,.07)', border:'1px solid rgba(248,81,73,.2)', color:'#f85149', borderRadius:6, cursor:'pointer', textAlign:'left' }}>
              🗑 Verwijder herhaaltaak (stopt alle herhaling)
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {onMakeRecurring && (showRecurPicker ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'10px 12px', background:'rgba(129,140,248,.05)', border:'1px solid rgba(129,140,248,.2)', borderRadius:8 }}>
                <div style={{ fontSize:9, fontWeight:700, color:'#818cf8', letterSpacing:'.07em' }}>OP WELKE DAGEN?</div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {RECUR_DAY_NAMES_EN.map((d, i) => (
                    <button key={d} onClick={() => toggleRecurDay(d)}
                      style={{ padding:'4px 9px', fontSize:10, fontWeight:600, borderRadius:5, cursor:'pointer',
                        background: recurDays.includes(d) ? 'rgba(99,102,241,.25)' : 'rgba(255,255,255,.04)',
                        border: `1px solid ${recurDays.includes(d) ? '#6366f1' : 'rgba(255,255,255,.1)'}`,
                        color: recurDays.includes(d) ? '#a5b4fc' : '#64748b' }}>
                      {RECUR_DAY_NAMES_NL[i].slice(0,2)}
                    </button>
                  ))}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={submitRecur} disabled={recurDays.length === 0}
                    style={{ flex:1, padding:'6px', fontSize:11, fontWeight:600, borderRadius:6, cursor: recurDays.length ? 'pointer' : 'default',
                      background: recurDays.length ? 'rgba(99,102,241,.25)' : 'rgba(255,255,255,.04)',
                      border:`1px solid ${recurDays.length ? '#6366f1' : 'rgba(255,255,255,.1)'}`, color: recurDays.length ? '#a5b4fc' : '#64748b' }}>
                    ↻ Maak herhalend
                  </button>
                  <button onClick={() => setShowRecurPicker(false)}
                    style={{ padding:'6px 10px', fontSize:11, background:'none', border:'1px solid rgba(255,255,255,.1)', color:'#64748b', borderRadius:6, cursor:'pointer' }}>
                    Annuleren
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={openRecurPicker}
                style={{ padding:'7px 12px', fontSize:11, background:'rgba(129,140,248,.07)', border:'1px solid rgba(129,140,248,.2)', color:'#818cf8', borderRadius:6, cursor:'pointer', textAlign:'left' }}>
                ↻ Van herhaling maken
              </button>
            ))}
            <button
              onClick={() => { onDeleteItem(item.id); onClose() }}
              style={{ padding:'7px 12px', fontSize:11, background:'rgba(248,81,73,.07)', border:'1px solid rgba(248,81,73,.15)', color:'#f85149', borderRadius:6, cursor:'pointer', textAlign:'left' }}>
              🗑 Verwijder dit item
            </button>
          </div>
        )}

        <div style={{ flex:1 }} />

        <button
          onClick={() => { onToggle(item.id); onClose() }}
          style={{ padding:'10px', fontSize:13, fontWeight:600, background: isDone ? 'rgba(255,255,255,.05)' : 'rgba(63,185,80,.15)', border:`1px solid ${isDone?'rgba(255,255,255,.1)':'rgba(63,185,80,.3)'}`, color:isDone?'#64748b':'#3fb950', borderRadius:8, cursor:'pointer' }}>
          {isDone ? '↩ Zet open' : '✓ Markeer als klaar'}
        </button>

        {cat && (
          <button
            onClick={() => { onGotoVisie(cat!.id); onClose() }}
            style={{ padding:'10px', fontSize:12, fontWeight:600, background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.25)', color:'#818cf8', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            ⭐ Bekijk Visie → {cat.name}
          </button>
        )}
      </div>

    </div>
  )
}

// ─── AiSuggestions — uitklapbaar: AI bedenkt concrete opties, kies er één → planning ──

interface ActionSuggestion { emoji: string; title: string; detail: string }

export function AiSuggestions({ task, project, onAdd, defaultOpen, hideToggle, ctaLabel, addedText }: {
  task: string
  project?: { name: string; description?: string }
  onAdd: (text: string) => Promise<boolean>
  defaultOpen?: boolean
  hideToggle?: boolean
  ctaLabel?: string
  addedText?: string
}) {
  const [open, setOpen]         = useState(!!defaultOpen)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [items, setItems]       = useState<ActionSuggestion[]>([])
  const [added, setAdded]       = useState<number[]>([])
  const [failed, setFailed]     = useState<number[]>([])
  const [busy, setBusy]         = useState<number | null>(null)

  // auto-open + laden wanneer geopend via het ✨-symbool of embedded (doelen)
  useEffect(() => { if (defaultOpen || hideToggle) fetchIdeas() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(i: number, text: string) {
    setBusy(i); setFailed(f => f.filter(x => x !== i))
    let ok = false
    try { ok = await onAdd(text) } catch { ok = false }
    setBusy(null)
    if (ok) setAdded(a => [...a, i])
    else    setFailed(f => [...f, i])
  }

  async function fetchIdeas() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ai/suggest-actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task, project }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Er ging iets mis'); setItems([]) }
      else { setItems(json.suggestions ?? []); setAdded([]) }
    } catch {
      setError('Kon de AI niet bereiken')
    } finally { setLoading(false) }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && items.length === 0 && !loading) fetchIdeas()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {!hideToggle && (
        <button onClick={toggle}
          style={{ padding:'9px 12px', fontSize:12, fontWeight:600, background: open ? 'rgba(168,139,250,.14)' : 'rgba(168,139,250,.08)', border:'1px solid rgba(168,139,250,.3)', color:'#c4b5fd', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
          <span>✨ AI-suggesties {open ? '' : '— laat ideeën bedenken'}</span>
          <span style={{ fontSize:11, color:'#8b7fc7' }}>{open ? '▴' : '▾'}</span>
        </button>
      )}

      {(open || hideToggle) && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, background:'rgba(168,139,250,.05)', border:'1px solid rgba(168,139,250,.18)', borderRadius:10, padding:'10px' }}>
          {loading && (
            <div style={{ fontSize:12, color:'#a78bfa', display:'flex', alignItems:'center', gap:8, padding:'6px 2px' }}>
              <span style={{ width:12, height:12, border:'2px solid rgba(168,139,250,.3)', borderTopColor:'#a78bfa', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' }} />
              Ideeën aan het bedenken…
            </div>
          )}

          {error && !loading && (
            <div style={{ fontSize:11, color:'#f87171', padding:'4px 2px' }}>
              {error}
              <button onClick={fetchIdeas} style={{ marginLeft:8, background:'none', border:'none', color:'#818cf8', cursor:'pointer', textDecoration:'underline', fontSize:11 }}>opnieuw</button>
            </div>
          )}

          {!loading && !error && items.map((s, i) => {
            const isAdded  = added.includes(i)
            const isFailed = failed.includes(i)
            const isBusy   = busy === i
            return (
              <div key={i} style={{ display:'flex', gap:9, alignItems:'flex-start', background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:8, padding:'9px 10px' }}>
                <span style={{ fontSize:17, lineHeight:1.2, flexShrink:0 }}>{s.emoji || '•'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:600, color:'#e2e8f0', lineHeight:1.3 }}>{s.title}</div>
                  {s.detail && <div style={{ fontSize:11, color:'#8a94a6', lineHeight:1.45, marginTop:2 }}>{s.detail}</div>}
                  {isAdded && addedText && <div style={{ fontSize:10, color:'#4ade80', marginTop:3 }}>✓ {addedText}</div>}
                  {isFailed && <div style={{ fontSize:10, color:'#f87171', marginTop:3 }}>Toevoegen mislukt — probeer opnieuw</div>}
                </div>
                <button
                  disabled={isAdded || isBusy}
                  onClick={() => pick(i, `${s.emoji ? s.emoji + ' ' : ''}${s.title}`)}
                  title="Zet dit in de planning van deze dag"
                  style={{ flexShrink:0, alignSelf:'center', fontSize:11, fontWeight:600, padding:'5px 9px', borderRadius:6, cursor:(isAdded||isBusy)?'default':'pointer', whiteSpace:'nowrap',
                    background: isAdded ? 'rgba(63,185,80,.15)' : isFailed ? 'rgba(248,81,73,.12)' : 'rgba(99,102,241,.15)',
                    border: `1px solid ${isAdded ? 'rgba(63,185,80,.4)' : isFailed ? 'rgba(248,81,73,.4)' : 'rgba(99,102,241,.4)'}`,
                    color: isAdded ? '#4ade80' : isFailed ? '#f87171' : '#a5b4fc' }}>
                  {isAdded ? '✓ Toegevoegd' : isBusy ? '…' : isFailed ? '↻ Opnieuw' : (ctaLabel ?? '＋ In planning')}
                </button>
              </div>
            )
          })}

          {!loading && !error && items.length > 0 && (
            <button onClick={fetchIdeas}
              style={{ alignSelf:'flex-start', fontSize:11, color:'#8b7fc7', background:'none', border:'none', cursor:'pointer', padding:'2px', display:'flex', alignItems:'center', gap:4 }}>
              ↻ Nieuwe ideeën
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── WeatherBar ───────────────────────────────────────────────────────────────

interface WeatherForecastDay {
  date: string; maxTemp: number; minTemp: number
  rainChance: number; sunChance: number; description: string; iconCode: string
}
export interface WeatherData {
  station: string; distance: number
  current: { temperature: number; description: string; windDirection: string; windSpeed: number; precipitation: number }
  rainForecast: { time: string; mm: number; pct: number }[]
  isRaining: boolean
  forecast: WeatherForecastDay[]
}

function WeatherBar({ w }: { w: WeatherData | null }) {
  if (!w) return null

  const rainBars = w.rainForecast?.slice(0, 24) ?? []
  const maxMm = Math.max(...rainBars.map(r => r.mm), 0.5)
  const rainSoon = rainBars.slice(0, 6).some(r => r.mm > 0.05)
  const firstRainIdx = rainBars.findIndex(r => r.mm > 0.05)
  const minutesToRain = firstRainIdx >= 0 ? firstRainIdx * 5 : null
  const icon = currentEmoji(w.current.description ?? '', w.isRaining)

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, marginBottom:10, padding:'8px 14px',
      background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:8,
      fontSize:11, color:'#94a3b8', flexWrap:'wrap',
    }}>
      <span style={{ fontSize:16 }}>{icon}</span>
      <span style={{ color:'#e2e8f0', fontWeight:600 }}>{w.current.temperature}°C</span>
      <span>{w.current.description}</span>
      <span style={{ color:'#64748b' }}>|</span>
      <span>💨 {w.current.windDirection} {w.current.windSpeed} m/s</span>
      {rainSoon && minutesToRain !== null
        ? <><span style={{ color:'#64748b' }}>|</span><span style={{ color:'#60a5fa' }}>🌧 regen over {minutesToRain} min</span></>
        : <><span style={{ color:'#64748b' }}>|</span><span style={{ color:'#4ade80' }}>Droog</span></>
      }

      {rainBars.length > 0 && (
        <div style={{ display:'flex', alignItems:'flex-end', gap:1.5, height:18, marginLeft:4 }}>
          {rainBars.map((r, i) => (
            <div key={i} style={{
              width:4, borderRadius:2,
              height: r.mm > 0 ? Math.max(2, (r.mm / maxMm) * 18) : 2,
              background: r.mm > 0.5 ? '#3b82f6' : r.mm > 0.05 ? '#93c5fd' : 'rgba(255,255,255,.08)',
            }} title={`${r.time}: ${r.mm.toFixed(2)} mm/u`} />
          ))}
        </div>
      )}

      {w.forecast?.slice(0, 3).map(d => (
        <span key={d.date} style={{ fontSize:10, color:'#475569', borderLeft:'1px solid rgba(255,255,255,.08)', paddingLeft:8 }}>
          {new Date(d.date+'T12:00:00').toLocaleDateString('nl-NL', { weekday:'short' })}: {d.minTemp}–{d.maxTemp}°C {d.rainChance > 40 ? '🌧' : ''}
        </span>
      ))}

      <span style={{ marginLeft:'auto', fontSize:10, color:'#374151' }}>📡 {w.station} ({w.distance}km)</span>
    </div>
  )
}

// ─── InlineAddForm ────────────────────────────────────────────────────────────

function InlineAddForm({ date, projects, onAdd, onCancel }: {
  date: string
  projects: Project[]
  onAdd: (text:string, type:WeekItem['type'], projId:string|null) => void
  onCancel: () => void
}) {
  const [text,   setText]   = useState('')
  const [type,   setType]   = useState<WeekItem['type']>('task')
  const [projId, setProjId] = useState('')

  return (
    <div style={{ padding:'8px 10px', background:'rgba(99,102,241,.05)', border:'1px solid rgba(99,102,241,.2)', borderRadius:8, marginTop:4, display:'flex', flexDirection:'column', gap:6 }}>
      <input autoFocus value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter' && text.trim()) onAdd(text.trim(),type,projId||null); if (e.key==='Escape') onCancel() }}
        placeholder="Omschrijf de taak…"
        style={{ background:'#0a1020', border:'1px solid rgba(99,102,241,.3)', color:'#e2e8f0', borderRadius:5, padding:'6px 9px', fontSize:12, outline:'none', fontFamily:'inherit' }} />
      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        <select value={type} onChange={e => setType(e.target.value as WeekItem['type'])}
          style={{ fontSize:11, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:4, padding:'3px 6px', cursor:'pointer' }}>
          <option value="task">○ Taak</option>
          <option value="cal">📅 Afspraak</option>
          <option value="sport">💪 Sport</option>
          <option value="kids">👧 Kinderen</option>
          <option value="urgent">🔴 Urgent</option>
        </select>
        <select value={projId} onChange={e => setProjId(e.target.value)}
          style={{ flex:1, fontSize:11, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:4, padding:'3px 6px', cursor:'pointer' }}>
          <option value="">— geen project —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name.split('—')[0].trim()}</option>)}
        </select>
        <button onClick={() => text.trim() && onAdd(text.trim(),type,projId||null)}
          style={{ padding:'3px 12px', background:'rgba(99,102,241,.25)', border:'1px solid #6366f1', color:'#a5b4fc', borderRadius:5, fontSize:11, cursor:'pointer' }}>＋</button>
        <button onClick={onCancel}
          style={{ padding:'3px 8px', background:'none', border:'1px solid var(--border)', color:'var(--dim)', borderRadius:5, fontSize:11, cursor:'pointer' }}>✕</button>
      </div>
    </div>
  )
}

// ─── WeekTab ──────────────────────────────────────────────────────────────────

const DAY_NAMES_NL = ['maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag','zondag']

export function WeekTab({ items, onToggle, onMove, onReorder, onCtx, onAddItem, onOpenRecurModal, projects, onSwitchToMonth, jumpDate, onJumpHandled, gcalConnected, onGcalSync, onOpenDetail, onDeleteItem, onToggleStar, onOpenRoutines, weekSplit, onToggleSplit, onScheduleTask }: {
  items: WeekItem[]
  onToggle: (id:number) => void
  onMove:   (id:number, date:string) => void
  /** Handmatig herschikken binnen dezelfde dag (drop op een ander item, niet op de dagkaart zelf). */
  onReorder?: (updates: { id: number; sort_order: number }[]) => void
  onCtx:    (e:React.MouseEvent, item:WeekItem) => void
  onAddItem: (date:string, text:string, type:WeekItem['type'], projId:string|null) => void
  onOpenRecurModal: () => void
  projects: Project[]
  onSwitchToMonth: () => void
  jumpDate?: string | null
  onJumpHandled?: () => void
  gcalConnected?: boolean
  onGcalSync?: () => Promise<{ synced: number; total: number; error?: string }>
  onOpenDetail: (item:WeekItem, date:string, openAi?:boolean) => void
  onDeleteItem?: (id:number) => void
  onToggleStar?: (id:number) => void
  /** Opent het week-ritme paneel (ma→zo overzicht + urenbalans). */
  onOpenRoutines?: () => void
  /** Staat het splitscherm (Week + Taken naast elkaar) aan? Bepaalt alleen de knop hier. */
  weekSplit?: boolean
  /** Splitscherm aan/uit — knop verschijnt alleen als dit is meegegeven. */
  onToggleSplit?: () => void
  /** Een taak van buitenaf (bv. de Taken-lijst in het splitscherm) op deze dag inplannen. */
  onScheduleTask?: (taskId: number, date: string) => void
}) {
  const [extraWeeks,    setExtraWeeks]    = useState(3)
  const [dragId,        setDragId]        = useState<number|null>(null)
  const [dragOver,      setDragOver]      = useState<string|null>(null)
  const [hoveredItem,   setHoveredItem]   = useState<number|null>(null)
  const [addingDate,    setAddingDate]    = useState<string|null>(null)
  const [gcalStatus,    setGcalStatus]    = useState<string|null>(null)
  const [gcalSyncing,   setGcalSyncing]   = useState(false)
  const [weather,       setWeather]       = useState<WeatherData | null>(null)
  const [weekNavOffset, setWeekNavOffset] = useState<number | null>(null)
  const todayRef  = useRef<HTMLDivElement>(null)
  const jumpRef   = useRef<HTMLDivElement>(null)
  const keyNavRef = useRef<HTMLDivElement>(null)
  const today     = todayLocal()

  useEffect(() => {
    const load = () => fetch('/api/weather').then(r => r.json()).then(setWeather).catch(() => null)
    load()
    const id = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const dayWeather: Record<string, { emoji: string; maxTemp: number; rainChance: number }> = {}
  // weather?.current: een onvolledig/foutief antwoord van /api/weather mag de
  // hele weekview niet laten crashen — dan laten we het weer simpelweg weg.
  if (weather?.current) {
    dayWeather[today] = {
      emoji: currentEmoji(weather.current.description ?? '', weather.isRaining),
      maxTemp: weather.current.temperature,
      rainChance: weather.isRaining ? 100 : 0,
    }
    for (const f of weather.forecast ?? []) {
      if (f.date) dayWeather[f.date] = {
        emoji: forecastEmoji(f.iconCode, f.description),
        maxTemp: f.maxTemp,
        rainChance: f.rainChance,
      }
    }
  }

  // Direct (niet smooth) naar vandaag: een smooth scroll leunt op
  // requestAnimationFrame, dat een net-geopende of nog niet volledig actieve
  // mobiele tab kan uitstellen of overslaan — dan blijft "vandaag" alsnog
  // buiten beeld. Ook opnieuw scrollen zodra het weer binnenkomt: WeatherBar
  // rendert null tot de fetch klaar is, dus die kaart schuift alle
  // dagkaarten omlaag ná de eerste scroll, op het moment dat "vandaag" er
  // al had moeten staan.
  useEffect(() => {
    todayRef.current?.scrollIntoView({ behavior:'auto', block:'start' })
  }, [weather])

  useEffect(() => {
    if (!jumpDate) return
    const now = new Date()
    const target = new Date(jumpDate+'T12:00:00')
    const weeksAhead = Math.ceil((target.getTime() - now.getTime()) / (7*24*60*60*1000))
    if (weeksAhead > extraWeeks) setExtraWeeks(weeksAhead + 2)
    setTimeout(() => { jumpRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }) }, 100)
    onJumpHandled?.()
  }, [jumpDate]) // eslint-disable-line

  // Arrow-key week navigation (← / →) — ignored when an input is focused
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setWeekNavOffset(o => (o ?? 0) - 1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); setWeekNavOffset(o => (o ?? 0) + 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const keyNavDate = useMemo(() => {
    if (weekNavOffset === null) return null
    const d = new Date()
    d.setDate(d.getDate() + weekNavOffset * 7)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // floor to Monday
    return toLocalISODate(d)
  }, [weekNavOffset])

  useEffect(() => {
    if (!keyNavDate) return
    const weeksAhead = Math.ceil((new Date(keyNavDate+'T12:00:00').getTime() - new Date().getTime()) / (7*24*60*60*1000))
    if (weeksAhead > extraWeeks) setExtraWeeks(weeksAhead + 2)
    setTimeout(() => keyNavRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 100)
  }, [keyNavDate]) // eslint-disable-line

  const pastWeeks = 2
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - pastWeeks * 7)
  const totalDays = (pastWeeks + 1 + extraWeeks) * 7
  const dates = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return toLocalISODate(d)
  })

  function dIdx(date: string): number { return (new Date(date+'T12:00:00').getDay() + 6) % 7 }

  function drop(date: string, e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer?.types?.includes(TASK_MIME) && onScheduleTask) {
      // Een taak van buiten WeekTab (bv. de Taken-lijst in het splitscherm) —
      // dit gaat via echte dataTransfer-data, niet via lokale state, want de
      // sleep begint in een ander component.
      const taskId = Number(e.dataTransfer.getData(TASK_MIME))
      if (taskId) onScheduleTask(taskId, date)
    } else if (dragId !== null) {
      const it = items.find(i => i.id === dragId)
      if (it && it.date !== date) onMove(dragId, date)
    }
    setDragId(null); setDragOver(null)
  }

  const overdueCount = items.filter(i => i.date < dates[0] && !i.done).length

  return (
    <div style={{ maxWidth:720, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:6, overflow:'hidden' }}>
          <button style={{ padding:'5px 12px', fontSize:11, background:'rgba(99,102,241,.2)', border:'none', color:'#818cf8', fontWeight:600, cursor:'default' }}>
            📋 Week
          </button>
          <button onClick={onSwitchToMonth}
            style={{ padding:'5px 12px', fontSize:11, background:'none', border:'none', color:'var(--dim)', cursor:'pointer' }}>
            🗓 Maand
          </button>
          {onToggleSplit && (
            <button onClick={onToggleSplit}
              title={weekSplit ? 'Splitscherm uit' : 'Week + Taken naast elkaar — sleep een taak naar een dag om in te plannen'}
              style={{ padding:'5px 12px', fontSize:11, background: weekSplit ? 'rgba(99,102,241,.2)' : 'none', border:'none', color: weekSplit ? '#818cf8' : 'var(--dim)', fontWeight: weekSplit ? 600 : 400, cursor:'pointer' }}>
              ⊞ Split
            </button>
          )}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
          {gcalConnected ? (
            <button
              disabled={gcalSyncing}
              onClick={async () => {
                setGcalSyncing(true); setGcalStatus(null)
                const r = await onGcalSync?.()
                setGcalStatus(r?.error ? `Fout: ${r.error}` : `✓ ${r?.synced ?? 0} nieuwe events gesynchroniseerd`)
                setGcalSyncing(false)
                setTimeout(() => setGcalStatus(null), 4000)
              }}
              style={{ fontSize:11, padding:'5px 10px', background:'rgba(74,222,128,.08)', border:'1px solid rgba(74,222,128,.25)', color: gcalSyncing ? '#374151' : '#4ade80', borderRadius:6, cursor: gcalSyncing ? 'default' : 'pointer', display:'flex', alignItems:'center', gap:5 }}>
              {gcalSyncing ? '⟳ Synchroniseren…' : '📆 Google Calendar sync'}
            </button>
          ) : (
            <a href="/login"
              title="Log in met Google om Google Calendar te koppelen"
              style={{ fontSize:11, padding:'5px 10px', background:'rgba(255,255,255,.04)', border:'1px solid var(--border)', color:'var(--dim)', borderRadius:6, cursor:'pointer', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
              📆 Google Calendar koppelen
            </a>
          )}
          {gcalStatus && <span style={{ fontSize:10, color:'#4ade80', whiteSpace:'nowrap' }}>{gcalStatus}</span>}
          {onOpenRoutines && (
            <button onClick={onOpenRoutines}
              title="Je week-ritme: ma→zo overzicht van routines, uren en aan/uit"
              style={{ fontSize:11, padding:'5px 12px', background:'rgba(167,139,250,.1)', border:'1px solid rgba(167,139,250,.3)', color:'#a78bfa', borderRadius:6, cursor:'pointer' }}>
              📊 Week-ritme
            </button>
          )}
          <button onClick={onOpenRecurModal}
            style={{ fontSize:11, padding:'5px 12px', background:'rgba(129,140,248,.1)', border:'1px solid rgba(129,140,248,.25)', color:'#818cf8', borderRadius:6, cursor:'pointer' }}>
            ↻ Herhaaltaken beheren
          </button>
        </div>
      </div>

      <WeatherBar w={weather} />

      {overdueCount > 0 && (
        <div style={{ marginBottom:14, padding:'9px 14px', background:'#2d1a00', border:'1px solid #5c3400', borderRadius:8, fontSize:12, color:'#fb923c', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#f97316', animation:'pulse 1.5s infinite', display:'inline-block', flexShrink:0 }} />
          <strong>{overdueCount} openstaande items</strong> van vóór dit venster
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {dates.map(date => {
          const d        = new Date(date+'T12:00:00')
          const di       = dIdx(date)
          const dayName  = DAY_NAMES_NL[di]
          const isToday  = date === today
          const isPast   = date < today
          const isMonday = di === 0
          const dayItems = items.filter(i => i.date === date).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          const openCount = dayItems.filter(i => !i.done).length
          const allDone  = dayItems.length > 0 && dayItems.every(i => i.done)
          const isOver   = dragOver === date

          return (
            <div key={date}>
              {isMonday && date !== dates[0] && (
                <div style={{ display:'flex', alignItems:'center', gap:10, margin:'8px 0 0' }}>
                  <div style={{ flex:1, height:1, background:'rgba(255,255,255,.06)' }} />
                  <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'var(--dim)', whiteSpace:'nowrap' }}>
                    week van {d.getDate()} {MONTHS_S[d.getMonth()]}
                  </span>
                  <div style={{ flex:1, height:1, background:'rgba(255,255,255,.06)' }} />
                </div>
              )}

              <div data-date={date}
                ref={isToday ? todayRef : jumpDate && date === jumpDate ? jumpRef : keyNavDate && date === keyNavDate ? keyNavRef : undefined}
                onDragOver={e => { e.preventDefault(); setDragOver(date) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                onDrop={e => drop(date, e)}
                style={{
                  background:'var(--bg2)',
                  border:`1px solid ${isOver?'#818cf8':isToday?'#6366f1':'var(--border)'}`,
                  borderRadius:8, overflow:'hidden', marginTop: isMonday && date !== dates[0] ? 6 : 0,
                  opacity: isPast && allDone && dayItems.length > 0 ? 0.45 : 1,
                  transition:'all .2s',
                  boxShadow: isOver ? '0 0 0 2px rgba(99,102,241,.3)' : isToday ? '0 0 0 1px rgba(99,102,241,.12)' : 'none',
                }}>

                <div style={{
                  padding:'10px 14px',
                  borderBottom: dayItems.length > 0 ? `1px solid ${isToday?'rgba(99,102,241,.4)':'var(--border)'}` : 'none',
                  background: isToday?'rgba(99,102,241,.1)':isPast?'transparent':'rgba(255,255,255,.01)',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', color:isToday?'#818cf8':isPast?'var(--dim)':'var(--muted)' }}>
                      {isToday ? '📍 vandaag' : dayName}
                    </span>
                    <span style={{ fontSize:20, fontWeight:700, lineHeight:1, color:isToday?'var(--text)':isPast?'var(--dim)':'var(--muted)' }}>
                      {d.getDate()} <span style={{ fontSize:13, fontWeight:500 }}>{MONTHS_S[d.getMonth()]}</span>
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    {dayWeather[date] && typeof dayWeather[date].maxTemp === 'number' && !isNaN(dayWeather[date].maxTemp) && (
                      <span style={{ fontSize:11, color: dayWeather[date].rainChance > 60 ? '#60a5fa' : '#94a3b8', display:'flex', alignItems:'center', gap:3 }}
                        title={`${dayWeather[date].rainChance}% kans op regen`}>
                        {dayWeather[date].emoji} {dayWeather[date].maxTemp}°
                      </span>
                    )}
                    {allDone && <span style={{ fontSize:11, color:'var(--green)' }}>✓ alles klaar</span>}
                    {dayItems.length === 0 && (
                      <span style={{ fontSize:10, color:'var(--dim)' }}>Vrij</span>
                    )}
                    {openCount > 0 && (
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:10, background:isToday?'rgba(99,102,241,.2)':isPast?'rgba(248,81,73,.1)':'var(--bg3)', color:isToday?'#a5b4fc':isPast?'#f87171':'var(--muted)', border:`1px solid ${isToday?'#6366f1':isPast?'#4d1a1a':'var(--border)'}` }}>
                        {openCount} open
                      </span>
                    )}
                  </div>
                </div>

                {dayItems.length > 0 && (
                  <div style={{ padding:'8px 10px', display:'flex', flexDirection:'column', gap:4 }}>
                    {dayItems.map(item => {
                      const s = WEEK_TYPE[item.type] ?? WEEK_TYPE.task
                      const proj = item.proj_id ? projects.find(p => p.id === item.proj_id) : null
                      const dragging = dragId === item.id
                      const isHovered = hoveredItem === item.id
                      return (
                        <div key={item.id}
                          draggable
                          onDragStart={e => { e.dataTransfer.effectAllowed='move'; setDragId(item.id) }}
                          onDragEnd={() => { setDragId(null); setDragOver(null) }}
                          onDragOver={e => {
                            if (dragId === null) return
                            const draggedItem = items.find(i => i.id === dragId)
                            if (!draggedItem || draggedItem.date !== date) return   // andere dag: laat doorbubbelen naar de dagkaart zelf
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onDrop={e => {
                            if (dragId === null || dragId === item.id) return
                            const draggedItem = items.find(i => i.id === dragId)
                            if (!draggedItem || draggedItem.date !== date) return   // andere dag: laat de dagkaart dit afhandelen
                            e.preventDefault()
                            e.stopPropagation()
                            setDragId(null); setDragOver(null)
                            const dayList = items.filter(i => i.date === date).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                            const reordered = reorderList(dayList, draggedItem.id, item.id)
                            if (reordered !== dayList) onReorder?.(reordered.map(x => ({ id: x.id, sort_order: x.sort_order ?? 0 })))
                          }}
                          onClick={() => onOpenDetail(item, date)}
                          onContextMenu={e => onCtx(e, item)}
                          onMouseEnter={() => setHoveredItem(item.id)}
                          onMouseLeave={() => setHoveredItem(null)}
                          style={{
                            display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:6,
                            cursor: dragging ? 'grabbing' : 'grab',
                            background: item.done ? 'transparent' : s.bg,
                            border:`1px solid ${item.done?'var(--border)':s.border}`,
                            opacity: dragging ? 0.35 : item.done ? 0.4 : 1,
                            transition:'opacity .15s, background .15s', userSelect:'none',
                            ...(item.starred && !item.done ? { boxShadow:'inset 3px 0 0 #fbbf24' } : {}),
                          }}>
                          <span style={{ color:'var(--dim)', fontSize:12, flexShrink:0, letterSpacing:'-1px', lineHeight:1, cursor:'grab' }}>⠿⠿</span>
                          <div onClick={e => { e.stopPropagation(); onToggle(item.id) }} onMouseDown={e => e.stopPropagation()}
                            style={{ width:18, height:18, borderRadius:4, flexShrink:0, border:`2px solid ${item.done?'#3fb950':s.border}`, background:item.done?'#3fb950':'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#fff', fontWeight:700, transition:'all .15s', cursor:'pointer' }}>
                            {item.done ? '✓' : ''}
                          </div>
                          <span style={{ fontSize:14, flexShrink:0 }}>{s.icon === '○' ? '' : s.icon}</span>
                          <span style={{ flex:1, fontSize:13, lineHeight:1.4, color:item.done?'var(--dim)':s.color, textDecoration:item.done?'line-through':'none' }}>
                            {item.time_block && (
                              <span style={{ fontSize:11, fontWeight:600, marginRight:6, fontVariantNumeric:'tabular-nums', color:item.done?'var(--dim)':'#58a6ff' }}>
                                {item.time_block}
                              </span>
                            )}
                            {item.text}
                            {(item.postponed_count ?? 0) >= 2 && !item.done && (
                              <span title={`Al ${item.postponed_count}× doorgeschoven`} style={{ fontSize:10, color:'#fb923c', marginLeft:6, fontWeight:700 }}>↷{item.postponed_count}</span>
                            )}
                          </span>
                          {item.recur_id && (
                            <span title="Herhalende taak" style={{ fontSize:9, padding:'1px 6px', borderRadius:10, background:'rgba(129,140,248,.1)', border:'1px solid rgba(129,140,248,.25)', color:'#818cf8', flexShrink:0 }}>↻</span>
                          )}
                          {proj && (
                            <span title={proj.name} style={{ fontSize:10, color:'var(--dim)', flexShrink:0, padding:'2px 7px', background:'var(--bg4)', borderRadius:4, border:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                              {proj.emoji} {proj.name.split('—')[0].trim()}
                            </span>
                          )}
                          {onToggleStar && (
                            <button
                              onClick={e => { e.stopPropagation(); onToggleStar(item.id) }}
                              onMouseDown={e => e.stopPropagation()}
                              title={item.starred ? 'Ster weghalen' : 'Ster geven (belangrijk)'}
                              style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', fontSize:14, padding:'0 2px', lineHeight:1, color: item.starred ? '#fbbf24' : 'var(--dim)', opacity: item.starred ? 1 : (isHovered ? 0.7 : 0), transition:'opacity .1s' }}>
                              {item.starred ? '★' : '☆'}
                            </button>
                          )}
                          {!item.done && item.type !== 'cal' && taskWantsIdeas(item.text) && (
                            <button
                              onClick={e => { e.stopPropagation(); onOpenDetail(item, date, true) }}
                              onMouseDown={e => e.stopPropagation()}
                              title="AI-suggesties — laat ideeën bedenken voor deze taak"
                              style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', fontSize:13, padding:'0 2px', lineHeight:1, opacity: isHovered ? 1 : 0.55, transition:'opacity .1s' }}>
                              ✨
                            </button>
                          )}
                          {onDeleteItem && (
                            <button
                              onClick={e => { e.stopPropagation(); onDeleteItem(item.id) }}
                              title="Verwijderen"
                              onMouseDown={e => e.stopPropagation()}
                              style={{
                                flexShrink:0, background:'none', border:'none', cursor:'pointer',
                                fontSize:13, color:'#f87171', padding:'0 2px', lineHeight:1,
                                opacity: isHovered ? 0.7 : 0, transition:'opacity .1s',
                              }}
                              onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.opacity='1' }}
                              onMouseLeave={e => { e.currentTarget.style.opacity='0.7' }}>
                              🗑
                            </button>
                          )}
                        </div>
                      )
                    })}

                    {isOver && dragId !== null && (
                      <div style={{ height:38, border:'2px dashed rgba(99,102,241,.5)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', color:'#818cf8', fontSize:11, background:'rgba(99,102,241,.05)' }}>
                        Verplaats naar {isToday?'vandaag':dayName} {d.getDate()} {MONTHS_S[d.getMonth()]}
                      </div>
                    )}
                  </div>
                )}

                {addingDate === date
                  ? <InlineAddForm date={date} projects={projects} onAdd={(text,type,projId) => { onAddItem(date,text,type,projId); setAddingDate(null) }} onCancel={() => setAddingDate(null)} />
                  : <button onClick={() => setAddingDate(date)} style={{ width:'100%', padding:'6px', fontSize:11, color:'var(--dim)', background:'none', border:'1px dashed rgba(255,255,255,.07)', borderRadius:6, cursor:'pointer', marginTop: dayItems.length>0 ? 4 : 0, transition:'all .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(99,102,241,.4)'; e.currentTarget.style.color='#818cf8' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.07)'; e.currentTarget.style.color='var(--dim)' }}>
                      + toevoegen
                    </button>
                }
              </div>
            </div>
          )
        })}

        <button onClick={() => setExtraWeeks(w => w + 4)}
          style={{ width:'100%', padding:'12px', fontSize:12, fontWeight:600, color:'var(--muted)', background:'var(--bg2)', border:'1px dashed var(--border)', borderRadius:8, cursor:'pointer', transition:'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.color='#818cf8' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--muted)' }}>
          Meer weken laden →
        </button>
      </div>
    </div>
  )
}

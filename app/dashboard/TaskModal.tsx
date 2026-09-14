'use client'
import { useState } from 'react'
import type { Task, Project, Category, TaskStatus, Subtask } from '@/lib/types'
import { isDeadlinePostponed } from '@/lib/deadline-horizon'
import { Attachments } from './Attachments'
import { DAYS_NL_FULL, DAYS_EN_KEYS } from './RecurringTaskModal'

const DURATION_OPTIONS = [null,15,25,30,45,60,90,120]

function fmtMin(min: number): string {
  return min >= 60 ? `${Math.floor(min/60)}u${min%60 ? `${min%60}m` : ''}` : `${min}m`
}

export function TaskModal({ task, project, category, allProjects, onClose, onUpdate, onSetDuration, onSetPriority, onSetNotes, onSetSubtasks, onSetDeadline, onAssignProject, onStartFocus, onConvertToRecurring, onRename }: {
  task: Task; project: Project|null; category: Category|null; allProjects: Project[]
  onClose: () => void; onUpdate: (id:number, s:TaskStatus) => void
  onSetDuration: (id:number, min:number|null) => void
  onSetPriority: (id:number, priority:number) => void
  onSetNotes:    (id:number, notes:string) => void
  onSetSubtasks: (id:number, subtasks:Subtask[]) => void
  onSetDeadline: (id:number, deadline:string|null) => void
  onAssignProject: (id:number, projId:string) => void
  onStartFocus:  (t:Task) => void
  /** Zet deze taak om in een herhaaltaak op de gekozen dagen — de taak zelf gaat naar de prullenbak. */
  onConvertToRecurring?: (task:Task, days:string[]) => void
  /** Titel hernoemen door erop te klikken — zoals bij projecten en doelen. */
  onRename?: (id:number, name:string) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [editName,    setEditName]    = useState(false)
  const [nameDraft,   setNameDraft]   = useState(task.name)
  const [notesDraft,  setNotesDraft]  = useState(task.notes ?? '')
  const [newSubtask,  setNewSubtask]  = useState('')
  const [showRecur,   setShowRecur]   = useState(false)
  const [recurDays,   setRecurDays]   = useState<string[]>([])
  const subtasks = task.subtasks ?? []

  function toggleRecurDay(d: string) { setRecurDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev,d]) }
  function submitConvert() {
    if (recurDays.length === 0) return
    onConvertToRecurring?.(task, recurDays)
    onClose()
  }

  function addSubtask(e: React.FormEvent) {
    e.preventDefault()
    if (!newSubtask.trim()) return
    onSetSubtasks(task.id, [...subtasks, { text: newSubtask.trim(), done: false }])
    setNewSubtask('')
  }
  function toggleSubtask(i: number) {
    onSetSubtasks(task.id, subtasks.map((s, idx) => idx === i ? { ...s, done: !s.done } : s))
  }
  function removeSubtask(i: number) {
    onSetSubtasks(task.id, subtasks.filter((_, idx) => idx !== i))
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width: typeof window !== 'undefined' ? Math.min(520, window.innerWidth - 24) : 520, maxHeight:'80vh', background:'#0d1117',
        border:'1px solid rgba(99,102,241,.35)', borderRadius:16,
        boxShadow:'0 32px 80px rgba(0,0,0,.8)',
        display:'flex', flexDirection:'column', overflow:'hidden',
        animation:'bubbleIn .2s ease',
      }}>
        {/* Header */}
        <div style={{ padding:'14px 18px', background:'rgba(99,102,241,.08)', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'#6366f1', marginBottom:4 }}>Taak details</div>
            {editName && onRename ? (
              <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)} aria-label="Taaknaam"
                onBlur={() => { if (nameDraft.trim() && nameDraft.trim() !== task.name) onRename(task.id, nameDraft.trim()); setEditName(false) }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setNameDraft(task.name); setEditName(false) } }}
                style={{ fontSize:15, fontWeight:700, width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,.06)', border:'1px solid rgba(99,102,241,.4)', borderRadius:7, color:'#f1f5f9', outline:'none', padding:'2px 7px', fontFamily:'inherit' }} />
            ) : (
              <div onClick={() => { if (onRename) { setNameDraft(task.name); setEditName(true) } }}
                title={onRename ? 'Klik om te hernoemen' : undefined}
                style={{ fontSize:15, fontWeight:700, color:'#f1f5f9', lineHeight:1.3, cursor: onRename ? 'text' : 'default' }}>{task.name}</div>
            )}
            <div style={{ display:'flex', gap:6, marginTop:6 }}>
              {(['backlog','doing','waiting','done'] as TaskStatus[]).map(s => (
                <button key={s} onClick={() => onUpdate(task.id, s)} style={{
                  padding:'2px 10px', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer',
                  background: task.status===s ? 'rgba(99,102,241,.3)' : 'rgba(255,255,255,.06)',
                  border:`1px solid ${task.status===s?'#6366f1':'rgba(255,255,255,.1)'}`,
                  color: task.status===s ? '#a5b4fc' : '#64748b',
                  transition:'all .15s',
                }}>{s}</button>
              ))}
              {task.urgent && <span style={{ padding:'2px 10px', borderRadius:6, fontSize:10, fontWeight:600, background:'rgba(248,81,73,.15)', border:'1px solid rgba(248,81,73,.3)', color:'#f87171' }}>⚡ urgent</span>}
            </div>
            {/* Duration + focus row */}
            <div style={{ display:'flex', gap:6, marginTop:8, alignItems:'center' }}>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.6px', textTransform:'uppercase', color:'#4b5563' }}>Duur:</span>
              <select
                value={task.duration_min ?? ''}
                onChange={e => onSetDuration(task.id, e.target.value === '' ? null : Number(e.target.value))}
                aria-label="Taakduur"
                style={{ fontSize:10, padding:'2px 6px', borderRadius:5, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.05)', color:'#94a3b8', cursor:'pointer', outline:'none' }}
              >
                <option value=''>— min</option>
                {DURATION_OPTIONS.filter(Boolean).map(m => (
                  <option key={m} value={m!}>{m! >= 60 ? `${m!/60}u` : `${m}m`}</option>
                ))}
              </select>
              {task.duration_min && (
                <span style={{ fontSize:10, color:'#6366f1', background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.25)', borderRadius:5, padding:'2px 8px' }}>
                  ⏱ {fmtMin(task.duration_min)}
                </span>
              )}
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.6px', textTransform:'uppercase', color:'#4b5563', marginLeft:6 }}>Prioriteit:</span>
              <select
                value={task.priority ?? 0}
                onChange={e => onSetPriority(task.id, Number(e.target.value))}
                aria-label="Taakprioriteit"
                style={{ fontSize:10, padding:'2px 6px', borderRadius:5, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.05)', color:'#94a3b8', cursor:'pointer', outline:'none' }}
              >
                <option value={0}>— geen</option>
                {[1,2,3,4,5].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {!!task.priority && (
                <span style={{ fontSize:10, color:'#fbbf24', background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.25)', borderRadius:5, padding:'2px 8px' }}>
                  🔺 P{task.priority}
                </span>
              )}
              {(task.actual_min ?? 0) > 0 && (
                <span title="Werkelijk bestede tijd (via focustimer)"
                  style={{ fontSize:10, color: task.duration_min && task.actual_min! > task.duration_min ? '#fb923c' : '#3fb950', background:'rgba(63,185,80,.08)', border:'1px solid rgba(63,185,80,.2)', borderRadius:5, padding:'2px 8px' }}>
                  ▶ {fmtMin(task.actual_min!)} gewerkt
                </span>
              )}
              <button
                onClick={() => onStartFocus(task)}
                aria-label="Focus starten"
                style={{ marginLeft:'auto', fontSize:10, padding:'3px 10px', borderRadius:5, border:'1px solid rgba(99,102,241,.4)', background:'rgba(99,102,241,.12)', color:'#818cf8', cursor:'pointer', fontWeight:600 }}
              >▶ Focus</button>
            </div>
            {/* Deadline — stuurt met een deadline de horizon in Taken → Horizon automatisch aan */}
            <div style={{ display:'flex', gap:6, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.6px', textTransform:'uppercase', color:'#4b5563' }}>Deadline:</span>
              <input type="date" value={task.deadline ?? ''} aria-label="Deadline"
                onChange={e => onSetDeadline(task.id, e.target.value || null)}
                style={{ fontSize:10, padding:'2px 6px', borderRadius:5, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.05)', color:'#94a3b8', outline:'none' }} />
              {task.deadline && task.deadline < today && (
                <span style={{ fontSize:10, color:'#f87171' }}>⚠ te laat</span>
              )}
              {isDeadlinePostponed(task) && (
                <span title={`Was ${task.original_deadline}, nu ${task.deadline}`} style={{ fontSize:10, color:'var(--dim)' }}>🔀 verschoven</span>
              )}
              <span style={{ fontSize:9, color:'#4b5563', marginLeft: task.deadline ? 0 : 'auto' }}>
                Aangemaakt {new Date(task.created_at).toLocaleDateString('nl-NL')}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', color:'#94a3b8', cursor:'pointer', fontSize:15, padding:'5px 9px', borderRadius:7 }}>✕</button>
        </div>

        {/* RPM chain */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:12 }}>

          {/* Inbox → project kiezen */}
          {!task.proj_id && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'rgba(180,83,9,.08)', border:'1px solid rgba(180,83,9,.3)', borderRadius:8 }}>
              <span style={{ fontSize:12, color:'#fbbf24', fontWeight:600, flexShrink:0 }}>📥 Inbox</span>
              <select defaultValue="" aria-label="Project toewijzen"
                onChange={e => { if (e.target.value) onAssignProject(task.id, e.target.value) }}
                style={{ flex:1, fontSize:11, background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:6, padding:'5px 8px', cursor:'pointer' }}>
                <option value="" disabled>Kies een project…</option>
                {allProjects.filter(p => p.status !== 'slapend').map(p => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name.split('—')[0].trim()}</option>
                ))}
              </select>
            </div>
          )}

          {/* Subtaken */}
          <div>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'#94a3b8', marginBottom:6 }}>
              Subtaken {subtasks.length > 0 && <span style={{ color:'#3fb950' }}>({subtasks.filter(s=>s.done).length}/{subtasks.length})</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {subtasks.map((s, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 8px', background:'rgba(255,255,255,.03)', borderRadius:6 }}>
                  <button onClick={() => toggleSubtask(i)} aria-label={`Subtaak ${s.text} afvinken`}
                    style={{ flexShrink:0, width:15, height:15, borderRadius:4, border:`1.5px solid ${s.done ? '#3fb950' : 'rgba(255,255,255,.25)'}`, background: s.done ? 'rgba(63,185,80,.2)' : 'none', cursor:'pointer', color:'#3fb950', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                    {s.done ? '✓' : ''}
                  </button>
                  <span style={{ flex:1, fontSize:12, color: s.done ? 'var(--dim)' : 'var(--text)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.text}</span>
                  <button onClick={() => removeSubtask(i)} aria-label={`Subtaak ${s.text} verwijderen`}
                    style={{ fontSize:10, color:'var(--dim)', background:'none', border:'none', cursor:'pointer', padding:'0 3px' }}>×</button>
                </div>
              ))}
            </div>
            <form onSubmit={addSubtask} style={{ display:'flex', gap:6, marginTop:5 }}>
              <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} placeholder="+ subtaak toevoegen…" aria-label="Nieuwe subtaak"
                style={{ flex:1, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', fontSize:11, padding:'5px 9px', outline:'none', fontFamily:'inherit' }} />
              {newSubtask.trim() && (
                <button type="submit" style={{ fontSize:10, padding:'4px 10px', borderRadius:6, border:'none', background:'#4f46e5', color:'#fff', cursor:'pointer', fontWeight:600 }}>OK</button>
              )}
            </form>
          </div>

          {/* Notities */}
          <div>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'#94a3b8', marginBottom:6 }}>Notities</div>
            <textarea
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              onBlur={() => { if (notesDraft !== (task.notes ?? '')) onSetNotes(task.id, notesDraft) }}
              placeholder="Aantekeningen bij deze taak…"
              aria-label="Taaknotities"
              rows={3}
              style={{ width:'100%', boxSizing:'border-box', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:7, color:'var(--text)', fontSize:12, padding:'8px 11px', outline:'none', fontFamily:'inherit', resize:'vertical', lineHeight:1.5 }}
            />
          </div>

          {/* Bijlagen */}
          <div>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'#94a3b8', marginBottom:6 }}>Bijlagen</div>
            <Attachments entityType="task" entityId={String(task.id)} />
          </div>

          {/* Herhaling — omzetten naar een herhaaltaak */}
          {onConvertToRecurring && (
            <div>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'#94a3b8', marginBottom:6 }}>Herhaling</div>
              {!showRecur ? (
                <button onClick={() => setShowRecur(true)}
                  style={{ fontSize:11, padding:'6px 12px', background:'rgba(129,140,248,.1)', border:'1px solid rgba(129,140,248,.3)', color:'#818cf8', borderRadius:6, cursor:'pointer' }}>
                  ↻ Maak hier een herhaaltaak van
                </button>
              ) : (
                <div style={{ padding:'10px 12px', background:'rgba(129,140,248,.06)', border:'1px solid rgba(129,140,248,.25)', borderRadius:8 }}>
                  <div style={{ fontSize:11, color:'#94a3b8', marginBottom:8 }}>Op welke dagen? Deze taak gaat daarna naar de prullenbak (gewoon terug te halen).</div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
                    {DAYS_EN_KEYS.map((d, i) => (
                      <button key={d} onClick={() => toggleRecurDay(d)}
                        style={{ padding:'4px 9px', fontSize:10, fontWeight:600, borderRadius:5, cursor:'pointer',
                          background: recurDays.includes(d) ? 'rgba(99,102,241,.25)' : 'var(--bg3)',
                          border: `1px solid ${recurDays.includes(d) ? '#6366f1' : 'var(--border)'}`,
                          color: recurDays.includes(d) ? '#a5b4fc' : 'var(--dim)' }}>
                        {DAYS_NL_FULL[i].slice(0,2)}
                      </button>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={submitConvert} disabled={recurDays.length === 0}
                      style={{ flex:1, fontSize:11, fontWeight:600, padding:'6px', borderRadius:6,
                        border:`1px solid ${recurDays.length ? '#6366f1' : 'var(--border)'}`,
                        background: recurDays.length ? 'rgba(99,102,241,.25)' : 'var(--bg3)',
                        color: recurDays.length ? '#a5b4fc' : 'var(--dim)', cursor: recurDays.length ? 'pointer' : 'default' }}>
                      Omzetten naar herhaling
                    </button>
                    <button onClick={() => { setShowRecur(false); setRecurDays([]) }}
                      style={{ fontSize:11, padding:'6px 12px', background:'none', border:'1px solid var(--border)', color:'var(--dim)', borderRadius:6, cursor:'pointer' }}>
                      Annuleer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task */}
          <RpmChainNode label="Taak" color="#818cf8" icon="○">
            <div style={{ fontSize:13, color:'#c7d2fe', fontWeight:500 }}>{task.name}</div>
          </RpmChainNode>

          {/* Project */}
          {project && (
            <RpmChainNode label="Project" color="#34d399" icon={project.emoji}>
              <div style={{ fontSize:13, color:'#a7f3d0', fontWeight:600 }}>{project.name}</div>
              {project.description && <div style={{ fontSize:11, color:'#6b7280', marginTop:3, lineHeight:1.5 }}>{project.description}</div>}
              {project.vision && (
                <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(52,211,153,.06)', border:'1px solid rgba(52,211,153,.15)', borderRadius:6 }}>
                  <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'#34d399', marginBottom:4 }}>Project visie</div>
                  <div style={{ fontSize:11, color:'#6b7280', lineHeight:1.6 }}>{project.vision}</div>
                </div>
              )}
            </RpmChainNode>
          )}

          {/* Category */}
          {category && (
            <RpmChainNode label="Categorie" color="#f472b6" icon="◉">
              <div style={{ fontSize:13, color:'#fbcfe8', fontWeight:600 }}>{category.name}</div>
              {category.vision && (
                <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(244,114,182,.06)', border:'1px solid rgba(244,114,182,.15)', borderRadius:6 }}>
                  <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'#f472b6', marginBottom:4 }}>Categorie visie</div>
                  <div style={{ fontSize:11, color:'#6b7280', lineHeight:1.6 }}>{category.vision}</div>
                </div>
              )}
              {category.rpm_3month && (
                <div style={{ marginTop:6, fontSize:10, color:'#4b5563' }}>
                  <span style={{ color:'#f472b6', fontWeight:600 }}>3-mnd doel:</span> {category.rpm_3month}
                </div>
              )}
            </RpmChainNode>
          )}

          {/* Ultimate Vision pointer */}
          <div style={{ padding:'10px 12px', background:'rgba(99,102,241,.06)', border:'1px dashed rgba(99,102,241,.2)', borderRadius:8, fontSize:11, color:'#4b5563', lineHeight:1.6 }}>
            <span style={{ color:'#6366f1', fontWeight:600 }}>↑ Ultieme visie:</span> In mijn ultieme visie heb ik een huis op mijn eigen hectare grond. Ik ben in flow. Ik verbind mensen. Ik ben onderdeel van een band. Mijn kinderen doen het fantastisch. Ik maak een positieve impact die doorwerkt in toekomstige generaties.
          </div>
        </div>
      </div>
    </div>
  )
}

function RpmChainNode({ label, color, icon, children }: { label:string; color:string; icon:string; children:React.ReactNode }) {
  return (
    <div style={{ display:'flex', gap:12 }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:`${color}18`, border:`1.5px solid ${color}50`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color }}>
          {icon.length <= 2 ? icon : icon[0]}
        </div>
        <div style={{ width:1, flex:1, minHeight:16, background:`${color}20`, marginTop:4 }} />
      </div>
      <div style={{ flex:1, paddingBottom:4 }}>
        <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color, marginBottom:5 }}>{label}</div>
        {children}
      </div>
    </div>
  )
}

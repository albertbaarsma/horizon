'use client'
import { useState } from 'react'
import type { Goal, Project } from '@/lib/types'
import type { LinkedTask } from '@/lib/goal-tasks'

// ─── GoalTrashDialog ──────────────────────────────────────────────────────────
// Een doel weggooien betekent vaak dat het werk eronder ook niet meer hoeft.
// Maar niet altijd — daarom vraagt de app het, per taak. Standaard blijft alles
// staan: niets verdwijnt omdat je te snel op enter drukte.

export type TaskKeuze = 'houden' | 'klaar' | 'weg'

export function GoalTrashDialog({ goal, linked, projects, onConfirm, onCancel }: {
  goal: Goal
  linked: LinkedTask[]
  projects: Project[]
  onConfirm: (keuzes: Record<number, TaskKeuze>) => void
  onCancel: () => void
}) {
  const [keuzes, setKeuzes] = useState<Record<number, TaskKeuze>>({})
  const kies = (id: number, k: TaskKeuze) => setKeuzes(p => ({ ...p, [id]: k }))
  const keuzeVan = (id: number): TaskKeuze => keuzes[id] ?? 'houden'

  const teDoen = linked.filter(l => keuzeVan(l.task.id) !== 'houden').length

  return (
    <div onClick={onCancel}
      style={{ position:'fixed', inset:0, zIndex:9200, background:'rgba(0,0,0,.6)', backdropFilter:'blur(3px)',
        display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:60, overflowY:'auto' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Doel weggooien"
        style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, width:'min(560px, 94vw)',
          boxShadow:'0 20px 60px rgba(0,0,0,.6)', overflow:'hidden' }}>

        <div style={{ padding:'16px 18px 12px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:10, color:'#f87171', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>🗑 Doel naar de prullenbak</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', lineHeight:1.4 }}>{goal.text}</div>
          <div style={{ fontSize:11.5, color:'var(--muted)', marginTop:8, lineHeight:1.6 }}>
            {linked.length === 1
              ? 'Er staat nog één taak die hierbij lijkt te horen. Moet die nog gebeuren?'
              : `Er staan nog ${linked.length} taken die hierbij lijken te horen. Moeten die nog gebeuren?`}
          </div>
        </div>

        <div style={{ padding:'12px 18px', maxHeight:'46vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
          {linked.map(({ task, reason }) => {
            const proj = task.proj_id ? projects.find(p => p.id === task.proj_id) : null
            const keuze = keuzeVan(task.id)
            return (
              <div key={task.id} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 11px' }}>
                <div style={{ fontSize:12.5, color:'var(--text)', lineHeight:1.4 }}>{task.name}</div>
                <div style={{ fontSize:10, color:'var(--dim)', marginTop:3 }}>
                  {proj ? `${proj.emoji} ${proj.name.split('—')[0].trim()} · ` : '📥 inbox · '}{reason}
                </div>
                <div style={{ display:'flex', gap:5, marginTop:7 }}>
                  {([
                    ['houden', 'Blijft staan', '#64748b'],
                    ['klaar',  '✓ Was al klaar', '#3fb950'],
                    ['weg',    '🗑 Mag weg',     '#f85149'],
                  ] as [TaskKeuze, string, string][]).map(([k, label, kleur]) => (
                    <button key={k} onClick={() => kies(task.id, k)}
                      aria-label={`${label}: ${task.name}`}
                      style={{ fontSize:10.5, fontWeight:600, padding:'3px 9px', borderRadius:6, cursor:'pointer',
                        border:`1px solid ${keuze === k ? kleur : 'var(--border)'}`,
                        background: keuze === k ? `${kleur}22` : 'transparent',
                        color: keuze === k ? kleur : 'var(--dim)' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding:'12px 18px 16px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:10.5, color:'var(--dim)' }}>
            {teDoen === 0 ? 'Alle taken blijven staan' : `${teDoen} ${teDoen === 1 ? 'taak wordt' : 'taken worden'} bijgewerkt`}
          </span>
          <button onClick={onCancel}
            style={{ marginLeft:'auto', fontSize:12, padding:'7px 14px', borderRadius:7, cursor:'pointer',
              background:'transparent', border:'1px solid var(--border)', color:'var(--muted)' }}>
            Annuleren
          </button>
          <button onClick={() => onConfirm(keuzes)}
            style={{ fontSize:12, fontWeight:600, padding:'7px 16px', borderRadius:7, cursor:'pointer',
              background:'rgba(248,81,73,.18)', border:'1px solid rgba(248,81,73,.45)', color:'#f87171' }}>
            Doel weggooien
          </button>
        </div>
      </div>
    </div>
  )
}

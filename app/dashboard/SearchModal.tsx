'use client'
import { useState, useEffect } from 'react'
import type { Task, Project, Category, WeekItem, Achievement, Goal } from '@/lib/types'

export function SearchModal({ tasks, projects, categories, weekItems, achievements, goals, onClose, onTaskClick, onProjectClick, onTabSwitch }: {
  tasks: Task[]
  projects: Project[]
  categories: Category[]
  weekItems: WeekItem[]
  achievements: Achievement[]
  goals: Goal[]
  onClose: () => void
  onTaskClick: (t: Task) => void
  onProjectClick: (p: Project) => void
  onTabSwitch: (tab: string) => void
}) {
  const [q,   setQ]   = useState('')
  const [sel, setSel] = useState(0)

  const qLow = q.toLowerCase().trim()
  type Result = { id:string; icon:string; label:string; sub:string; badge:string; action:()=>void }

  const results: Result[] = qLow.length < 2 ? [] : [
    ...tasks.filter(t => t.name.toLowerCase().includes(qLow) && t.status !== 'done').slice(0, 4).map(t => ({
      id:`task-${t.id}`, icon: t.urgent ? '🔴' : '○', label: t.name,
      sub: projects.find(p => p.id === t.proj_id)?.name.split('—')[0].trim() ?? '',
      badge:'✅ Taak', action: () => onTaskClick(t),
    })),
    ...projects.filter(p => p.name.toLowerCase().includes(qLow)).slice(0, 3).map(p => ({
      id:`proj-${p.id}`, icon: p.emoji ?? '🗂', label: p.name.split('—')[0].trim(),
      sub: categories.find(c => c.id === p.cat_id)?.name ?? '',
      badge:'🗂 Project', action: () => onProjectClick(p),
    })),
    ...weekItems.filter(w => !w.done && w.text.toLowerCase().includes(qLow)).slice(0, 3).map(w => ({
      id:`week-${w.id}`, icon:'📅', label: w.text, sub: w.date,
      badge:'📅 Week', action: () => onTabSwitch('week'),
    })),
    ...goals.filter(g => g.text.toLowerCase().includes(qLow)).slice(0, 2).map(g => ({
      id:`goal-${g.id}`, icon: g.done ? '✅' : '🎯', label: g.text, sub: g.horizon,
      badge:'🎯 Doel', action: () => onTabSwitch('goals'),
    })),
    ...achievements.filter(a => a.text.toLowerCase().includes(qLow)).slice(0, 2).map(a => ({
      id:`ach-${a.id}`, icon: a.emoji ?? '⭐', label: a.text, sub: a.date,
      badge:'🏆', action: () => onTabSwitch('achievements'),
    })),
  ]

  useEffect(() => { setSel(0) }, [q])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && results[sel]) { results[sel].action(); onClose() }
    else if (e.key === 'Escape') onClose()
  }

  const quickLinks = [
    { icon:'📅', label:'Week',         tab:'week' },
    { icon:'🗓', label:'Maand',        tab:'month' },
    { icon:'✅', label:'Taken',        tab:'tasks' },
    { icon:'🎯', label:'Doelen',       tab:'goals' },
    { icon:'🏆', label:'Achievements', tab:'achievements' },
    { icon:'🌟', label:'Visie',        tab:'visie' },
    { icon:'⚙️', label:'Overige',      tab:'overige' },
  ]

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9500, background:'rgba(0,0,0,.65)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80, backdropFilter:'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:580, background:'#0d1117', border:'1px solid rgba(99,102,241,.4)', borderRadius:14, boxShadow:'0 32px 80px rgba(0,0,0,.9)', overflow:'hidden' }}>
        {/* Input */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
          <span style={{ fontSize:16 }}>🔍</span>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Zoek taken, projecten, doelen, achievements…"
            style={{ flex:1, background:'none', border:'none', color:'#e2e8f0', fontSize:14, outline:'none', fontFamily:'inherit' }} />
          <kbd style={{ fontSize:10, color:'#374151', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:4, padding:'2px 6px', flexShrink:0 }}>Esc</kbd>
        </div>

        {/* Results / quick links */}
        {results.length > 0 ? (
          <div style={{ maxHeight:420, overflowY:'auto' }}>
            {results.map((r, i) => (
              <div key={r.id} onClick={() => { r.action(); onClose() }}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', cursor:'pointer',
                  background: i === sel ? 'rgba(99,102,241,.12)' : 'transparent',
                  borderLeft: `2px solid ${i === sel ? '#6366f1' : 'transparent'}`,
                  transition:'background .08s' }}
                onMouseEnter={() => setSel(i)}>
                <span style={{ fontSize:16, flexShrink:0, width:24, textAlign:'center' }}>{r.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.label}</div>
                  {r.sub && <div style={{ fontSize:11, color:'#64748b', marginTop:1 }}>{r.sub}</div>}
                </div>
                <span style={{ fontSize:10, color:'#4b5563', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:4, padding:'1px 7px', flexShrink:0, whiteSpace:'nowrap' }}>
                  {r.badge}
                </span>
              </div>
            ))}
          </div>
        ) : qLow.length >= 2 ? (
          <div style={{ padding:'36px 16px', textAlign:'center', color:'#4b5563', fontSize:13 }}>
            Geen resultaten voor &ldquo;{q}&rdquo;
          </div>
        ) : (
          <div style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.6px', textTransform:'uppercase', color:'#374151', marginBottom:10 }}>Snelle navigatie</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {quickLinks.map(item => (
                <button key={item.tab} onClick={() => { onTabSwitch(item.tab); onClose() }}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:6, cursor:'pointer', color:'var(--muted,#64748b)', fontSize:12, fontWeight:500 }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='rgba(99,102,241,.4)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,255,255,.08)'}>
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding:'7px 16px', borderTop:'1px solid rgba(255,255,255,.05)', display:'flex', gap:14, fontSize:10, color:'#374151' }}>
          <span>↑↓ navigeren</span><span>↵ openen</span><span>Esc sluiten</span>
        </div>
      </div>
    </div>
  )
}

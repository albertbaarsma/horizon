'use client'
import { useState } from 'react'
import type { Project, WeekItem } from '@/lib/types'
import { parseQuickAdd, describeParsed } from '@/lib/parse-quick-add'

export function QuickAddModal({ todayStr, projects, onAdd, onAddInbox, onClose }: {
  todayStr: string
  projects: Project[]
  onAdd: (text: string, type: WeekItem['type'], projId: string | null) => void
  onAddInbox: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [type, setType] = useState<WeekItem['type']>('task')
  const [proj, setProj] = useState('')

  const hint = text.trim() ? describeParsed(parseQuickAdd(text, todayStr), todayStr) : null

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9400, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:140, backdropFilter:'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:480, background:'#0d1117', border:'1px solid rgba(99,102,241,.35)', borderRadius:12, boxShadow:'0 24px 64px rgba(0,0,0,.8)', overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', background:'rgba(99,102,241,.07)', borderBottom:'1px solid rgba(255,255,255,.06)', fontSize:11, color:'#818cf8', fontWeight:600 }}>
          ＋ Snel toevoegen · {hint ? hint.replace('→ ', '') : `vandaag ${todayStr}`}
        </div>
        <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
          <input autoFocus value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && text.trim()) { onAdd(text.trim(), type, proj || null) }
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Bijv. 'morgen 15:00 tandarts' of 'vr pianoles'"
            style={{ background:'#080d17', border:'1px solid rgba(99,102,241,.3)', color:'#e2e8f0', borderRadius:7, padding:'9px 12px', fontSize:14, outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' }} />
          <div style={{ display:'flex', gap:8 }}>
            <select value={type} onChange={e => setType(e.target.value as WeekItem['type'])}
              style={{ fontSize:12, background:'#161b22', border:'1px solid #30363d', color:'#8b949e', borderRadius:6, padding:'6px 8px', cursor:'pointer' }}>
              <option value="task">○ Taak</option>
              <option value="cal">📅 Afspraak</option>
              <option value="sport">💪 Sport</option>
              <option value="kids">👧 Kinderen</option>
              <option value="urgent">🔴 Urgent</option>
            </select>
            <select value={proj} onChange={e => setProj(e.target.value)}
              style={{ flex:1, fontSize:12, background:'#161b22', border:'1px solid #30363d', color:'#8b949e', borderRadius:6, padding:'6px 8px', cursor:'pointer' }}>
              <option value="">— geen project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name.split('—')[0].trim()}</option>)}
            </select>
            <button onClick={() => { if (text.trim()) onAdd(text.trim(), type, proj || null) }} disabled={!text.trim()}
              style={{ padding:'6px 18px', background:text.trim()?'rgba(99,102,241,.3)':'rgba(255,255,255,.05)', border:`1px solid ${text.trim()?'#6366f1':'rgba(255,255,255,.08)'}`, color:text.trim()?'#a5b4fc':'#374151', borderRadius:6, fontSize:12, fontWeight:600, cursor:text.trim()?'pointer':'default', flexShrink:0 }}>
              ＋
            </button>
            <button onClick={() => { if (text.trim()) onAddInbox(text.trim()) }} disabled={!text.trim()}
              title="Als taak naar de inbox — project en datum kies je later"
              style={{ padding:'6px 12px', background:text.trim()?'rgba(180,83,9,.18)':'rgba(255,255,255,.05)', border:`1px solid ${text.trim()?'rgba(180,83,9,.45)':'rgba(255,255,255,.08)'}`, color:text.trim()?'#fbbf24':'#374151', borderRadius:6, fontSize:12, fontWeight:600, cursor:text.trim()?'pointer':'default', flexShrink:0 }}>
              📥
            </button>
          </div>
          <div style={{ fontSize:10, color:'#374151' }}>↵ vandaag toevoegen · 📥 naar inbox · Esc sluiten · N opnieuw openen</div>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import type { RecurringTask } from '@/lib/types'

export const DAYS_NL_FULL = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag']
export const DAYS_EN_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

export function RecurringTaskModal({ allTasks, categories, onToggle, onDelete, onCreate, onConvertToTask, onClose }: {
  allTasks: RecurringTask[]
  categories: { id:string; name:string }[]
  onToggle: (id:number) => void
  onDelete: (id:number) => void
  onCreate: (name:string, type:RecurringTask['type'], days:string[], catId:string|null) => void
  /** Zet deze herhaling om in een losse taak: herhaling gaat uit (niet weg), er komt een losse taak voor terug. */
  onConvertToTask?: (rt: RecurringTask) => void
  onClose: () => void
}) {
  const [name,   setName]   = useState('')
  const [type,   setType]   = useState<RecurringTask['type']>('task')
  const [days,   setDays]   = useState<string[]>([])
  const [catId,  setCatId]  = useState('')
  const [saving, setSaving] = useState(false)

  function toggleDay(d: string) { setDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev,d]) }

  async function submit() {
    if (!name.trim() || days.length === 0) return
    setSaving(true)
    await onCreate(name.trim(), type, days, catId || null)
    setName(''); setDays([]); setCatId(''); setSaving(false)
  }

  const grouped = categories.reduce<Record<string, RecurringTask[]>>((acc, cat) => {
    const tasks = allTasks.filter(t => t.cat_id === cat.id)
    if (tasks.length) acc[cat.name] = tasks
    return acc
  }, {})
  const unlinked = allTasks.filter(t => !t.cat_id)

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9100, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'flex-start', justifyContent:'center', backdropFilter:'blur(3px)', paddingTop:60, overflowY:'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: typeof window !== 'undefined' ? Math.min(520, window.innerWidth - 24) : 520, background:'#0d1117', border:'1px solid rgba(99,102,241,.35)', borderRadius:16, boxShadow:'0 32px 80px rgba(0,0,0,.8)', overflow:'hidden', marginBottom:40 }}>

        {/* Header */}
        <div style={{ padding:'14px 18px', background:'rgba(99,102,241,.08)', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'#6366f1' }}>Weekplanning</div>
            <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>↻ Herhaaltaken beheren</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', color:'#94a3b8', cursor:'pointer', fontSize:15, padding:'5px 9px', borderRadius:7 }}>✕</button>
        </div>

        {/* Existing tasks */}
        <div style={{ padding:'14px 18px', maxHeight:340, overflowY:'auto' }}>
          {[...Object.entries(grouped), ...(unlinked.length ? [['Zonder categorie', unlinked] as [string, RecurringTask[]]] : [])].map(([catName, tasks]) => (
            <div key={catName} style={{ marginBottom:14 }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'var(--dim)', marginBottom:5 }}>{catName}</div>
              {tasks.map(rt => (
                <div key={rt.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', marginBottom:4, background: rt.active ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.01)', border:`1px solid ${rt.active?'rgba(255,255,255,.09)':'rgba(255,255,255,.04)'}`, borderRadius:7, opacity: rt.active ? 1 : 0.45 }}>
                  <span style={{ fontSize:13, flexShrink:0 }}>{rt.active ? '↻' : '○'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color: rt.active ? '#e2e8f0' : '#64748b' }}>{rt.name}</div>
                    <div style={{ fontSize:9, color:'#4b5563', marginTop:1 }}>
                      {rt.days.map(d => DAYS_NL_FULL[DAYS_EN_KEYS.indexOf(d)]?.slice(0,2)).join(' · ')}
                    </div>
                  </div>
                  <button onClick={() => onToggle(rt.id)} title={rt.active ? 'Deactiveren' : 'Activeren'}
                    style={{ fontSize:11, padding:'2px 8px', background: rt.active ? 'rgba(74,222,128,.1)' : 'rgba(255,255,255,.06)', border:`1px solid ${rt.active?'rgba(74,222,128,.3)':'rgba(255,255,255,.1)'}`, color: rt.active ? '#4ade80' : '#64748b', borderRadius:4, cursor:'pointer' }}>
                    {rt.active ? 'aan' : 'uit'}
                  </button>
                  {onConvertToTask && (
                    <button onClick={() => onConvertToTask(rt)} title="Omzetten naar een losse taak — herhaling gaat uit, blijft terug te zetten"
                      style={{ fontSize:11, padding:'2px 8px', background:'rgba(129,140,248,.1)', border:'1px solid rgba(129,140,248,.3)', color:'#818cf8', borderRadius:4, cursor:'pointer' }}>
                      → taak
                    </button>
                  )}
                  <button onClick={() => onDelete(rt.id)} title="Verwijder"
                    style={{ fontSize:14, padding:'2px 6px', background:'none', border:'1px solid rgba(248,81,73,.2)', color:'#64748b', borderRadius:4, cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.color='#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color='#64748b'}>×</button>
                </div>
              ))}
            </div>
          ))}
          {allTasks.length === 0 && <div style={{ fontSize:12, color:'var(--dim)', textAlign:'center', padding:'20px 0' }}>Nog geen herhaaltaken</div>}
        </div>

        {/* Add new */}
        <div style={{ padding:'14px 18px', borderTop:'1px solid rgba(255,255,255,.07)', background:'rgba(255,255,255,.02)' }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'#6366f1', marginBottom:10 }}>Nieuwe herhaaltaak</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Naam van de taak…"
            style={{ width:'100%', boxSizing:'border-box', background:'#0a1020', border:'1px solid rgba(99,102,241,.3)', color:'#e2e8f0', borderRadius:6, padding:'7px 10px', fontSize:12, fontFamily:'inherit', outline:'none', marginBottom:8 }} />
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <select value={type} onChange={e => setType(e.target.value as RecurringTask['type'])}
              style={{ fontSize:11, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:4, padding:'4px 6px' }}>
              <option value="task">○ Taak</option>
              <option value="sport">💪 Sport</option>
              <option value="cal">📅 Afspraak</option>
              <option value="kids">👧 Kinderen</option>
              <option value="urgent">🔴 Urgent</option>
            </select>
            <select value={catId} onChange={e => setCatId(e.target.value)}
              style={{ flex:1, fontSize:11, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:4, padding:'4px 6px' }}>
              <option value="">— geen categorie —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
            {DAYS_EN_KEYS.map((d, i) => (
              <button key={d} onClick={() => toggleDay(d)}
                style={{ padding:'4px 9px', fontSize:10, fontWeight:600, borderRadius:5, cursor:'pointer', transition:'all .15s',
                  background: days.includes(d) ? 'rgba(99,102,241,.25)' : 'var(--bg3)',
                  border: `1px solid ${days.includes(d) ? '#6366f1' : 'var(--border)'}`,
                  color: days.includes(d) ? '#a5b4fc' : 'var(--dim)' }}>
                {DAYS_NL_FULL[i].slice(0,2)}
              </button>
            ))}
          </div>
          <button onClick={submit} disabled={!name.trim() || days.length === 0 || saving}
            style={{ width:'100%', padding:'8px', background: name.trim()&&days.length ? 'rgba(99,102,241,.25)' : 'rgba(255,255,255,.04)', border:`1px solid ${name.trim()&&days.length?'#6366f1':'var(--border)'}`, color: name.trim()&&days.length ? '#a5b4fc' : 'var(--dim)', borderRadius:7, fontSize:12, fontWeight:600, cursor: name.trim()&&days.length ? 'pointer' : 'default' }}>
            {saving ? 'Opslaan…' : '＋ Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

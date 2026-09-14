'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Achievement, Category } from '@/lib/types'
import { CAT_COLORS, categoryColorMap } from '@/lib/category-colors'
import { categoryIcon } from '@/lib/xp'

/** Wins — een linker sidebarkolom per levensgebied op desktop (zelfde chrome
 *  als het hoofdmenu); op mobiel een horizontale pillenrij i.p.v. een aparte
 *  menukolom (zelfde conversie als VisiTab). */
export function AchievementsTab({ achievements, categories, userId, onAdd }: {
  achievements: Achievement[]
  categories: Category[]
  userId: string
  onAdd: (a: Achievement) => void
}) {
  const supabase = createClient()
  const [filterCat, setFilterCat] = useState('all')
  const [showAdd,   setShowAdd]   = useState(false)
  const [newText,   setNewText]   = useState('')
  const [newEmoji,  setNewEmoji]  = useState('⭐')
  const [newCatId,  setNewCatId]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [isMobile,  setIsMobile]  = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const filtered = filterCat === 'all' ? achievements : achievements.filter(a => a.cat_id === filterCat)

  const months: { key: string; label: string; items: Achievement[] }[] = []
  for (const a of filtered) {
    const key = a.date.slice(0, 7)
    let m = months.find(x => x.key === key)
    if (!m) {
      const d = new Date(key + '-15')
      const label = d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
      m = { key, label, items: [] }
      months.push(m)
    }
    m.items.push(a)
  }

  async function addAchievement() {
    if (!newText.trim()) return
    setSaving(true)
    const { data } = await supabase.from('achievements').insert({
      user_id: userId,
      text: newText.trim(),
      emoji: newEmoji,
      cat_id: newCatId || null,
      date: new Date().toISOString().slice(0, 10),
    }).select().single()
    if (data) onAdd(data as Achievement)
    setNewText(''); setNewEmoji('⭐'); setNewCatId(''); setShowAdd(false); setSaving(false)
  }

  // Kleur per categorie op de volledige, ongefilterde lijst — zo krijgt een
  // categorie hier dezelfde kleur als in Inzicht en Visie.
  const colorMap = useMemo(() => categoryColorMap(categories), [categories])
  const catsWithAchievements = categories.filter(c => achievements.some(a => a.cat_id === c.id))

  return (
    <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', height:'100%' }}>
      {/* Levensgebieden: sidebar op desktop, horizontale pillenrij op mobiel
          (zelfde conversie als VisiTab — een aparte linker menukolom is op
          een telefoon overbodige clutter). */}
      {isMobile ? (
        <div style={{ flexShrink:0, overflowX:'auto', padding:'8px 12px', display:'flex', gap:6, scrollbarWidth:'none', borderBottom:'1px solid var(--border)' }}>
          <button onClick={() => setFilterCat('all')}
            style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500,
              border:`1px solid ${filterCat==='all' ? 'rgba(99,102,241,.5)' : 'var(--border)'}`,
              color: filterCat==='all' ? '#818cf8' : 'var(--muted)',
              background: filterCat==='all' ? 'rgba(99,102,241,0.12)' : 'var(--bg)' }}>
            🏆 Alles <span style={{ fontSize:10, opacity:.7 }}>{achievements.length}</span>
          </button>
          {catsWithAchievements.map(c => {
            const count = achievements.filter(a => a.cat_id === c.id).length
            const active = filterCat === c.id
            return (
              <button key={c.id} onClick={() => setFilterCat(active ? 'all' : c.id)}
                style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500,
                  border:`1px solid ${active ? 'rgba(99,102,241,.5)' : 'var(--border)'}`,
                  color: active ? '#818cf8' : 'var(--muted)',
                  background: active ? 'rgba(99,102,241,0.12)' : 'var(--bg)' }}>
                {categoryIcon(c.name)} {c.name} <span style={{ fontSize:10, opacity:.7 }}>{count}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{ width:188, flexShrink:0, background:'var(--bg2)', borderRight:'1px solid var(--border)', overflowY:'auto', padding:'6px 0' }}>
          <div style={{ padding:'8px 12px 4px', fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'var(--dim)' }}>Levensgebied</div>
          <div onClick={() => setFilterCat('all')} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:500,
            color: filterCat==='all' ? 'var(--text)' : 'var(--muted)',
            borderLeft: `2px solid ${filterCat==='all' ? '#6366f1' : 'transparent'}`,
            background: filterCat==='all' ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
            <span style={{ width:18, height:18, borderRadius:'50%', background:'rgba(255,255,255,.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0 }}>🏆</span>
            <span style={{ flex:1 }}>Alles</span>
            <span style={{ fontSize:10, background:'var(--bg)', border:'1px solid var(--border)', padding:'1px 5px', borderRadius:6, color:'var(--dim)' }}>{achievements.length}</span>
          </div>
          {catsWithAchievements.map(c => {
            const color = colorMap.get(c.id) ?? CAT_COLORS[0]
            const count = achievements.filter(a => a.cat_id === c.id).length
            const active = filterCat === c.id
            return (
              <div key={c.id} onClick={() => setFilterCat(active ? 'all' : c.id)} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:500,
                color: active ? 'var(--text)' : 'var(--muted)',
                borderLeft: `2px solid ${active ? '#6366f1' : 'transparent'}`,
                background: active ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                <span style={{ width:18, height:18, borderRadius:'50%', background:`${color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0 }}>{categoryIcon(c.name)}</span>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                <span style={{ fontSize:10, background:'var(--bg)', border:'1px solid var(--border)', padding:'1px 5px', borderRadius:6, color:'var(--dim)' }}>{count}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        <div style={{ maxWidth:720 }}>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
            <button onClick={() => setShowAdd(s => !s)} style={{ fontSize:11, padding:'5px 12px', borderRadius:6, cursor:'pointer', background:showAdd?'rgba(99,102,241,.15)':'var(--bg3)', border:'1px solid var(--border)', color:showAdd?'#818cf8':'var(--muted)', fontWeight:600, flexShrink:0 }}>
              {showAdd ? '✕ Annuleer' : '+ Achievement'}
            </button>
          </div>

          {/* Add form */}
          {showAdd && (
            <div style={{ marginBottom:16, padding:14, background:'var(--bg2)', border:'1px solid rgba(99,102,241,.3)', borderRadius:8, display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'flex', gap:8 }}>
                <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} maxLength={2}
                  style={{ width:44, textAlign:'center', fontSize:18, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 4px', color:'var(--text)', outline:'none' }} />
                <input value={newText} onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addAchievement() }}
                  placeholder="Beschrijf je achievement…"
                  style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, padding:'7px 10px', fontSize:13, color:'var(--text)', outline:'none', fontFamily:'inherit' }} />
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <select value={newCatId} onChange={e => setNewCatId(e.target.value)}
                  style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 8px', fontSize:12, color:'var(--text)', outline:'none' }}>
                  <option value="">Geen categorie</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={addAchievement} disabled={!newText.trim() || saving}
                  style={{ padding:'6px 16px', borderRadius:6, border:'none', background:newText.trim()&&!saving?'#6366f1':'var(--bg4)', color:'#fff', fontSize:12, fontWeight:600, cursor:newText.trim()&&!saving?'pointer':'default', flexShrink:0 }}>
                  {saving ? '…' : 'Toevoegen'}
                </button>
              </div>
            </div>
          )}

          {months.length === 0 && (
            <div style={{ textAlign:'center', padding:48, color:'var(--muted)', fontSize:13 }}>
              {filterCat === 'all' ? 'Nog geen achievements. Voeg er een toe!' : 'Geen achievements in deze categorie.'}
            </div>
          )}

          {months.map(({ key, label, items }) => (
            <div key={key} style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 }}>{label}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {items.map(a => {
                  const cat = a.cat_id ? categories.find(c => c.id === a.cat_id) : null
                  return (
                    <div key={a.id} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:7 }}>
                      <span style={{ fontSize:22, flexShrink:0, lineHeight:1.3 }}>{a.emoji || '⭐'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.4 }}>{a.text}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                          <span style={{ fontSize:10, color:'var(--muted)' }}>{a.date}</span>
                          {cat && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(129,140,248,.08)', border:'1px solid rgba(129,140,248,.2)', color:'#818cf8' }}>{cat.name}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

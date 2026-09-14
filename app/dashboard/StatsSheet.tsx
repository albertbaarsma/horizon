'use client'
import { useMemo } from 'react'
import type { XpEvent, Category } from '@/lib/types'
import {
  levelProgress, levelTitle, skillLevelForXp, skillProgress,
  categoryIcon, computeStreaks, XP_SOURCE_META,
} from '@/lib/xp'
import { SkillTree } from './SkillTree'

export function StatsSheet({
  events, categories, onClose,
}: {
  events: XpEvent[]
  categories: Category[]
  onClose: () => void
}) {
  const stats = useMemo(() => {
    const totalXp = events.reduce((s, e) => s + e.amount, 0)
    const prog    = levelProgress(totalXp)
    const streak  = computeStreaks(events.map(e => e.created_at))

    const weekAgo = Date.now() - 7 * 86400000
    const xpWeek  = events.filter(e => new Date(e.created_at).getTime() >= weekAgo).reduce((s, e) => s + e.amount, 0)

    // Per bron
    const bySource = new Map<string, { xp: number; count: number }>()
    for (const e of events) {
      const cur = bySource.get(e.source) ?? { xp: 0, count: 0 }
      cur.xp += e.amount; cur.count += 1
      bySource.set(e.source, cur)
    }
    const sources = [...bySource.entries()]
      .map(([key, v]) => ({ meta: XP_SOURCE_META[key] ?? XP_SOURCE_META.manual, ...v }))
      .sort((a, b) => b.xp - a.xp)

    // Skills (categorieën met eigen level)
    const catXp = new Map<string, number>()
    for (const e of events) if (e.cat_id) catXp.set(e.cat_id, (catXp.get(e.cat_id) ?? 0) + e.amount)
    const skills = categories.map(c => {
      const xp = catXp.get(c.id) ?? 0
      return { id: c.id, name: c.name, icon: categoryIcon(c.name), xp, ...skillProgress(xp), level: skillLevelForXp(xp) }
    }).sort((a, b) => b.xp - a.xp)
    const overig = events.filter(e => !e.cat_id).reduce((s, e) => s + e.amount, 0)

    // 14-daagse activiteit
    const days: { label: string; xp: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const xp = events.filter(e => e.created_at.slice(0, 10) === key).reduce((s, e) => s + e.amount, 0)
      days.push({ label: key, xp })
    }
    const maxDay = Math.max(1, ...days.map(d => d.xp))

    return { totalXp, prog, streak, xpWeek, sources, skills, overig, days, maxDay,
             counts: {
               task: bySource.get('task')?.count ?? 0,
               achievement: bySource.get('achievement')?.count ?? 0,
               goal: bySource.get('goal')?.count ?? 0,
             } }
  }, [events, categories])

  const { prog, streak } = stats

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:9700, background:'rgba(3,5,12,.78)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'clamp(12px,4vh,48px) 16px', overflowY:'auto' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width:'min(660px, 100%)', background:'#0b0f1a', border:'1px solid rgba(99,102,241,.28)', borderRadius:18, boxShadow:'0 40px 100px rgba(0,0,0,.7)', overflow:'hidden', animation:'bubbleIn .26s cubic-bezier(.34,1.56,.64,1)' }}>

        {/* Header */}
        <div style={{ padding:'22px 24px', background:'linear-gradient(135deg,rgba(124,58,237,.28),rgba(11,15,26,.92))', borderBottom:'1px solid rgba(99,102,241,.18)', display:'flex', alignItems:'center', gap:18 }}>
          <div style={{ width:66, height:66, borderRadius:'50%', flexShrink:0, background:`conic-gradient(#a855f7 ${prog.pct}%, rgba(255,255,255,.08) ${prog.pct}%)`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 26px rgba(139,92,246,.4)' }}>
            <div style={{ width:53, height:53, borderRadius:'50%', background:'#0d1117', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:19, fontWeight:900, color:'#e9d5ff', lineHeight:1 }}>{prog.level}</span>
              <span style={{ fontSize:7, color:'#818cf8', letterSpacing:'.5px' }}>LEVEL</span>
            </div>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:'#c4b5fd' }}>Statistieken</div>
            <div style={{ fontSize:22, fontWeight:900, color:'#f8fafc', lineHeight:1.15 }}>{levelTitle(prog.level)}</div>
            <div style={{ fontSize:12, color:'#94a3b8', fontVariantNumeric:'tabular-nums' }}>{stats.totalXp} XP · nog {prog.toNext} tot Lvl {prog.level + 1}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', color:'#94a3b8', cursor:'pointer', fontSize:15, padding:'5px 10px', borderRadius:8, flexShrink:0, alignSelf:'flex-start' }}>✕</button>
        </div>

        <div style={{ padding:'18px 24px 26px' }}>

          {/* Stat-tegels */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(112px,1fr))', gap:9, marginBottom:24 }}>
            <Tile icon="🔥" value={streak.current} label={`dagen streak${streak.current > 0 ? '' : ''}`} accent="#fb923c" />
            <Tile icon="🏅" value={streak.best}    label="langste streak" accent="#fbbf24" />
            <Tile icon="⚡" value={stats.xpWeek}    label="XP deze week" accent="#a855f7" />
            <Tile icon="✅" value={stats.counts.task}        label="taken af" accent="#4ade80" />
            <Tile icon="🏆" value={stats.counts.achievement} label="prestaties" accent="#fbbf24" />
            <Tile icon="🎯" value={stats.counts.goal}        label="doelen" accent="#818cf8" />
          </div>

          {/* Skills */}
          <SectionTitle>Skills — je levensgebieden</SectionTitle>
          {stats.skills.length === 0 ? (
            <Empty>Nog geen categorieën met XP. Koppel je doelen en projecten aan levensgebieden.</Empty>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:10, marginBottom:24 }}>
              {stats.skills.map(sk => (
                <div key={sk.id} style={{ padding:'13px 14px', borderRadius:12, background:'rgba(99,102,241,.05)', border:'1px solid rgba(99,102,241,.16)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:9 }}>
                    <span style={{ fontSize:22, lineHeight:1 }}>{sk.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sk.name}</div>
                      <div style={{ fontSize:10, color:'#818cf8', fontWeight:600 }}>Level {sk.level} · {sk.xp} XP</div>
                    </div>
                  </div>
                  <div style={{ width:'100%', height:7, borderRadius:99, background:'rgba(255,255,255,.06)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${sk.pct}%`, background:'linear-gradient(90deg,#6366f1,#a855f7)', borderRadius:99, transition:'width .5s ease' }} />
                  </div>
                  <div style={{ fontSize:9, color:'#4b5563', marginTop:4, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                    nog {sk.toNext} tot Lvl {sk.level + 1}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Vrije skill-tree — uitklapbaar */}
          <SkillTree events={events} />

          {/* 14-daagse activiteit */}
          <SectionTitle>Activiteit — 14 dagen</SectionTitle>
          <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:76, marginBottom:6, padding:'0 2px' }}>
            {stats.days.map((d, i) => (
              <div key={i} title={`${d.label}: ${d.xp} XP`} style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', height:'100%' }}>
                <div style={{ height:`${Math.max(3, (d.xp / stats.maxDay) * 100)}%`, background: d.xp > 0 ? 'linear-gradient(180deg,#a855f7,#6366f1)' : 'rgba(255,255,255,.05)', borderRadius:4, minHeight:3 }} />
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#4b5563', marginBottom:24 }}>
            <span>14 dagen geleden</span><span>vandaag</span>
          </div>

          {/* XP per bron */}
          <SectionTitle>Waar je XP vandaan komt</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {stats.sources.map(s => {
              const pct = Math.round((s.xp / Math.max(1, stats.totalXp)) * 100)
              return (
                <div key={s.meta.key} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:15, width:20, textAlign:'center', flexShrink:0 }}>{s.meta.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                      <span style={{ color:'#cbd5e1' }}>{s.meta.label} <span style={{ color:'#4b5563' }}>· {s.count}×</span></span>
                      <span style={{ color:'#94a3b8', fontVariantNumeric:'tabular-nums' }}>{s.xp} XP · {pct}%</span>
                    </div>
                    <div style={{ width:'100%', height:6, borderRadius:99, background:'rgba(255,255,255,.06)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.max(3, pct)}%`, background:s.meta.color, borderRadius:99 }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Tile({ icon, value, label, accent }: { icon: string; value: number; label: string; accent: string }) {
  return (
    <div style={{ padding:'12px 10px', borderRadius:12, background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', textAlign:'center' }}>
      <div style={{ fontSize:17, marginBottom:2 }}>{icon}</div>
      <div style={{ fontSize:20, fontWeight:900, color:accent, lineHeight:1.1, fontVariantNumeric:'tabular-nums' }}>{value}</div>
      <div style={{ fontSize:10, color:'#64748b', marginTop:2, lineHeight:1.3 }}>{label}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:'#6366f1', marginBottom:11 }}>{children}</div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:12, color:'#475569', padding:'14px 0 22px', lineHeight:1.6 }}>{children}</div>
}

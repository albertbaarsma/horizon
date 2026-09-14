'use client'
import { useState, useMemo } from 'react'
import type { XpEvent, Category } from '@/lib/types'
import { levelProgress, levelTitle, FEATURES, isUnlocked, XP_AMOUNTS } from '@/lib/xp'
import { areasWithSkills, NO_AREA } from '@/lib/skills'

const SOURCE_ICON: Record<string, string> = {
  task: '✅', achievement: '🏆', goal: '🎯', tutorial: '🎓', manual: '✨',
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime()
  const s = Math.floor((Date.now() - d) / 1000)
  if (s < 60)     return 'net'
  if (s < 3600)   return `${Math.floor(s / 60)} min`
  if (s < 86400)  return `${Math.floor(s / 3600)} u`
  if (s < 604800) return `${Math.floor(s / 86400)} d`
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export function XpBar({
  events, categories, unlockedFeatures = [], compact = false, onMarkSeen, onReplayTour, onOpenStats,
}: {
  events: XpEvent[]
  categories: Category[]
  unlockedFeatures?: string[]
  compact?: boolean
  onMarkSeen?: () => void
  onReplayTour?: () => void
  onOpenStats?: () => void
}) {
  const [open, setOpen] = useState(false)

  const totalXp = useMemo(() => events.reduce((s, e) => s + e.amount, 0), [events])
  const prog    = useMemo(() => levelProgress(totalXp), [totalXp])
  const unseen  = useMemo(() => events.filter(e => !e.seen).length, [events])

  // XP per levenscategorie
  // Levensgebieden mét de vaardigheden die hun XP daaruit halen
  const areas = useMemo(() => areasWithSkills(events, categories), [events, categories])

  const maxAreaXp = areas[0]?.xp ?? 1

  function openPanel() {
    setOpen(true)
    if (unseen > 0) onMarkSeen?.()
  }

  return (
    <>
      {/* ── Compacte balk in de topbar ── */}
      <button onClick={openPanel} title={`Level ${prog.level} — ${levelTitle(prog.level)} · ${totalXp} XP`}
        style={{
          display:'flex', alignItems:'center', gap:7, background:'rgba(99,102,241,.1)',
          border:'1px solid rgba(99,102,241,.28)', borderRadius:8, cursor:'pointer',
          padding: compact ? '3px 7px' : '3px 10px', height:28, position:'relative', flexShrink:0,
        }}>
        <span style={{ fontSize:13, lineHeight:1 }}>⭐</span>
        <span style={{ fontSize:12, fontWeight:700, color:'#c7d2fe', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
          Lvl {prog.level}
        </span>
        {!compact && (
          <span style={{ width:44, height:6, borderRadius:99, background:'rgba(255,255,255,.09)', overflow:'hidden', flexShrink:0 }}>
            <span style={{ display:'block', height:'100%', width:`${prog.pct}%`, background:'linear-gradient(90deg,#6366f1,#a855f7)', borderRadius:99, transition:'width .4s ease' }} />
          </span>
        )}
        {unseen > 0 && (
          <span style={{ position:'absolute', top:-5, right:-5, minWidth:15, height:15, padding:'0 4px', borderRadius:99, background:'#f97316', color:'#fff', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 2px var(--bg2)' }}>
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {/* ── Slide-over paneel ── */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:9500, background:'rgba(0,0,0,.5)', display:'flex', justifyContent:'flex-end', animation:'bubbleIn .18s ease' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width:'min(400px, 100vw)', height:'100%', background:'#0b0f1a', borderLeft:'1px solid rgba(99,102,241,.3)', boxShadow:'-20px 0 60px rgba(0,0,0,.6)', display:'flex', flexDirection:'column', overflow:'hidden' }}>

            {/* Header met level-ring */}
            <div style={{ padding:'20px 20px 18px', background:'linear-gradient(135deg,rgba(99,102,241,.22),rgba(11,15,26,.9))', borderBottom:'1px solid rgba(99,102,241,.18)', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:'#818cf8' }}>Voortgang</div>
                <button onClick={() => setOpen(false)} style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', color:'#94a3b8', cursor:'pointer', fontSize:14, padding:'3px 8px', borderRadius:7 }}>✕</button>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:58, height:58, borderRadius:'50%', flexShrink:0, background:'conic-gradient(#a855f7 '+prog.pct+'%, rgba(255,255,255,.08) '+prog.pct+'%)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 22px rgba(139,92,246,.35)' }}>
                  <div style={{ width:46, height:46, borderRadius:'50%', background:'#0d1117', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:16, fontWeight:900, color:'#e9d5ff', lineHeight:1 }}>{prog.level}</span>
                    <span style={{ fontSize:7, color:'#818cf8', letterSpacing:'.5px' }}>LEVEL</span>
                  </div>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:'#f1f5f9' }}>{levelTitle(prog.level)}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginBottom:6, fontVariantNumeric:'tabular-nums' }}>
                    {prog.total} XP totaal · nog {prog.toNext} tot Lvl {prog.level + 1}
                  </div>
                  <div style={{ width:'100%', height:7, borderRadius:99, background:'rgba(255,255,255,.08)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${prog.pct}%`, background:'linear-gradient(90deg,#6366f1,#a855f7)', borderRadius:99, transition:'width .5s ease' }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'16px 18px 24px' }}>

              {/* Levensgebieden mét hun vaardigheden — ze horen bij elkaar */}
              {areas.length > 0 && (
                <section style={{ marginBottom:22 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:'#6366f1', marginBottom:10 }}>
                    Levensgebieden &amp; vaardigheden
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
                    {areas.map(a => (
                      <div key={a.id}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                          <span style={{ color:'#cbd5e1' }}>{a.name}</span>
                          <span style={{ color:'#818cf8', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{a.xp} XP</span>
                        </div>
                        <div style={{ width:'100%', height:6, borderRadius:99, background:'rgba(255,255,255,.06)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${Math.max(4, (a.xp / maxAreaXp) * 100)}%`, background: a.id === NO_AREA ? '#475569' : 'linear-gradient(90deg,#6366f1,#a855f7)', borderRadius:99 }} />
                        </div>

                        {/* vaardigheden die hun XP uit dit gebied halen */}
                        {a.skills.length > 0 && (
                          <div style={{ marginTop:7, marginLeft:10, paddingLeft:10, borderLeft:'1px solid rgba(168,85,247,.28)', display:'flex', flexDirection:'column', gap:6 }}>
                            {a.skills.map(sk => (
                              <div key={sk.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span style={{ fontSize:9, fontWeight:800, color:'#c4b5fd', background:'rgba(168,85,247,.14)', border:'1px solid rgba(168,85,247,.3)', borderRadius:6, padding:'1px 5px', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>
                                  {sk.level}
                                </span>
                                <span style={{ fontSize:11, color:'#e2e8f0', flexShrink:0, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sk.label}</span>
                                <div style={{ flex:1, height:4, borderRadius:99, background:'rgba(255,255,255,.06)', overflow:'hidden', minWidth:24 }}>
                                  <div style={{ height:'100%', width:`${Math.max(4, sk.pct)}%`, background:'linear-gradient(90deg,#a855f7,#d8b4fe)', borderRadius:99 }} />
                                </div>
                                <span style={{ fontSize:9, color:'#6b7280', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{sk.xp} XP</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {areas.every(a => a.skills.length === 0) && (
                    <div style={{ fontSize:10, color:'#475569', marginTop:9, lineHeight:1.5 }}>
                      Vaardigheden verschijnen hier onder hun levensgebied zodra je Horizon AI
                      vertelt wat je gedaan hebt — hij kent er dan XP aan toe.
                    </div>
                  )}
                </section>
              )}

              {/* Feature-ladder */}
              <section style={{ marginBottom:22 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:'#6366f1', marginBottom:10 }}>Features</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
                  {FEATURES.map(f => {
                    const on = isUnlocked(f, prog.level, unlockedFeatures)
                    return (
                      <div key={f.key} title={on ? f.desc : `Unlockt op level ${f.level}: ${f.desc}`}
                        style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 9px', borderRadius:8, border:`1px solid ${on ? 'rgba(99,102,241,.22)' : 'rgba(255,255,255,.06)'}`, background: on ? 'rgba(99,102,241,.06)' : 'rgba(255,255,255,.02)', opacity: on ? 1 : .5 }}>
                        <span style={{ fontSize:14, filter: on ? 'none' : 'grayscale(1)' }}>{on ? f.icon : '🔒'}</span>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:11, fontWeight:600, color: on ? '#e2e8f0' : '#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.label}</div>
                          {!on && <div style={{ fontSize:9, color:'#4b5563' }}>Lvl {f.level}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* XP-logboek */}
              <section>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:'#6366f1' }}>XP-logboek</div>
                  <div style={{ fontSize:10, color:'#4b5563' }}>{events.length} registraties</div>
                </div>
                {events.length === 0 ? (
                  <div style={{ fontSize:12, color:'#475569', textAlign:'center', padding:'20px 0' }}>
                    Nog geen XP. Voer een doel in of vink een taak af! 🎯
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {events.slice(0, 80).map(e => (
                      <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background: e.seen ? 'transparent' : 'rgba(249,115,22,.06)', border:`1px solid ${e.seen ? 'transparent' : 'rgba(249,115,22,.18)'}` }}>
                        <span style={{ fontSize:15, flexShrink:0 }}>{SOURCE_ICON[e.source] ?? '✨'}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, color:'#cbd5e1', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.reason}</div>
                          <div style={{ fontSize:10, color:'#4b5563' }}>{timeAgo(e.created_at)}</div>
                        </div>
                        <span style={{ fontSize:12, fontWeight:800, color:'#4ade80', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>+{e.amount}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {onOpenStats && (
                <button onClick={() => { setOpen(false); onOpenStats() }}
                  style={{ marginTop:20, width:'100%', padding:'11px', borderRadius:10, border:'1px solid rgba(99,102,241,.3)', background:'rgba(99,102,241,.1)', color:'#a5b4fc', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  📊 Volledige stats &amp; skills
                </button>
              )}
              {onReplayTour && (
                <button onClick={() => { setOpen(false); onReplayTour() }}
                  style={{ marginTop:8, width:'100%', padding:'9px', borderRadius:9, border:'1px solid var(--border)', background:'rgba(255,255,255,.03)', color:'#94a3b8', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                  🎓 Rondleiding opnieuw bekijken
                </button>
              )}
              <div style={{ marginTop:14, fontSize:10, color:'#374151', textAlign:'center', lineHeight:1.6 }}>
                +{XP_AMOUNTS.goal} XP per doel · +{XP_AMOUNTS.task} per taak (+{XP_AMOUNTS.taskUrgent - XP_AMOUNTS.task} urgent) · +{XP_AMOUNTS.achievement} per prestatie
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

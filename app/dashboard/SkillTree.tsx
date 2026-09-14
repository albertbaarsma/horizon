'use client'
import { useState } from 'react'
import type { XpEvent } from '@/lib/types'
import { skillsFromEvents } from '@/lib/skills'

/**
 * Vrije skill-tree: vaardigheden die ontstaan doordat de AI (of jij) XP toekent
 * bij prestaties — sociaal, IT, muziek, discipline… Staat naast de vaste
 * levensgebieden en is uitklapbaar, zodat het overzicht rustig blijft.
 */
export function SkillTree({ events }: { events: XpEvent[] }) {
  const [open, setOpen] = useState(false)
  const skills = skillsFromEvents(events)
  const topThree = skills.slice(0, 3)

  return (
    <div style={{ marginBottom:24 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:8, background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left' }}>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:'#a855f7' }}>
          🌳 Skill-tree — je vaardigheden
        </span>
        {skills.length > 0 && (
          <span style={{ fontSize:9, padding:'1px 7px', borderRadius:99, background:'rgba(168,85,247,.12)', border:'1px solid rgba(168,85,247,.3)', color:'#c4b5fd' }}>
            {skills.length}
          </span>
        )}
        {/* ingeklapt: gun je alvast een blik op je sterkste vaardigheden */}
        {!open && topThree.length > 0 && (
          <span style={{ fontSize:10, color:'#475569', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {topThree.map(s => `${s.label} ${s.level}`).join(' · ')}
          </span>
        )}
        <span style={{ marginLeft:'auto', fontSize:11, color:'#6b7280' }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div style={{ marginTop:12 }}>
          {skills.length === 0 ? (
            <div style={{ fontSize:12, color:'#475569', lineHeight:1.6, padding:'10px 0 4px' }}>
              Nog geen vaardigheden. Ze ontstaan van zelf: vertel Horizon AI wat je gedaan hebt,
              dan kent hij XP toe aan passende vaardigheden — en verzint nieuwe als er nog geen
              bestaat (sociaal, muziek, ondernemen…).
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {skills.map((sk, i) => {
                const isTop = i === 0
                return (
                  <div key={sk.name}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, background: isTop ? 'rgba(168,85,247,.07)' : 'rgba(255,255,255,.02)', border:`1px solid ${isTop ? 'rgba(168,85,247,.25)' : 'rgba(255,255,255,.06)'}` }}>
                    {/* level-badge */}
                    <div style={{ width:30, height:30, borderRadius:9, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(168,85,247,.12)', border:'1px solid rgba(168,85,247,.3)' }}>
                      <span style={{ fontSize:12, fontWeight:900, color:'#c4b5fd', lineHeight:1 }}>{sk.level}</span>
                      <span style={{ fontSize:6, color:'#8b7fc7', letterSpacing:'.04em' }}>LVL</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'baseline', gap:7 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sk.label}</span>
                        <span style={{ fontSize:10, color:'#6b7280', flexShrink:0 }}>{sk.xp} XP · {sk.count}×</span>
                      </div>
                      <div style={{ marginTop:5, height:5, borderRadius:99, background:'rgba(255,255,255,.06)', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.max(3, sk.pct)}%`, background:'linear-gradient(90deg,#a855f7,#d8b4fe)', borderRadius:99, transition:'width .4s ease' }} />
                      </div>
                    </div>
                    <span style={{ fontSize:9, color:'#4b5563', flexShrink:0, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                      nog {sk.toNext}<br />tot {sk.level + 1}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

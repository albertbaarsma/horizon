'use client'
import { useMemo, useState } from 'react'
import type { Finding, Verdict } from '@/lib/task-freshness'
import { VERDICT_META } from '@/lib/task-freshness'

// ─── TaskReviewPanel — de kaart bijwerken ─────────────────────────────────────
// Ik kan zien wélke taken verdacht zijn, maar niet of jij ze gedaan hebt. Dus:
// per taak het bewijs erbij, en één klik om af te vinken, weg te gooien of te
// laten staan. Wat je laat staan, vraagt niet nog een keer.

const ORDER: Verdict[] = ['klaar', 'mogelijk-klaar', 'herhaling', 'oud']

export function TaskReviewPanel({ findings, onMarkDone, onDelete, onIgnore, onClose }: {
  findings:   Finding[]
  onMarkDone: (id: number) => void
  onDelete:   (id: number) => void
  onIgnore:   (id: number) => void
  onClose:    () => void
}) {
  // 'Lang stil' is de grootste en zwakste groep — die blijft dicht tot je hem opent
  const [open, setOpen] = useState<Record<string, boolean>>({ klaar: true, 'mogelijk-klaar': true, herhaling: true, oud: false })

  const groups = useMemo(() => ORDER
    .map(v => ({ verdict: v, items: findings.filter(f => f.verdict === v) }))
    .filter(g => g.items.length > 0), [findings])

  return (
    <div role="complementary" aria-label="Kaart bijwerken"
      style={{ position:'absolute', top:0, left:0, bottom:0, width:400, maxWidth:'92%',
        background:'rgba(13,17,23,.97)', borderRight:'1px solid rgba(99,102,241,.25)',
        overflowY:'auto', padding:'18px 16px 28px', zIndex:45,
        display:'flex', flexDirection:'column', gap:14 }}>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>🧹 Kaart bijwerken</div>
          <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>
            {findings.length} {findings.length === 1 ? 'taak valt op' : 'taken vallen op'} — jij beslist
          </div>
        </div>
        <button onClick={onClose} aria-label="Bijwerken sluiten"
          style={{ background:'none', border:'none', color:'#64748b', fontSize:18, cursor:'pointer', padding:'0 4px', lineHeight:1 }}>×</button>
      </div>

      {findings.length === 0 && (
        <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          Niets meer om na te kijken — de kaart klopt met wat je hebt vastgelegd. ✨
        </div>
      )}

      {groups.map(g => {
        const meta = VERDICT_META[g.verdict]
        const isOpen = open[g.verdict]
        return (
          <div key={g.verdict} style={{ display:'flex', flexDirection:'column', gap:7 }}>
            <button onClick={() => setOpen(p => ({ ...p, [g.verdict]: !p[g.verdict] }))}
              style={{ display:'flex', alignItems:'center', gap:7, background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left' }}>
              <span style={{ color:'#475569', fontSize:10 }}>{isOpen ? '▾' : '▸'}</span>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'.4px', color: meta.color }}>{meta.label}</span>
              <span style={{ fontSize:10, color:'#475569' }}>({g.items.length})</span>
            </button>

            {isOpen && g.verdict === 'klaar' && g.items.length > 1 && (
              // Alleen bij hard bewijs een knop voor alles tegelijk
              <button onClick={() => g.items.forEach(f => onMarkDone(f.task.id))}
                style={{ alignSelf:'flex-start', fontSize:11, fontWeight:600, padding:'5px 10px', borderRadius:6,
                  border:'1px solid rgba(63,185,80,.4)', background:'rgba(63,185,80,.12)', color:'#3fb950', cursor:'pointer' }}>
                ✓ Alle {g.items.length} afvinken
              </button>
            )}

            {isOpen && g.items.map(f => (
              <div key={f.task.id}
                style={{ background:'rgba(255,255,255,.03)', border:`1px solid ${meta.color}22`, borderRadius:8, padding:'9px 10px', display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:12.5, color:'#e2e8f0', lineHeight:1.4 }}>{f.task.name}</div>
                <div style={{ fontSize:10.5, color:'#8b949e', lineHeight:1.5 }}>{f.reason}</div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  <button onClick={() => onMarkDone(f.task.id)} title="Was al klaar"
                    style={btn('#3fb950')}>✓ Klaar</button>
                  <button onClick={() => onDelete(f.task.id)} title="Weg ermee"
                    style={btn('#f85149')}>🗑 Weg</button>
                  <button onClick={() => onIgnore(f.task.id)} title="Klopt zo, laat staan"
                    style={btn('#64748b')}>Laat staan</button>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function btn(color: string): React.CSSProperties {
  return {
    fontSize:11, fontWeight:600, padding:'4px 9px', borderRadius:6,
    border:`1px solid ${color}44`, background:`${color}14`, color, cursor:'pointer',
  }
}

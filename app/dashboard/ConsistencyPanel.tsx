'use client'
import { useMemo, useState } from 'react'
import type { Issue, IssueKind, Item, ItemKind } from '@/lib/consistency'
import { ISSUE_META, KIND_LABEL, laatsteControleTekst } from '@/lib/consistency'

// ─── ConsistencyPanel — klopt alles nog met elkaar? ───────────────────────────
// Eén plek waar je ziet waar de tabs uit elkaar lopen, en het meteen rechtzet.
// Elke actie gaat naar de echte bron, dus alle tabs zien het direct.

export type FixAction = 'done' | 'delete'

const KIND_ICON: Record<ItemKind, string> = {
  goal: '🎯', project: '🗂', task: '○', week: '📅', recurring: '↻',
}

const ORDER: IssueKind[] = ['wees', 'staat-uit-elkaar', 'dubbel']

export function ConsistencyPanel({ issues, lastCheck, now, full = false, onFix, onIgnore, onMarkChecked, onClose }: {
  issues:  Issue[]
  lastCheck: string | null
  now: Date
  /** Als volle kolom in de tab (i.p.v. als paneel over de kaart heen). */
  full?: boolean
  onFix:   (kind: ItemKind, id: string, action: FixAction) => void
  onIgnore: (key: string) => void
  onMarkChecked: () => void
  onClose: () => void
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({ wees: true, 'staat-uit-elkaar': true, dubbel: true })

  const groups = useMemo(() => ORDER
    .map(k => ({ kind: k, items: issues.filter(i => i.kind === k) }))
    .filter(g => g.items.length > 0), [issues])

  const style: React.CSSProperties = full
    ? { position:'absolute', inset:0, overflowY:'auto', padding:'18px 20px 32px',
        display:'flex', flexDirection:'column', gap:14, maxWidth:820, margin:'0 auto' }
    : { position:'absolute', top:0, left:0, bottom:0, width:440, maxWidth:'94%',
        background:'rgba(13,17,23,.975)', borderRight:'1px solid rgba(99,102,241,.25)',
        overflowY:'auto', padding:'18px 16px 28px', zIndex:45,
        display:'flex', flexDirection:'column', gap:14 }

  return (
    <div role="complementary" aria-label="Controle" style={style}>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>🔍 Controle</div>
          <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>
            {laatsteControleTekst(lastCheck, now)} · {issues.length === 0 ? 'alles klopt' : `${issues.length} ${issues.length === 1 ? 'punt' : 'punten'}`}
          </div>
        </div>
        {!full && (
          <button onClick={onClose} aria-label="Controle sluiten"
            style={{ background:'none', border:'none', color:'#64748b', fontSize:18, cursor:'pointer', padding:'0 4px', lineHeight:1 }}>×</button>
        )}
      </div>

      {issues.length === 0 ? (
        <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          Doelen, projecten, taken en planning zeggen allemaal hetzelfde. ✨
        </div>
      ) : (
        <div style={{ fontSize:11, color:'#8b949e', lineHeight:1.6 }}>
          Ik kan zien wáár het uit elkaar loopt, maar niet wat je bedoelde. Kies per regel wat waar is —
          het wordt meteen in alle tabs bijgewerkt.
        </div>
      )}

      {groups.map(g => {
        const meta = ISSUE_META[g.kind]
        const isOpen = open[g.kind]
        return (
          <div key={g.kind} style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={() => setOpen(p => ({ ...p, [g.kind]: !p[g.kind] }))}
              style={{ display:'flex', alignItems:'center', gap:7, background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left' }}>
              <span style={{ color:'#475569', fontSize:10 }}>{isOpen ? '▾' : '▸'}</span>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'.4px', color: meta.color }}>{meta.label}</span>
              <span style={{ fontSize:10, color:'#475569' }}>({g.items.length})</span>
              <span style={{ fontSize:10, color:'#3f4a5a' }}>— {meta.hint}</span>
            </button>

            {isOpen && g.items.map(issue => (
              <div key={issue.key}
                style={{ background:'rgba(255,255,255,.03)', border:`1px solid ${meta.color}22`, borderRadius:8, padding:'10px 11px', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:11.5, color:'#cbd5e1', lineHeight:1.55 }}>{issue.detail}</div>

                {issue.items.map(it => (
                  <ItemRow key={`${it.kind}-${it.id}`} item={it} onFix={onFix} />
                ))}

                <button onClick={() => onIgnore(issue.key)}
                  style={{ alignSelf:'flex-start', fontSize:10.5, padding:'3px 8px', borderRadius:6,
                    border:'1px solid rgba(100,116,139,.3)', background:'rgba(100,116,139,.1)', color:'#94a3b8', cursor:'pointer' }}>
                  Klopt zo, laat staan
                </button>
              </div>
            ))}
          </div>
        )
      })}

      <button onClick={onMarkChecked}
        style={{ marginTop:'auto', fontSize:12, fontWeight:600, padding:'9px 14px', borderRadius:8,
          border:'1px solid rgba(63,185,80,.4)', background:'rgba(63,185,80,.12)', color:'#3fb950', cursor:'pointer' }}>
        ✓ Nagekeken — tot volgende week
      </button>
    </div>
  )
}

function ItemRow({ item, onFix }: { item: Item; onFix: (kind: ItemKind, id: string, action: FixAction) => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
      background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:7, padding:'6px 8px' }}>
      <span style={{ fontSize:10, color:'#64748b', minWidth:64 }}>{KIND_ICON[item.kind]} {KIND_LABEL[item.kind]}</span>
      <span style={{ fontSize:11.5, color: item.done ? '#4b5563' : '#e2e8f0', flex:1, minWidth:120,
        textDecoration: item.done ? 'line-through' : 'none' }}>
        {item.name.length > 52 ? item.name.slice(0, 52) + '…' : item.name}
      </span>
      {!item.done && (
        <button onClick={() => onFix(item.kind, item.id, 'done')} title="Deze is klaar"
          style={knop('#3fb950')} aria-label={`${KIND_LABEL[item.kind]} afvinken: ${item.name}`}>✓ Klaar</button>
      )}
      <button onClick={() => onFix(item.kind, item.id, 'delete')} title="Deze mag weg"
        style={knop('#f85149')} aria-label={`${KIND_LABEL[item.kind]} verwijderen: ${item.name}`}>🗑</button>
    </div>
  )
}

function knop(color: string): React.CSSProperties {
  return {
    fontSize:10.5, fontWeight:600, padding:'3px 8px', borderRadius:6,
    border:`1px solid ${color}44`, background:`${color}14`, color, cursor:'pointer', whiteSpace:'nowrap',
  }
}

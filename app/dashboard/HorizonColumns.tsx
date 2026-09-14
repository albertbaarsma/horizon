'use client'
// ─── HorizonColumns ─────────────────────────────────────────────────────────
// Gedeelde lay-out voor "10 horizon-kolommen" (Doelen, en de horizon-weergave
// van Projecten/Taken): de eerste 6 uit HORIZON_ORDER (nu..2-4jr) zijn
// kort-lopend en staan altijd in beeld; de laatste 4 (5-9jr, 10jr+,
// doorlopend, ooit) zitten achter een inklapbaar paneel (standaard dicht) —
// minder rommel in het dagelijkse overzicht, met een compactere kolombreedte
// omdat die horizons meestal minder items hebben.
import { useState, useEffect } from 'react'

export interface HorizonColumnDef {
  key: string
  content: React.ReactNode
}

/** Hoort bij de volgorde van HORIZON_ORDER in lib/goal-horizons.ts. */
const KORTE_TERMIJN_AANTAL = 6

export function HorizonColumns({ columns, storageKey }: { columns: HorizonColumnDef[]; storageKey: string }) {
  const kort = columns.slice(0, KORTE_TERMIJN_AANTAL).filter(c => c.content != null)
  const lang = columns.slice(KORTE_TERMIJN_AANTAL).filter(c => c.content != null)
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(localStorage.getItem(storageKey) === '1') }, [storageKey])

  function toggle() {
    setOpen(prev => {
      const next = !prev
      try { localStorage.setItem(storageKey, next ? '1' : '0') } catch { /* niet erg */ }
      return next
    })
  }

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12, alignItems:'start' }}>
        {kort.map(c => <div key={c.key}>{c.content}</div>)}
      </div>
      {lang.length > 0 && (
        <div style={{ marginTop:18 }}>
          <button onClick={toggle}
            style={{ display:'flex', alignItems:'center', gap:7, width:'100%', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, fontWeight:700, letterSpacing:'0.4px', textTransform:'uppercase', padding:'4px 2px' }}>
            <span style={{ fontSize:9, transform: open ? 'rotate(90deg)' : 'none', transition:'transform .1s' }}>▸</span>
            🔭 Lange termijn
            <span style={{ flex:1, height:1, background:'var(--border)', display:'block' }} />
          </button>
          {open && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10, marginTop:10, alignItems:'start' }}>
              {lang.map(c => <div key={c.key}>{c.content}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

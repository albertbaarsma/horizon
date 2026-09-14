'use client'
import { useState } from 'react'
import type { ShoppingItem } from '@/lib/types'

/** Simpel boodschappenlijstje — zijpaneel, zelfde vorm als UitwerkPanel. */
export function ShoppingListPanel({ items, onAdd, onToggle, onDelete, onClose }: {
  items: ShoppingItem[]
  onAdd: (text: string) => void
  onToggle: (id: number) => void
  onDelete: (id: number) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')

  function submit() {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText('')
  }

  const open = items.filter(i => !i.done)
  const done = items.filter(i => i.done)

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:360, maxWidth:'92%', zIndex:150, background:'var(--bg2)', borderLeft:'1px solid var(--border)', boxShadow:'-8px 0 32px rgba(0,0,0,.35)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>🛒 Boodschappen</span>
        <button onClick={onClose} aria-label="Sluiten"
          style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:16, lineHeight:1, padding:4 }}>
          ✕
        </button>
      </div>

      <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', display:'flex', gap:8 }}>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Nieuw item…" autoFocus
          style={{ flex:1, fontSize:13, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:7, padding:'8px 10px', outline:'none' }} />
        <button onClick={submit} disabled={!text.trim()}
          style={{ fontSize:12, fontWeight:600, padding:'0 14px', borderRadius:7, cursor: text.trim() ? 'pointer' : 'default',
            background: text.trim() ? 'rgba(99,102,241,.2)' : 'var(--bg3)',
            border:`1px solid ${text.trim() ? 'rgba(99,102,241,.4)' : 'var(--border)'}`,
            color: text.trim() ? '#a5b4fc' : 'var(--dim)' }}>
          ＋
        </button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'8px 18px' }}>
        {items.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--dim)', fontSize:12, padding:'30px 0' }}>Nog niets op je lijstje.</div>
        ) : (
          <>
            {open.map(item => (
              <Row key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} />
            ))}
            {done.length > 0 && (
              <>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--dim)', margin:'14px 0 6px' }}>
                  Gehaald ({done.length})
                </div>
                {done.map(item => (
                  <Row key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Row({ item, onToggle, onDelete }: { item: ShoppingItem; onToggle: (id: number) => void; onDelete: (id: number) => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 4px', borderRadius:6 }}>
      <button onClick={() => onToggle(item.id)} aria-label={item.done ? 'Terugzetten' : 'Afvinken'}
        style={{ width:17, height:17, borderRadius:4, flexShrink:0, border:`2px solid ${item.done ? 'var(--green)' : 'var(--border)'}`, background: item.done ? 'var(--green)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>
        {item.done ? '✓' : ''}
      </button>
      <span style={{ flex:1, fontSize:13, color: item.done ? 'var(--dim)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none' }}>
        {item.text}
      </span>
      <button onClick={() => onDelete(item.id)} title="Verwijderen"
        style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#64748b', padding:'0 2px', lineHeight:1 }}
        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
        🗑
      </button>
    </div>
  )
}

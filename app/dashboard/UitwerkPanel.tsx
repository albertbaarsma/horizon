'use client'
import { useState } from 'react'
import type { Task } from '@/lib/types'
import type { NietSmartItem } from '@/lib/uitwerk-overzicht'
import { combinedUitwerkPrompt } from '@/lib/uitwerk-overzicht'
import { CopyPromptButton } from './PromptButton'

// ─── UitwerkPanel — alles wat nog niet SMART is, in één overzicht ─────────────
// Vink aan wat je nu wilt uitwerken, kopieer één prompt die ze allemaal
// meeneemt. Standaard staat alles aan — meestal wil je toch alles een keer
// langslopen; uitvinken is minder werk dan bijvinken.

export function UitwerkPanel({ items, tasks, onOpenGoal, onOpenProject, onClose }: {
  items: NietSmartItem[]
  tasks: Task[]
  onOpenGoal?: (id: number) => void
  onOpenProject?: (project: NonNullable<NietSmartItem['project']>) => void
  onClose: () => void
}) {
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(() => new Set(items.map(i => i.id)))

  function toggle(id: string) {
    setGeselecteerd(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const gekozen = items.filter(i => geselecteerd.has(i.id))
  const prompt = combinedUitwerkPrompt(gekozen, tasks)

  return (
    <div role="complementary" aria-label="Nog niet SMART"
      style={{ position:'fixed', top:0, left:0, bottom:0, width:400, maxWidth:'92%',
        background:'rgba(13,17,23,.97)', borderRight:'1px solid rgba(168,139,250,.25)',
        boxShadow:'12px 0 40px rgba(0,0,0,.5)',
        overflowY:'auto', padding:'18px 16px 100px', zIndex:150,
        display:'flex', flexDirection:'column', gap:14 }}>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>🧭 Nog niet SMART</div>
          <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>
            {items.length} {items.length === 1 ? 'doel of project mist' : 'doelen en projecten missen'} nog een duidelijk result
          </div>
        </div>
        <button onClick={onClose} aria-label="Overzicht sluiten"
          style={{ background:'none', border:'none', color:'#64748b', fontSize:18, cursor:'pointer', padding:'0 4px', lineHeight:1 }}>×</button>
      </div>

      {items.length === 0 && (
        <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          Niets meer om uit te werken — elk actief doel en project heeft een duidelijk result. ✨
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display:'flex', gap:8, fontSize:10.5 }}>
          <button onClick={() => setGeselecteerd(new Set(items.map(i => i.id)))}
            style={{ background:'none', border:'none', color:'#818cf8', cursor:'pointer', padding:0, textDecoration:'underline' }}>
            Alles aan
          </button>
          <button onClick={() => setGeselecteerd(new Set())}
            style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', padding:0, textDecoration:'underline' }}>
            Alles uit
          </button>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {items.map(item => (
          <label key={item.id}
            style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'9px 10px', borderRadius:8, cursor:'pointer',
              background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)' }}>
            <input type="checkbox" checked={geselecteerd.has(item.id)} onChange={() => toggle(item.id)}
              style={{ marginTop:2, cursor:'pointer', accentColor:'#8b5cf6', flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.4px', textTransform:'uppercase',
                  color: item.kind === 'goal' ? '#c4b5fd' : '#93c5fd' }}>
                  {item.kind === 'goal' ? '🎯 doel' : '🗂 project'}
                </span>
              </div>
              <button onClick={e => { e.preventDefault(); item.kind === 'goal' ? onOpenGoal?.(item.goal!.id) : onOpenProject?.(item.project!) }}
                title="Openen" style={{ background:'none', border:'none', padding:0, textAlign:'left', cursor:'pointer',
                  fontSize:12.5, color:'#e2e8f0', lineHeight:1.4 }}>
                {item.naam}
              </button>
              <div style={{ fontSize:10.5, color:'#8b949e', marginTop:3 }}>Mist: {item.ontbreekt.join(', ')}</div>
            </div>
          </label>
        ))}
      </div>

      {items.length > 0 && (
        <div style={{ position:'sticky', bottom:0, marginTop:'auto', paddingTop:14, paddingBottom:14,
          background:'linear-gradient(180deg, transparent, rgba(13,17,23,.97) 30%)' }}>
          <div style={{ background:'rgba(168,139,250,.08)', border:'1px solid rgba(168,139,250,.25)', borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ flex:1, fontSize:11, color:'#c4b5fd' }}>
              {gekozen.length} geselecteerd
            </div>
            <CopyPromptButton text={prompt} label={`Copy prompt (${gekozen.length})`}
              style={{ opacity: gekozen.length ? 1 : .4, pointerEvents: gekozen.length ? 'auto' : 'none' }} />
          </div>
        </div>
      )}
    </div>
  )
}

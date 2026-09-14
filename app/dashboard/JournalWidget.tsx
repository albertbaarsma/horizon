'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Achievement } from '@/lib/types'

const JOURNAL_TYPES = [
  { key: 'achievement' as const, label: 'Achievement',   emoji: '🏆', color: '#fbbf24', dim: 'rgba(251,191,36,.12)',  placeholder: 'Wat heb je bereikt vandaag?' },
  { key: 'magic'       as const, label: 'Magic Moment',  emoji: '✨', color: '#c084fc', dim: 'rgba(192,132,252,.12)', placeholder: 'Beschrijf het bijzondere moment…' },
  { key: 'verbeter'    as const, label: 'Verbeterpunt',  emoji: '💡', color: '#38bdf8', dim: 'rgba(56,189,248,.12)',  placeholder: 'Wat kan er beter?' },
]
type JournalKey = typeof JOURNAL_TYPES[number]['key']

function emojiToType(emoji: string): JournalKey {
  if (emoji === '✨') return 'magic'
  if (emoji === '💡') return 'verbeter'
  return 'achievement'
}

export function JournalWidget({ userId, achievements, onAdd, open: openProp, onClose, hideFab }: {
  userId: string
  achievements: Achievement[]
  onAdd: (a: Achievement) => void
  /** Van buitenaf open/dicht sturen (bv. vanuit het mobiele "Meer"-menu) — laat leeg voor het normale FAB-gedrag. */
  open?: boolean
  onClose?: () => void
  /** Geen eigen ronde knop tekenen — voor als iets anders (het "Meer"-menu) al de trigger is. */
  hideFab?: boolean
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const controlled = openProp !== undefined
  const open  = controlled ? openProp : internalOpen
  const setOpen = (v: boolean) => { if (controlled) { if (!v) onClose?.() } else setInternalOpen(v) }
  const [tab,    setTab]    = useState<JournalKey>('achievement')
  const [text,   setText]   = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open, tab])

  const today      = new Date().toISOString().slice(0, 10)
  const todayAll   = achievements.filter(a => a.date === today)
  const tabEntries = todayAll.filter(a => emojiToType(a.emoji) === tab)
  const active     = JOURNAL_TYPES.find(t => t.key === tab)!

  async function save() {
    const trimmed = text.trim()
    if (!trimmed || saving) return
    setSaving(true)
    const emoji = tab === 'magic' ? '✨' : tab === 'verbeter' ? '💡' : '🏆'
    const { data } = await supabase.from('achievements').insert({
      user_id: userId, text: trimmed, emoji, date: today, cat_id: null,
    }).select().single()
    if (data) onAdd(data as Achievement)
    setText('')
    setSaving(false)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  const panel = (
    <>
          {/* Header */}
          <div style={{ padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>📓 Dagboek</span>
            <span style={{ fontSize: 10, color: '#374151' }}>{today}</span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            {JOURNAL_TYPES.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setText('') }} style={{
                flex: 1, padding: '8px 3px', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: tab === t.key ? 700 : 400,
                background: tab === t.key ? t.dim : 'transparent',
                borderBottom: `2px solid ${tab === t.key ? t.color : 'transparent'}`,
                color: tab === t.key ? t.color : '#4b5563', transition: 'all .12s',
              }}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px 8px' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save() }}
                placeholder={active.placeholder}
                style={{
                  flex: 1, background: '#161c2d',
                  border: `1px solid ${text ? active.color + '66' : 'rgba(255,255,255,.1)'}`,
                  color: '#e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 12,
                  outline: 'none', fontFamily: 'inherit', transition: 'border .12s',
                }} />
              <button onClick={save} disabled={!text.trim() || saving} style={{
                width: 32, height: 32, flexShrink: 0,
                background: text.trim() ? active.dim : 'rgba(255,255,255,.04)',
                border: `1px solid ${text.trim() ? active.color + '55' : 'rgba(255,255,255,.08)'}`,
                color: text.trim() ? active.color : '#374151',
                borderRadius: 8, cursor: text.trim() ? 'pointer' : 'default',
                fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s',
              }}>
                ↑
              </button>
            </div>
          </div>

          {/* Today's entries */}
          <div style={{ maxHeight: 200, overflowY: 'auto', borderTop: '1px solid rgba(255,255,255,.04)' }}>
            {tabEntries.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', color: '#2d3748', fontSize: 11 }}>
                Nog niets voor vandaag — voeg iets toe!
              </div>
            ) : tabEntries.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{a.emoji}</span>
                <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{a.text}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.04)', padding: '6px 12px', display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, color: '#374151' }}>
              {todayAll.length} item{todayAll.length !== 1 ? 's' : ''} vandaag · volledig overzicht → tab 🏆 Achievements
            </span>
          </div>
    </>
  )

  // Extern aangestuurd (bv. vanuit het mobiele "Meer"-menu, geen eigen FAB):
  // een gewone bottom sheet, zelfde chrome als de andere mobiele sheets.
  if (hideFab) {
    if (!open) return null
    return (
      <div onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 8500, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: '#0b0f1a', border: '1px solid rgba(99,102,241,.25)', borderTop: '1px solid rgba(99,102,241,.25)', borderRadius: '16px 16px 0 0', overflow: 'hidden', boxShadow: '0 -12px 40px rgba(0,0,0,.5)', animation: 'bubbleIn .18s ease', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {panel}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Panel */}
      {open && (
        <div style={{
          position: 'absolute', bottom: 54, right: 0, width: 310,
          background: '#0b0f1a', border: '1px solid rgba(99,102,241,.25)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,.8)',
          animation: 'bubbleIn .18s cubic-bezier(.34,1.56,.64,1)', zIndex: 10,
        }}>
          {panel}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setOpen(!open)} title="Dagboek (achievements, magic moments, verbeterpunten)"
        style={{
          width: 44, height: 44, borderRadius: '50%',
          background: open ? 'linear-gradient(135deg,#1e1b4b,#312e81)' : 'rgba(255,255,255,.07)',
          border: `1px solid ${open ? 'rgba(99,102,241,.5)' : 'rgba(255,255,255,.14)'}`,
          color: open ? '#a5b4fc' : '#64748b',
          fontSize: open ? 14 : 17,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .2s',
          boxShadow: open ? '0 4px 16px rgba(0,0,0,.5)' : 'none',
        }}>
        {open ? '✕' : '📓'}
      </button>
    </div>
  )
}

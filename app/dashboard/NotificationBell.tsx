'use client'
// ─── Meldingenbelletje ──────────────────────────────────────────────────────
// Verzamelt de balkjes (urgent, achterstallig, wekelijkse controle, niet-SMART)
// onder één belletje met een rood aantal-badge, in plaats van dat ze los
// bovenin de app blijven staan. Wie de losse balkjes toch liever ziet kan dat
// weer aanzetten via Instellingen (show_alert_banners).
import { useState, useRef, useEffect } from 'react'

export interface AlertItem {
  key: string
  icon: string
  color: string
  body: React.ReactNode
  onDismiss: () => void
  dismissTitle: string
}

export function NotificationBell({ items, isMobile }: { items: AlertItem[]; isMobile?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        title={items.length ? `${items.length} melding${items.length === 1 ? '' : 'en'}` : 'Geen meldingen'}
        style={{
          fontSize: isMobile ? 16 : 13, color: 'var(--muted)', background: 'none', border: 'none',
          cursor: 'pointer', padding: isMobile ? '4px 4px' : '4px 6px', borderRadius: 5, lineHeight: 1, position: 'relative',
        }}
      >
        🔔
        {items.length > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2, background: 'var(--red)', color: '#fff',
            fontSize: 9, fontWeight: 700, lineHeight: 1, minWidth: 14, height: 14, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
          }}>
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 320, maxHeight: 420,
          overflowY: 'auto', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)', zIndex: 200,
        }}>
          {items.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>Geen meldingen 🎉</div>
          ) : items.map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: item.color, lineHeight: 1.5 }}>{item.body}</div>
              <button onClick={item.onDismiss} title={item.dismissTitle}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 2, flexShrink: 0 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

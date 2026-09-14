'use client'
import { useState } from 'react'

// ─── CopyPromptButton ───────────────────────────────────────────────────────
// De opvolger van de "Uitwerken"-knop die een prompt naar de ingebouwde AI-chat
// stuurde: dat werkte niet betrouwbaar genoeg. Simpeler en robuuster: kopieer
// de prompt naar het klembord, plak hem in je eigen Claude. Zelfde patroon als
// UsagePanel/SettingsClient — dit is de herbruikbare versie ervan, want Jordan
// wil dit "copy prompt"-idee bij meer plekken dan alleen doelen en projecten.

export function CopyPromptButton({ text, label = 'Copy prompt', gekopieerdLabel = '✓ Gekopieerd', style }: {
  text: string
  label?: string
  gekopieerdLabel?: string
  style?: React.CSSProperties
}) {
  const [gekopieerd, setGekopieerd] = useState(false)

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(text)
      setGekopieerd(true)
      setTimeout(() => setGekopieerd(false), 2000)
    } catch { /* geen klembordtoegang: dan niet */ }
  }

  return (
    <button onClick={kopieer} title="Kopieer naar het klembord — plak hem in je eigen Claude"
      style={{ fontSize:11, fontWeight:600, padding:'5px 12px', borderRadius:6, cursor:'pointer',
        background: gekopieerd ? 'rgba(63,185,80,.18)' : 'rgba(168,139,250,.18)',
        borderWidth:1, borderStyle:'solid',
        borderColor: gekopieerd ? 'rgba(63,185,80,.45)' : 'rgba(168,139,250,.45)',
        color: gekopieerd ? '#3fb950' : '#c4b5fd', transition:'background .15s, border-color .15s, color .15s',
        ...style }}>
      {gekopieerd ? gekopieerdLabel : `📋 ${label}`}
    </button>
  )
}

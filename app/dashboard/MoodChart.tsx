'use client'
import { useState } from 'react'
import type { MoodEntry } from '@/lib/types'
import { MOOD_MIN, MOOD_MAX, moodMeta, lastDays } from '@/lib/mood'

const RANGES = [
  { days: 30,  label: '30d' },
  { days: 90,  label: '90d' },
  { days: 365, label: '1 jaar' },
] as const

// Bandgrenzen, laag → hoog — zelfde banden als lib/mood.ts, nu als [min,max] voor de achtergrondstroken.
const BAND_EDGES = [MOOD_MIN, -7, -3, -1, 0, 2, 6, MOOD_MAX]

const W = 680
const H = 160
const PAD_L = 26
const PAD_R = 10
const PAD_T = 8
const PAD_B = 8

function yFor(mood: number): number {
  const t = (mood - MOOD_MIN) / (MOOD_MAX - MOOD_MIN)
  return PAD_T + (1 - t) * (H - PAD_T - PAD_B)
}

/**
 * Stemming over een langere periode — om patronen te zien die een 14-daagse
 * strip niet laat zien, zoals een jaarlijks terugkerende dip.
 * Puur een spiegel van wat is ingevuld: geen trendlijn, geen voorspelling.
 */
export function MoodChart({ entries, today }: { entries: MoodEntry[]; today: string }) {
  const [rangeIdx, setRangeIdx] = useState(1) // standaard 90 dagen

  const range = RANGES[rangeIdx]
  const windowEntries = [...lastDays(entries, range.days, today)].reverse() // oud → nieuw

  if (entries.length < 3) return null // te weinig data om iets zinnigs te tonen

  const plotW = W - PAD_L - PAD_R
  const points = windowEntries.map((e, i) => ({
    x: PAD_L + (windowEntries.length === 1 ? plotW / 2 : (i / (windowEntries.length - 1)) * plotW),
    y: yFor(e.mood),
    entry: e,
  }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const zeroY = yFor(0)

  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', marginBottom:18 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>📈 Stemming door de tijd</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          {RANGES.map((r, i) => (
            <button key={r.label} onClick={() => setRangeIdx(i)}
              style={{ fontSize:10, padding:'3px 9px', borderRadius:6, cursor:'pointer',
                background: rangeIdx === i ? 'rgba(99,102,241,.2)' : 'var(--bg)',
                border: `1px solid ${rangeIdx === i ? 'rgba(99,102,241,.4)' : 'var(--border)'}`,
                color: rangeIdx === i ? '#a5b4fc' : 'var(--dim)' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {windowEntries.length < 2 ? (
        <div style={{ fontSize:11, color:'var(--dim)', padding:'20px 0', textAlign:'center' }}>
          Nog niet genoeg registraties in deze periode.
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }}>
          {/* Achtergrondbanden — dezelfde kleuren als de dagelijkse balkjes */}
          {BAND_EDGES.slice(0, -1).map((lo, i) => {
            const hi = BAND_EDGES[i + 1]
            const mid = (lo + hi) / 2
            return (
              <rect key={i} x={PAD_L} y={yFor(hi)} width={plotW} height={Math.max(0, yFor(lo) - yFor(hi))}
                fill={moodMeta(mid).color} opacity={0.06} />
            )
          })}
          {/* Nullijn */}
          <line x1={PAD_L} x2={W - PAD_R} y1={zeroY} y2={zeroY} stroke="var(--border)" strokeWidth={1} strokeDasharray="3,3" />
          <text x={2} y={zeroY + 3} fontSize={8} fill="var(--dim)">0</text>
          <text x={2} y={PAD_T + 7} fontSize={8} fill="var(--dim)">+{MOOD_MAX}</text>
          <text x={2} y={H - PAD_B} fontSize={8} fill="var(--dim)">{MOOD_MIN}</text>
          {/* Lijn */}
          <path d={path} fill="none" stroke="#a5b4fc" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
          {/* Punten */}
          {points.map(p => (
            <circle key={p.entry.id} cx={p.x} cy={p.y} r={p.entry.source === 'ai' ? 2 : 2.6}
              fill={moodMeta(p.entry.mood).color}
              stroke={p.entry.source === 'ai' ? moodMeta(p.entry.mood).color : 'none'}
              strokeWidth={1} strokeDasharray={p.entry.source === 'ai' ? '1,1' : undefined}>
              <title>{`${p.entry.date}: ${p.entry.mood > 0 ? '+' : ''}${p.entry.mood} (${moodMeta(p.entry.mood).label.toLowerCase()})${p.entry.source === 'ai' ? ' — AI-inschatting' : ''}${p.entry.note ? ` — ${p.entry.note}` : ''}`}</title>
            </circle>
          ))}
        </svg>
      )}
      <div style={{ fontSize:9, color:'var(--dim)', marginTop:4 }}>
        {windowEntries.length} registratie{windowEntries.length === 1 ? '' : 's'} in de laatste {range.label}. Stippellijn-rand = AI-inschatting op basis van het dagboek.
      </div>
    </div>
  )
}

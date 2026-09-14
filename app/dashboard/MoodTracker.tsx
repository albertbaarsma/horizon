'use client'
import { useState } from 'react'
import type { MoodEntry } from '@/lib/types'
import { MOOD_MIN, MOOD_MAX, moodMeta, entryForDate, lastDays, summarize, describePattern } from '@/lib/mood'

/**
 * Stemming, energie en slaap per dag. Beide kanten van de schaal, omdat een dip
 * én een piek relevant zijn. Slaap staat erbij omdat verandering daarin vaak het
 * eerst opvalt.
 *
 * Dit is een registratiehulpmiddel: het toont alleen wat jij invult, het stelt
 * niets vast en geeft geen advies.
 */
export function MoodTracker({ entries, today, onSave }: {
  entries: MoodEntry[]
  today: string
  onSave: (e: { mood: number; energy: number | null; sleep_hours: number | null; note: string; date: string }) => Promise<void> | void
}) {
  const existing = entryForDate(entries, today)
  const [open, setOpen]     = useState(false)
  const [mood, setMood]     = useState<number | null>(existing?.mood ?? null)
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null)
  const [sleep, setSleep]   = useState<string>(existing?.sleep_hours != null ? String(existing.sleep_hours) : '')
  const [note, setNote]     = useState(existing?.note ?? '')
  const [saving, setSaving] = useState(false)

  const window14 = lastDays(entries, 14, today)
  const summary  = summarize(window14)
  const lines    = describePattern(summary)

  async function save() {
    if (mood === null || saving) return
    setSaving(true)
    await onSave({
      mood,
      energy,
      sleep_hours: sleep.trim() === '' ? null : Number(sleep.replace(',', '.')),
      note: note.trim(),
      date: today,
    })
    setSaving(false)
    setOpen(false)
  }

  // 14-daagse strip, oud → nieuw
  const strip = [...window14].reverse()

  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', marginBottom:18 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>🌤 Hoe gaat het?</span>
        {existing ? (
          <span style={{ fontSize:11, color:'var(--dim)' }}>
            vandaag ingevuld: {moodMeta(existing.mood).emoji} {moodMeta(existing.mood).label.toLowerCase()}
            {existing.sleep_hours != null && ` · ${existing.sleep_hours}u slaap`}
          </span>
        ) : (
          <span style={{ fontSize:11, color:'var(--dim)' }}>nog niet ingevuld vandaag</span>
        )}
        <button onClick={() => setOpen(o => !o)}
          style={{ marginLeft:'auto', fontSize:11, padding:'4px 11px', borderRadius:7, cursor:'pointer', background: open ? 'rgba(99,102,241,.15)' : 'rgba(99,102,241,.08)', border:'1px solid rgba(99,102,241,.3)', color:'#a5b4fc' }}>
          {open ? 'Sluiten' : existing ? 'Bijwerken' : '＋ Invullen'}
        </button>
      </div>

      {/* 14-daagse strip */}
      {strip.length > 0 && (
        <div style={{ display:'flex', gap:3, marginTop:10, alignItems:'flex-end', height:34 }}>
          {strip.map(e => {
            const meta = moodMeta(e.mood)
            // -10 → klein balkje onderaan, +10 → hoog balkje
            const h = 6 + ((e.mood - MOOD_MIN) / (MOOD_MAX - MOOD_MIN)) * 26
            return (
              <div key={e.date} title={`${e.date}: ${meta.label}${e.sleep_hours != null ? ` · ${e.sleep_hours}u slaap` : ''}${e.note ? ` — ${e.note}` : ''}`}
                style={{ flex:1, minWidth:0, height:h, borderRadius:3, background:meta.color, opacity:.85 }} />
            )
          })}
        </div>
      )}

      {/* Patroon in woorden — beschrijvend, geen conclusies */}
      {summary.count > 0 && (
        <div style={{ fontSize:10, color:'var(--dim)', marginTop:8, lineHeight:1.6 }}>
          {lines.join(' ')}
        </div>
      )}

      {/* Invulformulier */}
      {open && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--dim)', marginBottom:6 }}>Stemming</div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:16, flexShrink:0, width:22, textAlign:'center' }}>{moodMeta(mood ?? 0).emoji}</span>
              <input type="range" min={MOOD_MIN} max={MOOD_MAX} step={1} value={mood ?? 0}
                onChange={e => setMood(Number(e.target.value))}
                aria-label="Stemming" style={{ flex:1, accentColor: moodMeta(mood ?? 0).color }} />
              <span style={{ fontSize:12, fontWeight:700, color: mood !== null ? moodMeta(mood).color : 'var(--dim)', flexShrink:0, width:28, textAlign:'right' }}>
                {mood !== null ? (mood > 0 ? `+${mood}` : mood) : '–'}
              </span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'var(--dim)', marginTop:2 }}>
              <span>−10 laag</span><span>0 neutraal</span><span>+10 hoog</span>
            </div>
            {mood !== null && (
              <div style={{ fontSize:10, color:moodMeta(mood).color, marginTop:5 }}>{moodMeta(mood).label}</div>
            )}
          </div>

          <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--dim)', marginBottom:6 }}>Energie</div>
              <div style={{ display:'flex', gap:3 }}>
                {[1,2,3,4,5].map(v => (
                  <button key={v} onClick={() => setEnergy(energy === v ? null : v)} aria-label={`energie ${v}`} aria-pressed={energy === v}
                    style={{ width:28, padding:'5px 0', borderRadius:6, fontSize:11, cursor:'pointer',
                      background: energy !== null && v <= energy ? 'rgba(74,222,128,.18)' : 'var(--bg)',
                      border:`1px solid ${energy !== null && v <= energy ? 'rgba(74,222,128,.45)' : 'var(--border)'}`,
                      color: energy !== null && v <= energy ? '#4ade80' : 'var(--dim)' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="sleep" style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--dim)', marginBottom:6 }}>
                Slaap (uren)
              </label>
              <input id="sleep" type="number" min={0} max={24} step={0.5} value={sleep}
                onChange={e => setSleep(e.target.value)} placeholder="7.5"
                style={{ width:74, fontSize:12, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:6, padding:'6px 8px' }} />
            </div>
          </div>

          <div>
            <label htmlFor="moodnote" style={{ display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--dim)', marginBottom:6 }}>
              Toelichting (optioneel)
            </label>
            <input id="moodnote" value={note} onChange={e => setNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              placeholder="Wat speelt er mee?"
              style={{ width:'100%', boxSizing:'border-box', fontSize:12, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:6, padding:'7px 10px' }} />
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={save} disabled={mood === null || saving}
              style={{ fontSize:12, fontWeight:600, padding:'7px 16px', borderRadius:7, cursor: mood === null || saving ? 'default' : 'pointer',
                background: mood === null || saving ? 'var(--bg3)' : 'rgba(99,102,241,.2)',
                border:`1px solid ${mood === null || saving ? 'var(--border)' : 'rgba(99,102,241,.4)'}`,
                color: mood === null || saving ? 'var(--dim)' : '#a5b4fc' }}>
              {saving ? 'Opslaan…' : existing ? 'Bijwerken' : 'Opslaan'}
            </button>
            <span style={{ fontSize:9, color:'var(--dim)' }}>
              Alleen voor jezelf — je eigen registratie, geen beoordeling.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

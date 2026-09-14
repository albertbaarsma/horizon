'use client'
import { useState } from 'react'
import type { DiaryEntry, MoodEntry } from '@/lib/types'
import { MoodTracker } from './MoodTracker'
import { MoodChart } from './MoodChart'
import { entryForDate, moodMeta } from '@/lib/mood'

const MONTHS_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']

function prettyDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const wd = d.toLocaleDateString('nl-NL', { weekday: 'long' })
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`
}

export function DiaryTab({ entries, today, onAdd, moodEntries, onSaveMood, onSuggestMood, compact = false }: {
  entries: DiaryEntry[]
  today: string
  onAdd: (text: string, date: string) => Promise<void> | void
  moodEntries?: MoodEntry[]
  onSaveMood?: (e: { mood: number; energy: number | null; sleep_hours: number | null; note: string; date: string; source?: 'manual' | 'ai' }) => Promise<void> | void
  /** Schat een stemmingscijfer in op basis van de zojuist geschreven tekst. Geeft null als er niets te melden is. */
  onSuggestMood?: (text: string, date: string) => Promise<{ mood: number; rationale: string } | null>
  /** In de zijkolom naast je dag: smaller, zonder eigen midden-uitlijning. */
  compact?: boolean
}) {
  const [text, setText]   = useState('')
  const [date, setDate]   = useState(today)
  const [saving, setSaving] = useState(false)
  const [suggestion, setSuggestion] = useState<{ mood: number; rationale: string; date: string } | null>(null)
  const [suggestBusy, setSuggestBusy] = useState(false)

  async function save() {
    const t = text.trim()
    if (!t || saving) return
    setSaving(true)
    const savedDate = date
    await onAdd(t, savedDate)
    setText('')
    setDate(today)
    setSaving(false)

    // Alleen suggereren als er nog geen stemming voor die dag is ingevuld —
    // nooit een bestaande, zelf ingevulde registratie in de weg zitten.
    if (onSuggestMood && !entryForDate(moodEntries ?? [], savedDate)) {
      setSuggestBusy(true)
      const s = await onSuggestMood(t, savedDate).catch(() => null)
      setSuggestBusy(false)
      if (s) setSuggestion({ ...s, date: savedDate })
    }
  }

  async function acceptSuggestion() {
    if (!suggestion || !onSaveMood) return
    await onSaveMood({
      mood: suggestion.mood, energy: null, sleep_hours: null,
      note: `AI-inschatting: ${suggestion.rationale}`, date: suggestion.date, source: 'ai',
    })
    setSuggestion(null)
  }

  return (
    <div style={{ maxWidth: compact ? '100%' : 680, margin: compact ? 0 : '0 auto' }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:14 }}>
        <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>📔 Dagboek</h2>
        <span style={{ fontSize:11, color:'var(--dim)' }}>je verhaal — losse gedachten, gevoelens, gebeurtenissen</span>
      </div>

      {/* Stemming van vandaag + patroon van de afgelopen twee weken */}
      {onSaveMood && <MoodTracker entries={moodEntries ?? []} today={today} onSave={onSaveMood} />}
      {onSaveMood && <MoodChart entries={moodEntries ?? []} today={today} />}

      {suggestBusy && (
        <div style={{ fontSize:11, color:'var(--dim)', marginBottom:14, marginTop:-8 }}>Stemming inschatten op basis van wat je schreef…</div>
      )}
      {suggestion && (
        <div style={{ background:'rgba(99,102,241,.07)', border:'1px solid rgba(99,102,241,.25)', borderRadius:10, padding:'12px 16px', marginBottom:18, marginTop:-8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text)' }}>
            <span style={{ fontSize:15 }}>{moodMeta(suggestion.mood).emoji}</span>
            <span>AI schat je stemming op <strong style={{ color:moodMeta(suggestion.mood).color }}>{suggestion.mood > 0 ? `+${suggestion.mood}` : suggestion.mood}</strong> ({moodMeta(suggestion.mood).label.toLowerCase()}) — {suggestion.rationale}</span>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button onClick={acceptSuggestion}
              style={{ fontSize:11, fontWeight:600, padding:'5px 12px', borderRadius:6, cursor:'pointer', background:'rgba(99,102,241,.2)', border:'1px solid rgba(99,102,241,.4)', color:'#a5b4fc' }}>
              Gebruiken
            </button>
            <button onClick={() => setSuggestion(null)}
              style={{ fontSize:11, padding:'5px 12px', borderRadius:6, cursor:'pointer', background:'none', border:'1px solid var(--border)', color:'var(--dim)' }}>
              Negeren
            </button>
          </div>
        </div>
      )}

      {/* Nieuwe entry */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', marginBottom:22 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save() }}
          placeholder="Wat wil je vastleggen? Schrijf vrijuit… (Ctrl+Enter om op te slaan)"
          rows={4}
          style={{ width:'100%', boxSizing:'border-box', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13, lineHeight:1.6, padding:'10px 12px', outline:'none', resize:'vertical', fontFamily:'inherit' }} />
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:10 }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ fontSize:12, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:6, padding:'5px 8px' }} />
          <span style={{ fontSize:11, color:'var(--dim)', marginLeft:'auto' }}>{text.trim().length} tekens</span>
          <button onClick={save} disabled={!text.trim() || saving}
            style={{ fontSize:12, fontWeight:600, padding:'7px 16px', borderRadius:7, cursor: (!text.trim()||saving) ? 'default' : 'pointer',
              background: (!text.trim()||saving) ? 'var(--bg3)' : 'rgba(99,102,241,.2)',
              border: `1px solid ${(!text.trim()||saving) ? 'var(--border)' : 'rgba(99,102,241,.4)'}`,
              color: (!text.trim()||saving) ? 'var(--dim)' : '#a5b4fc' }}>
            {saving ? 'Opslaan…' : '✍️ Opslaan'}
          </button>
        </div>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div style={{ textAlign:'center', color:'var(--dim)', fontSize:13, padding:'40px 0' }}>
          Nog geen dagboek-entries. Schrijf je eerste hierboven — of vertel het aan Horizon AI, dan zet die het erin.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {entries.map(e => (
            <div key={e.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px' }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.6px', color:'#818cf8', marginBottom:6 }}>
                {prettyDate(e.date)}
              </div>
              <div style={{ fontSize:13, lineHeight:1.65, color:'var(--text)', whiteSpace:'pre-wrap' }}>{e.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

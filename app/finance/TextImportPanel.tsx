'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Section, inputStyle } from '../PageForm'
import type { FinanceEntry } from '@/lib/types'

interface ParsedMoneyEntry {
  person: string
  amount: number
  description: string
  reasoning: string
  date: string
}

interface DraftRow extends ParsedMoneyEntry {
  include: boolean
  expanded: boolean
}

export default function TextImportPanel({ userId, onImported }: {
  userId: string
  onImported: (entries: FinanceEntry[]) => void
}) {
  const supabase = createClient()
  const [text, setText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<DraftRow[] | null>(null)
  const [importing, setImporting] = useState(false)

  async function analyze() {
    if (!text.trim() || analyzing) return
    setAnalyzing(true); setError(''); setDraft(null)
    try {
      const res = await fetch('/api/finance/parse-text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      })
      const data = await res.json() as { entries?: ParsedMoneyEntry[]; error?: string }
      if (!res.ok || data.error) { setError(data.error || 'Kon de tekst niet lezen'); return }
      if (!data.entries?.length) { setError('Geen bedragen gevonden in deze tekst'); return }
      setDraft(data.entries.map(e => ({ ...e, include: true, expanded: false })))
    } catch {
      setError('Kon de tekst niet analyseren')
    } finally {
      setAnalyzing(false)
    }
  }

  function updateRow(i: number, patch: Partial<DraftRow>) {
    setDraft(d => d ? d.map((r, idx) => idx === i ? { ...r, ...patch } : r) : d)
  }

  async function importDraft() {
    if (!draft) return
    const toInsert = draft.filter(r => r.include)
    if (toInsert.length === 0) { setDraft(null); setText(''); return }
    setImporting(true)
    const { data, error: insErr } = await supabase.from('finance_entries').insert(
      toInsert.map(r => ({
        user_id: userId, person: r.person.trim(), amount: r.amount,
        description: r.description.trim(), reasoning: r.reasoning, date: r.date,
      }))
    ).select('*')
    setImporting(false)
    if (!insErr && data) {
      onImported(data as FinanceEntry[])
      setDraft(null); setText('')
    }
  }

  const includedCount = draft?.filter(r => r.include).length ?? 0

  return (
    <Section title="📋 Verhaal plakken">
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
        Plak een appje, mailtje of eigen berekening over wie jou wat schuldig is — Horizon AI haalt er de bedragen uit, rekent zelf na, en laat de redenatie zien.
      </p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
        placeholder="Bijv. 'Hey Valentijn, ik had nagekeken wat je me schuldig bent...'"
        style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, marginBottom: 10 }} />
      <button onClick={analyze} disabled={!text.trim() || analyzing}
        style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 6, border: 'none',
          background: text.trim() && !analyzing ? 'var(--accent)' : 'var(--bg4)', color: '#fff',
          cursor: text.trim() && !analyzing ? 'pointer' : 'default' }}>
        {analyzing ? 'Bezig met lezen…' : '✨ Analyseren'}
      </button>
      {error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 10 }}>{error}</div>}

      {draft && (
        <div style={{ marginTop: 16 }}>
          {draft.map((r, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, opacity: r.include ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={r.include} onChange={e => updateRow(i, { include: e.target.checked })}
                  style={{ flexShrink: 0, cursor: 'pointer' }} />
                <input value={r.person} onChange={e => updateRow(i, { person: e.target.value })}
                  style={{ ...inputStyle, width: 120, flexShrink: 0, fontSize: 12, padding: '4px 8px', fontWeight: 600 }} />
                <input value={r.description} onChange={e => updateRow(i, { description: e.target.value })}
                  style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '4px 8px', minWidth: 0 }} />
                <input type="number" step="0.01" value={r.amount} onChange={e => updateRow(i, { amount: Number(e.target.value) })}
                  style={{ ...inputStyle, width: 84, flexShrink: 0, fontSize: 12, padding: '4px 6px', fontWeight: 600, color: r.amount >= 0 ? 'var(--green)' : 'var(--red)' }} />
                <span style={{ fontSize: 10, color: 'var(--dim)', flexShrink: 0, width: 60 }}>
                  {r.amount >= 0 ? 'schuldig' : 'ik schuld'}
                </span>
                <button onClick={() => updateRow(i, { expanded: !r.expanded })} title="Berekening tonen"
                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', padding: '0 2px' }}>
                  {r.expanded ? '▾' : '▸'}
                </button>
              </div>
              {r.expanded && (
                <textarea value={r.reasoning} onChange={e => updateRow(i, { reasoning: e.target.value })} rows={4}
                  style={{ ...inputStyle, width: '100%', marginTop: 8, fontSize: 11.5, color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', resize: 'vertical', lineHeight: 1.6 }} />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={importDraft} disabled={importing || includedCount === 0}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 6, border: 'none',
                background: includedCount > 0 ? 'var(--accent)' : 'var(--bg4)', color: '#fff',
                cursor: includedCount > 0 ? 'pointer' : 'default' }}>
              {importing ? 'Bezig…' : `Toevoegen (${includedCount})`}
            </button>
            <button onClick={() => { setDraft(null) }}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', cursor: 'pointer' }}>
              Annuleren
            </button>
          </div>
        </div>
      )}
    </Section>
  )
}

'use client'
import { useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Section, inputStyle } from '../PageForm'
import { FINANCE_CATEGORIES } from '@/lib/finance-categories'
import { categoryColor } from '@/lib/category-colors'
import type { FinanceTransaction } from '@/lib/types'

interface ParsedTransaction {
  date: string
  description: string
  amount: number
  category: string
}

interface DraftRow extends ParsedTransaction {
  include: boolean
  duplicate: boolean
}

function euro(n: number): string {
  return n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
}

function colorFor(category: string): string {
  const idx = FINANCE_CATEGORIES.indexOf(category as typeof FINANCE_CATEGORIES[number])
  return categoryColor(idx === -1 ? FINANCE_CATEGORIES.length : idx)
}

const currentMonth = () => new Date().toISOString().slice(0, 7)

export default function TransactionsPanel({ userId, transactions, setTransactions }: {
  userId: string
  transactions: FinanceTransaction[]
  setTransactions: React.Dispatch<React.SetStateAction<FinanceTransaction[]>>
}) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [draft, setDraft] = useState<DraftRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [month, setMonth] = useState(currentMonth)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true); setUploadError(''); setDraft(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/finance/parse-statement', { method: 'POST', body: fd })
      const data = await res.json() as { transactions?: ParsedTransaction[]; error?: string }
      if (!res.ok || data.error) { setUploadError(data.error || 'Kon het afschrift niet lezen'); return }
      const rows: DraftRow[] = (data.transactions ?? []).map(t => {
        const duplicate = transactions.some(ex =>
          ex.date === t.date && Math.abs(ex.amount - t.amount) < 0.005 && ex.description.trim() === t.description.trim())
        return { ...t, include: !duplicate, duplicate }
      })
      if (rows.length === 0) setUploadError('Geen transacties gevonden in dit bestand')
      setDraft(rows)
    } catch {
      setUploadError('Kon het afschrift niet uploaden')
    } finally {
      setUploading(false)
    }
  }

  function updateDraftRow(i: number, patch: Partial<DraftRow>) {
    setDraft(d => d ? d.map((r, idx) => idx === i ? { ...r, ...patch } : r) : d)
  }

  async function importDraft() {
    if (!draft) return
    const toInsert = draft.filter(r => r.include)
    if (toInsert.length === 0) { setDraft(null); return }
    setImporting(true)
    const { data, error } = await supabase.from('finance_transactions').insert(
      toInsert.map(r => ({ user_id: userId, date: r.date, description: r.description, amount: r.amount, category: r.category }))
    ).select('*')
    setImporting(false)
    if (!error && data) {
      setTransactions(prev => [...(data as FinanceTransaction[]), ...prev]
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id))
      setDraft(null)
    }
  }

  async function deleteTransaction(id: number) {
    const prev = transactions
    setTransactions(p => p.filter(t => t.id !== id))
    const { error } = await supabase.from('finance_transactions').delete().eq('id', id).eq('user_id', userId)
    if (error) setTransactions(prev)
  }

  const monthTx = useMemo(() => transactions.filter(t => t.date.slice(0, 7) === month), [transactions, month])
  const income   = useMemo(() => monthTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), [monthTx])
  const expenses = useMemo(() => monthTx.filter(t => t.amount < 0).reduce((s, t) => s - t.amount, 0), [monthTx])
  const categoryRows = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of monthTx) map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    return [...map.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  }, [monthTx])
  const maxAbs = categoryRows.length ? Math.max(...categoryRows.map(([, v]) => Math.abs(v))) : 0
  const includedCount = draft?.filter(r => r.include).length ?? 0

  return (
    <>
      <Section title="Afschrift uploaden">
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          Upload een PDF van je maandelijkse bankafschrift — Horizon AI leest elke transactie en stelt een categorie voor. Je controleert en kiest zelf wat je importeert.
        </p>
        <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 6, border: 'none',
            background: uploading ? 'var(--bg4)' : 'var(--accent)', color: '#fff', cursor: uploading ? 'default' : 'pointer' }}>
          {uploading ? 'Bezig met lezen…' : '📄 Afschrift uploaden (PDF)'}
        </button>
        {uploadError && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 10 }}>{uploadError}</div>}

        {draft && (
          <div style={{ marginTop: 16 }}>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px' }}>
              {draft.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', opacity: r.include ? 1 : 0.5 }}>
                  <input type="checkbox" checked={r.include} onChange={e => updateDraftRow(i, { include: e.target.checked })}
                    style={{ flexShrink: 0, cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, color: 'var(--dim)', flexShrink: 0, width: 82 }}>{r.date}</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={r.description}>
                    {r.description}
                    {r.duplicate && <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--dim)' }}>(al aanwezig)</span>}
                  </span>
                  <select value={r.category} onChange={e => updateDraftRow(i, { category: e.target.value })}
                    style={{ ...inputStyle, width: 140, flexShrink: 0, fontSize: 11, padding: '4px 6px' }}>
                    {!FINANCE_CATEGORIES.includes(r.category as typeof FINANCE_CATEGORIES[number]) && <option value={r.category}>{r.category}</option>}
                    {FINANCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="number" step="0.01" value={r.amount} onChange={e => updateDraftRow(i, { amount: Number(e.target.value) })}
                    style={{ ...inputStyle, width: 84, flexShrink: 0, fontSize: 11, padding: '4px 6px', color: r.amount >= 0 ? 'var(--green)' : 'var(--red)' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={importDraft} disabled={importing || includedCount === 0}
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 6, border: 'none',
                  background: includedCount > 0 ? 'var(--accent)' : 'var(--bg4)', color: '#fff',
                  cursor: includedCount > 0 ? 'pointer' : 'default' }}>
                {importing ? 'Bezig…' : `Importeren (${includedCount})`}
              </button>
              <button onClick={() => setDraft(null)}
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', cursor: 'pointer' }}>
                Annuleren
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Maandoverzicht">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputStyle, width: 160, marginBottom: 14 }} />

        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6 }}>Inkomsten</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{euro(income)}</div>
          </div>
          <div style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6 }}>Uitgaven</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>{euro(expenses)}</div>
          </div>
          <div style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6 }}>Netto</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: income - expenses >= 0 ? 'var(--green)' : 'var(--red)' }}>{euro(income - expenses)}</div>
          </div>
        </div>

        {categoryRows.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 12, padding: '16px 0' }}>Nog geen transacties voor deze maand.</div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {categoryRows.map(([cat, total]) => {
              const color = colorFor(cat)
              const pct = maxAbs ? Math.round(Math.abs(total) / maxAbs * 100) : 0
              return (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{cat}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: total >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {total >= 0 ? '+' : '−'}{euro(Math.abs(total))}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg3)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {monthTx.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            {monthTx.map(tx => {
              const color = colorFor(tx.category)
              return (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
                  <span style={{ fontSize: 12, color: 'var(--dim)', flexShrink: 0, width: 82 }}>{tx.date}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: `${color}22`, color, flexShrink: 0 }}>{tx.category}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {tx.description || <span style={{ color: 'var(--dim)' }}>—</span>}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: tx.amount >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                    {tx.amount >= 0 ? '+' : '−'}{euro(Math.abs(tx.amount))}
                  </span>
                  <button onClick={() => deleteTransaction(tx.id)} title="Verwijderen"
                    style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#64748b', padding: '0 2px', lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
                    🗑
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </>
  )
}

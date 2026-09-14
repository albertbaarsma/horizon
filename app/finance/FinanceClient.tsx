'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Section, Field, StatTile, inputStyle } from '../PageForm'
import TransactionsPanel from './TransactionsPanel'
import AllowancePanel from './AllowancePanel'
import TextImportPanel from './TextImportPanel'
import type { FinanceEntry, FinanceTransaction, AllowanceEntry, AllowanceGoal } from '@/lib/types'

function euro(n: number): string {
  return n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
}

interface PersonGroup {
  person: string
  open: FinanceEntry[]
  settled: FinanceEntry[]
  balance: number
}

function groupByPerson(entries: FinanceEntry[]): PersonGroup[] {
  const map = new Map<string, FinanceEntry[]>()
  for (const e of entries) {
    const list = map.get(e.person) ?? []
    list.push(e)
    map.set(e.person, list)
  }
  return [...map.entries()]
    .map(([person, list]) => ({
      person,
      open: list.filter(e => !e.settled),
      settled: list.filter(e => e.settled),
      balance: list.filter(e => !e.settled).reduce((s, e) => s + e.amount, 0),
    }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
}

export default function FinanceClient({ userId, initialEntries, initialTransactions, initialAllowanceEntries, initialAllowanceGoals, embedded = false }: {
  userId: string
  /** Weggelaten (i.p.v. lege array) = zelf ophalen via /api/finance/data — voor gebruik binnen Inzicht, zonder server-load. */
  initialEntries?: FinanceEntry[]
  initialTransactions?: FinanceTransaction[]
  initialAllowanceEntries?: AllowanceEntry[]
  initialAllowanceGoals?: AllowanceGoal[]
  /** Binnen Inzicht gerenderd: geen "← Dashboard"-kop, geen volle-viewport-wrapper. */
  embedded?: boolean
}) {
  const [tab, setTab] = useState<'schulden' | 'transacties' | 'zakgeld'>('schulden')
  const [entries, setEntries] = useState(initialEntries ?? [])
  const [transactions, setTransactions] = useState(initialTransactions ?? [])
  const [allowanceEntries, setAllowanceEntries] = useState(initialAllowanceEntries ?? [])
  const [allowanceGoals, setAllowanceGoals] = useState(initialAllowanceGoals ?? [])
  const [loading, setLoading] = useState(initialEntries === undefined)

  useEffect(() => {
    if (initialEntries !== undefined) return
    let cancelled = false
    fetch('/api/finance/data').then(r => r.json()).then(d => {
      if (cancelled) return
      setEntries(d.entries ?? [])
      setTransactions(d.transactions ?? [])
      setAllowanceEntries(d.allowanceEntries ?? [])
      setAllowanceGoals(d.allowanceGoals ?? [])
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [person,      setPerson]      = useState('')
  const [amountStr,   setAmountStr]   = useState('')
  const [direction,   setDirection]   = useState<'owed_to_me' | 'i_owe'>('owed_to_me')
  const [description, setDescription] = useState('')
  const [date,         setDate]        = useState(() => new Date().toISOString().slice(0, 10))
  const [saving,       setSaving]      = useState(false)

  const supabase = createClient()
  const groups = useMemo(() => groupByPerson(entries), [entries])
  const totalOwedToMe = groups.reduce((s, g) => s + Math.max(0, g.balance), 0)
  const totalIOwe     = groups.reduce((s, g) => s + Math.max(0, -g.balance), 0)
  const knownPersons  = useMemo(() => [...new Set(entries.map(e => e.person))].sort(), [entries])

  async function addEntry() {
    const bedrag = Number(amountStr.replace(',', '.'))
    if (!person.trim() || !bedrag || saving) return
    setSaving(true)
    const signed = direction === 'owed_to_me' ? Math.abs(bedrag) : -Math.abs(bedrag)
    const { data } = await supabase.from('finance_entries').insert({
      user_id: userId, person: person.trim(), amount: signed,
      description: description.trim(), date,
    }).select('*').single()
    if (data) setEntries(prev => [data as FinanceEntry, ...prev])
    setAmountStr(''); setDescription('')
    setSaving(false)
  }

  async function toggleSettled(entry: FinanceEntry) {
    const settled = !entry.settled
    const prev = entries
    setEntries(p => p.map(e => e.id === entry.id ? { ...e, settled } : e))
    const { error } = await supabase.from('finance_entries').update({ settled }).eq('id', entry.id).eq('user_id', userId)
    if (error) setEntries(prev)
  }

  async function deleteEntry(id: number) {
    const prev = entries
    setEntries(p => p.filter(e => e.id !== id))
    const { error } = await supabase.from('finance_entries').delete().eq('id', id).eq('user_id', userId)
    if (error) setEntries(prev)
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>Financiën laden…</div>
  }

  return (
    <div style={embedded ? { height: '100%', overflowY: 'auto', background: 'var(--bg)', padding: 20 } : { minHeight: '100vh', background: 'var(--bg)', padding: 32 }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {!embedded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <Link href="/dashboard" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 12 }}>← Dashboard</Link>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>💰 Financiën</h1>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          <button onClick={() => setTab('schulden')}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
              background: tab === 'schulden' ? 'rgba(99,102,241,.15)' : 'var(--bg3)',
              border: `1px solid ${tab === 'schulden' ? 'var(--accent)' : 'var(--border)'}`,
              color: tab === 'schulden' ? '#a5b4fc' : 'var(--muted)' }}>
            Wie is wie schuldig
          </button>
          <button onClick={() => setTab('transacties')}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
              background: tab === 'transacties' ? 'rgba(99,102,241,.15)' : 'var(--bg3)',
              border: `1px solid ${tab === 'transacties' ? 'var(--accent)' : 'var(--border)'}`,
              color: tab === 'transacties' ? '#a5b4fc' : 'var(--muted)' }}>
            Uitgaven & inkomsten
          </button>
          <button onClick={() => setTab('zakgeld')}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
              background: tab === 'zakgeld' ? 'rgba(99,102,241,.15)' : 'var(--bg3)',
              border: `1px solid ${tab === 'zakgeld' ? 'var(--accent)' : 'var(--border)'}`,
              color: tab === 'zakgeld' ? '#a5b4fc' : 'var(--muted)' }}>
            Zakgeld
          </button>
        </div>

        {tab === 'transacties' && (
          <TransactionsPanel userId={userId} transactions={transactions} setTransactions={setTransactions} />
        )}

        {tab === 'zakgeld' && (
          <AllowancePanel userId={userId} entries={allowanceEntries} setEntries={setAllowanceEntries} goals={allowanceGoals} setGoals={setAllowanceGoals} />
        )}

        {tab === 'schulden' && <>
        {/* Overzicht */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <StatTile label="Aan jou verschuldigd" value={euro(totalOwedToMe)} color="var(--green)" />
          <StatTile label="Jij bent schuldig" value={euro(totalIOwe)} color="var(--red)" />
          <StatTile label="Netto" value={euro(totalOwedToMe - totalIOwe)} color={totalOwedToMe - totalIOwe >= 0 ? 'var(--green)' : 'var(--red)'} />
        </div>

        <TextImportPanel userId={userId} onImported={rows => setEntries(prev => [...rows, ...prev])} />

        {/* Nieuw bedrag */}
        <Section title="Nieuw bedrag">
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px' }}>
              <Field label="Persoon">
                <input value={person} onChange={e => setPerson(e.target.value)} list="finance-personen" placeholder="Bijv. Broer, Buurman…"
                  style={inputStyle} />
                <datalist id="finance-personen">
                  {knownPersons.map(p => <option key={p} value={p} />)}
                </datalist>
              </Field>
            </div>
            <div style={{ width: 120 }}>
              <Field label="Bedrag (€)">
                <input value={amountStr} onChange={e => setAmountStr(e.target.value)} inputMode="decimal" placeholder="0,00"
                  style={inputStyle} />
              </Field>
            </div>
            <div style={{ width: 160 }}>
              <Field label="Datum">
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
              </Field>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button onClick={() => setDirection('owed_to_me')}
              style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                background: direction === 'owed_to_me' ? 'rgba(63,185,80,.15)' : 'var(--bg3)',
                border: `1px solid ${direction === 'owed_to_me' ? 'var(--green)' : 'var(--border)'}`,
                color: direction === 'owed_to_me' ? 'var(--green)' : 'var(--muted)' }}>
              → is mij schuldig
            </button>
            <button onClick={() => setDirection('i_owe')}
              style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                background: direction === 'i_owe' ? 'rgba(248,113,113,.15)' : 'var(--bg3)',
                border: `1px solid ${direction === 'i_owe' ? 'var(--red)' : 'var(--border)'}`,
                color: direction === 'i_owe' ? 'var(--red)' : 'var(--muted)' }}>
              ← ik ben schuldig
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <input value={description} onChange={e => setDescription(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addEntry() }}
              placeholder="Omschrijving — bijv. 'Pianoles 15 aug'"
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addEntry} disabled={!person.trim() || !Number(amountStr.replace(',', '.')) || saving}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 6, border: 'none',
                background: person.trim() && Number(amountStr.replace(',', '.')) ? 'var(--accent)' : 'var(--bg4)',
                color: '#fff', cursor: person.trim() && Number(amountStr.replace(',', '.')) ? 'pointer' : 'default', flexShrink: 0 }}>
              {saving ? '…' : '+ Toevoegen'}
            </button>
          </div>
        </Section>

        {/* Per persoon */}
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 13, padding: '40px 0' }}>
            Nog niets bijgehouden. Zet er hierboven een bedrag bij.
          </div>
        ) : (
          groups.map(g => (
            <div key={g.person} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: g.open.length + g.settled.length ? 10 : 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{g.person}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: g.balance > 0 ? 'var(--green)' : g.balance < 0 ? 'var(--red)' : 'var(--dim)' }}>
                  {g.balance === 0 ? 'quitte' : g.balance > 0 ? `+${euro(g.balance)}` : `−${euro(-g.balance)}`}
                </span>
              </div>
              {g.open.map(e => <EntryRow key={e.id} entry={e} onToggleSettled={toggleSettled} onDelete={deleteEntry} />)}
              {g.settled.length > 0 && (
                <>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', margin: '10px 0 4px' }}>
                    Verrekend ({g.settled.length})
                  </div>
                  {g.settled.map(e => <EntryRow key={e.id} entry={e} onToggleSettled={toggleSettled} onDelete={deleteEntry} />)}
                </>
              )}
            </div>
          ))
        )}
        </>}
      </div>
    </div>
  )
}

function EntryRow({ entry, onToggleSettled, onDelete }: { entry: FinanceEntry; onToggleSettled: (e: FinanceEntry) => void; onDelete: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ padding: '6px 0', opacity: entry.settled ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <button onClick={() => onToggleSettled(entry)} title={entry.settled ? 'Terugzetten naar openstaand' : 'Markeer als verrekend'}
          style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${entry.settled ? 'var(--green)' : 'var(--border)'}`, background: entry.settled ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {entry.settled ? '✓' : ''}
        </button>
        <span style={{ fontSize: 12, color: 'var(--dim)', flexShrink: 0, width: 82 }}>{entry.date}</span>
        <span style={{ flex: 1, fontSize: 13, color: entry.settled ? 'var(--dim)' : 'var(--text)', textDecoration: entry.settled ? 'line-through' : 'none' }}>
          {entry.description || <span style={{ color: 'var(--dim)' }}>—</span>}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: entry.amount >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
          {entry.amount >= 0 ? '+' : '−'}{euro(Math.abs(entry.amount))}
        </span>
        {entry.reasoning && (
          <button onClick={() => setOpen(o => !o)} title="Berekening tonen"
            style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--muted)', padding: '0 2px' }}>
            {open ? '▾' : '▸'}
          </button>
        )}
        <button onClick={() => onDelete(entry.id)} title="Verwijderen"
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#64748b', padding: '0 2px', lineHeight: 1 }}
          onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
          onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
          🗑
        </button>
      </div>
      {open && entry.reasoning && (
        <div style={{ marginLeft: 25, marginTop: 6, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 6, fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace', lineHeight: 1.6 }}>
          {entry.reasoning}
        </div>
      )}
    </div>
  )
}

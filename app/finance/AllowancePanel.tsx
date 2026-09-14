'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { inputStyle } from '../PageForm'
import type { AllowanceEntry, AllowanceGoal } from '@/lib/types'

function euro(n: number): string {
  return n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
}

const DEFAULT_CHILDREN = ['Robin', 'Sam']

export default function AllowancePanel({ userId, entries, setEntries, goals, setGoals }: {
  userId: string
  entries: AllowanceEntry[]
  setEntries: React.Dispatch<React.SetStateAction<AllowanceEntry[]>>
  goals: AllowanceGoal[]
  setGoals: React.Dispatch<React.SetStateAction<AllowanceGoal[]>>
}) {
  const supabase = createClient()
  const children = useMemo(() => {
    const set = new Set(DEFAULT_CHILDREN)
    for (const e of entries) set.add(e.child)
    for (const g of goals) set.add(g.child)
    return [...set]
  }, [entries, goals])

  async function addEntry(child: string, amount: number, description: string) {
    const todayStr = new Date().toISOString().slice(0, 10)
    const { data } = await supabase.from('allowance_entries').insert({
      user_id: userId, child, amount, description: description.trim(), date: todayStr,
    }).select('*').single()
    if (data) setEntries(prev => [data as AllowanceEntry, ...prev])
  }

  async function deleteEntry(id: number) {
    const prev = entries
    setEntries(p => p.filter(e => e.id !== id))
    const { error } = await supabase.from('allowance_entries').delete().eq('id', id).eq('user_id', userId)
    if (error) setEntries(prev)
  }

  async function addGoal(child: string, title: string, url: string, targetAmount: number | null) {
    const { data } = await supabase.from('allowance_goals').insert({
      user_id: userId, child, title: title.trim(), url: url.trim() || null, target_amount: targetAmount,
    }).select('*').single()
    if (data) setGoals(prev => [data as AllowanceGoal, ...prev])
  }

  async function toggleGoalAchieved(goal: AllowanceGoal) {
    const achieved = !goal.achieved
    const prev = goals
    setGoals(p => p.map(g => g.id === goal.id ? { ...g, achieved } : g))
    const { error } = await supabase.from('allowance_goals').update({ achieved }).eq('id', goal.id).eq('user_id', userId)
    if (error) setGoals(prev)
  }

  async function deleteGoal(id: number) {
    const prev = goals
    setGoals(p => p.filter(g => g.id !== id))
    const { error } = await supabase.from('allowance_goals').delete().eq('id', id).eq('user_id', userId)
    if (error) setGoals(prev)
  }

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {children.map(child => (
        <ChildCard key={child} child={child}
          entries={entries.filter(e => e.child === child)}
          goals={goals.filter(g => g.child === child)}
          onAddEntry={addEntry} onDeleteEntry={deleteEntry}
          onAddGoal={addGoal} onToggleGoal={toggleGoalAchieved} onDeleteGoal={deleteGoal} />
      ))}
    </div>
  )
}

function ChildCard({ child, entries, goals, onAddEntry, onDeleteEntry, onAddGoal, onToggleGoal, onDeleteGoal }: {
  child: string
  entries: AllowanceEntry[]
  goals: AllowanceGoal[]
  onAddEntry: (child: string, amount: number, description: string) => void
  onDeleteEntry: (id: number) => void
  onAddGoal: (child: string, title: string, url: string, targetAmount: number | null) => void
  onToggleGoal: (goal: AllowanceGoal) => void
  onDeleteGoal: (id: number) => void
}) {
  const [amountStr, setAmountStr] = useState('')
  const [sign, setSign] = useState<'plus' | 'min'>('plus')
  const [description, setDescription] = useState('')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalUrl, setGoalUrl] = useState('')
  const [goalTarget, setGoalTarget] = useState('')

  const balance = entries.reduce((s, e) => s + e.amount, 0)
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const parsedAmount = Number(amountStr.replace(',', '.'))

  function submitEntry() {
    if (!parsedAmount) return
    onAddEntry(child, sign === 'plus' ? Math.abs(parsedAmount) : -Math.abs(parsedAmount), description)
    setAmountStr(''); setDescription('')
  }

  function submitGoal() {
    if (!goalTitle.trim()) return
    const parsedTarget = goalTarget ? Number(goalTarget.replace(',', '.')) : null
    onAddGoal(child, goalTitle, goalUrl, parsedTarget && Number.isFinite(parsedTarget) ? parsedTarget : null)
    setGoalTitle(''); setGoalUrl(''); setGoalTarget('')
  }

  return (
    <div style={{ flex: '1 1 320px', minWidth: 300, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700 }}>{child}</h2>
        <span style={{ fontSize: 18, fontWeight: 700, color: balance >= 0 ? 'var(--green)' : 'var(--red)' }}>{euro(balance)}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button onClick={() => setSign('plus')}
          style={{ flex: 1, fontSize: 11, fontWeight: 600, padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
            background: sign === 'plus' ? 'rgba(63,185,80,.15)' : 'var(--bg3)',
            border: `1px solid ${sign === 'plus' ? 'var(--green)' : 'var(--border)'}`,
            color: sign === 'plus' ? 'var(--green)' : 'var(--muted)' }}>
          + erbij
        </button>
        <button onClick={() => setSign('min')}
          style={{ flex: 1, fontSize: 11, fontWeight: 600, padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
            background: sign === 'min' ? 'rgba(248,113,113,.15)' : 'var(--bg3)',
            border: `1px solid ${sign === 'min' ? 'var(--red)' : 'var(--border)'}`,
            color: sign === 'min' ? 'var(--red)' : 'var(--muted)' }}>
          − uitgegeven
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={amountStr} onChange={e => setAmountStr(e.target.value)} inputMode="decimal" placeholder="0,00"
          style={{ ...inputStyle, width: 70 }} />
        <input value={description} onChange={e => setDescription(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitEntry() }}
          placeholder="Waarvoor? (optioneel)" style={{ ...inputStyle, flex: 1 }} />
        <button onClick={submitEntry} disabled={!parsedAmount}
          style={{ fontSize: 13, fontWeight: 700, padding: '0 14px', borderRadius: 6, border: 'none',
            background: parsedAmount ? 'var(--accent)' : 'var(--bg4)', color: '#fff',
            cursor: parsedAmount ? 'pointer' : 'default', flexShrink: 0 }}>
          +
        </button>
      </div>

      {sorted.length > 0 && (
        <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 14 }}>
          {sorted.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <span style={{ fontSize: 11, color: 'var(--dim)', flexShrink: 0, width: 68 }}>{e.date}</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {e.description || <span style={{ color: 'var(--dim)' }}>—</span>}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: e.amount >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                {e.amount >= 0 ? '+' : '−'}{euro(Math.abs(e.amount))}
              </span>
              <button onClick={() => onDeleteEntry(e.id)} title="Verwijderen"
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#64748b', padding: '0 2px', lineHeight: 1 }}
                onMouseEnter={ev => ev.currentTarget.style.color = '#f87171'}
                onMouseLeave={ev => ev.currentTarget.style.color = '#64748b'}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>
        Spaardoelen
      </div>
      {goals.length === 0 && <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 10 }}>Nog geen spaardoel.</div>}
      {goals.map(g => {
        const pct = g.target_amount ? Math.max(0, Math.min(100, Math.round(balance / g.target_amount * 100))) : null
        return (
          <div key={g.id} style={{ marginBottom: 10, opacity: g.achieved ? 0.55 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => onToggleGoal(g)} title={g.achieved ? 'Terugzetten' : 'Markeer als gehaald'}
                style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                  border: `2px solid ${g.achieved ? 'var(--green)' : 'var(--border)'}`, background: g.achieved ? 'var(--green)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>
                {g.achieved ? '✓' : ''}
              </button>
              {g.url ? (
                <a href={g.url} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, fontSize: 12, color: 'var(--blue)', textDecoration: g.achieved ? 'line-through' : 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.title}
                </a>
              ) : (
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', textDecoration: g.achieved ? 'line-through' : 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.title}
                </span>
              )}
              {g.target_amount != null && <span style={{ fontSize: 11, color: 'var(--dim)', flexShrink: 0 }}>{euro(g.target_amount)}</span>}
              <button onClick={() => onDeleteGoal(g.id)} title="Verwijderen"
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#64748b', padding: '0 2px', lineHeight: 1 }}
                onMouseEnter={ev => ev.currentTarget.style.color = '#f87171'}
                onMouseLeave={ev => ev.currentTarget.style.color = '#64748b'}>
                🗑
              </button>
            </div>
            {pct !== null && (
              <div style={{ height: 4, borderRadius: 2, background: 'var(--bg3)', overflow: 'hidden', marginTop: 4, marginLeft: 23 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 2 }} />
              </div>
            )}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input value={goalTitle} onChange={e => setGoalTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitGoal() }}
          placeholder="Nieuw spaardoel…" style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '5px 8px' }} />
        <input value={goalUrl} onChange={e => setGoalUrl(e.target.value)} placeholder="Link (optioneel)" style={{ ...inputStyle, width: 90, fontSize: 11, padding: '5px 8px' }} />
        <input value={goalTarget} onChange={e => setGoalTarget(e.target.value)} inputMode="decimal" placeholder="€" style={{ ...inputStyle, width: 50, fontSize: 11, padding: '5px 8px' }} />
        <button onClick={submitGoal} disabled={!goalTitle.trim()}
          style={{ fontSize: 13, fontWeight: 700, padding: '0 12px', borderRadius: 6, border: 'none',
            background: goalTitle.trim() ? 'var(--accent)' : 'var(--bg4)', color: '#fff',
            cursor: goalTitle.trim() ? 'pointer' : 'default', flexShrink: 0 }}>
          +
        </button>
      </div>
    </div>
  )
}

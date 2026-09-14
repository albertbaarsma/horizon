'use client'
import { useEffect, useState } from 'react'
import type { LifeReport } from '@/lib/types'
import type { Lang } from '@/lib/lang'
import { ApiKeyNotice } from '@/app/ApiKeyNotice'

function periodLabel(r: LifeReport): string {
  const start = new Date(r.period_start + 'T12:00:00')
  const end   = new Date(r.period_end + 'T12:00:00')
  if (r.kind === 'month') return start.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
  const fmt = (d: Date) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function ReportTab({ lang = 'nl' }: { lang?: Lang } = {}) {
  const [reports,    setReports]    = useState<LifeReport[] | null>(null)
  const [generating, setGenerating] = useState<'week' | 'month' | null>(null)
  const [error,      setError]      = useState('')
  const [speakingId, setSpeakingId] = useState<number | null>(null)

  useEffect(() => {
    load()
    return () => { if (typeof window !== 'undefined') window.speechSynthesis?.cancel() }
  }, [])

  async function load() {
    const res  = await fetch('/api/reports')
    const data = await res.json() as { reports?: LifeReport[] }
    setReports(data.reports ?? [])
  }

  async function generate(kind: 'week' | 'month') {
    setGenerating(kind); setError('')
    try {
      const res  = await fetch('/api/reports/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }),
      })
      const data = await res.json() as { report?: LifeReport; error?: string }
      if (!res.ok || data.error) { setError(data.error || 'Kon het rapport niet genereren'); return }
      if (data.report) setReports(prev => [data.report!, ...(prev ?? [])])
    } finally {
      setGenerating(null)
    }
  }

  function speak(report: LifeReport) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    if (speakingId === report.id) { setSpeakingId(null); return }
    const utter = new SpeechSynthesisUtterance(report.content)
    utter.lang = 'nl-NL'
    utter.onend = () => setSpeakingId(null)
    utter.onerror = () => setSpeakingId(null)
    setSpeakingId(report.id)
    window.speechSynthesis.speak(utter)
  }

  if (reports === null) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>Rapporten laden…</div>
  }

  const latestWeek  = reports.find(r => r.kind === 'week')
  const latestMonth = reports.find(r => r.kind === 'month')
  const history     = reports.filter(r => r.id !== latestWeek?.id && r.id !== latestMonth?.id)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px', overflowY: 'auto', height: '100%' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>🎧 Rapport</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
        Automatisch elke week (zondagavond) en elke maand — een eerlijk verhaal over hoe het gaat, wat je hebt neergezet, en wat de vervolgstap is. Druk op voorlezen om het onderweg te beluisteren.
      </p>
      {error && <div style={{ marginBottom: 14 }}><ApiKeyNotice error={error} lang={lang} /></div>}

      <ReportCard title="Deze week" kind="week" report={latestWeek}
        generating={generating === 'week'} onGenerate={() => generate('week')}
        speaking={!!latestWeek && speakingId === latestWeek.id} onSpeak={() => latestWeek && speak(latestWeek)} />

      <ReportCard title="Deze maand" kind="month" report={latestMonth}
        generating={generating === 'month'} onGenerate={() => generate('month')}
        speaking={!!latestMonth && speakingId === latestMonth.id} onSpeak={() => latestMonth && speak(latestMonth)} />

      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 10 }}>
            Eerdere rapporten
          </div>
          {history.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--dim)', width: 20, flexShrink: 0 }}>{r.kind === 'week' ? '📅' : '🗓'}</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{periodLabel(r)}</span>
              <button onClick={() => speak(r)}
                style={{ fontSize: 11, color: speakingId === r.id ? 'var(--accent)' : 'var(--muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>
                {speakingId === r.id ? '⏹ Stop' : '🎧 Voorlezen'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportCard({ title, kind, report, generating, onGenerate, speaking, onSpeak }: {
  title: string
  kind: 'week' | 'month'
  report?: LifeReport
  generating: boolean
  onGenerate: () => void
  speaking: boolean
  onSpeak: () => void
}) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{title}{report ? ` — ${periodLabel(report)}` : ''}</h2>
        {report && (
          <button onClick={onSpeak}
            style={{ fontSize: 11, fontWeight: 600, color: speaking ? '#fff' : '#a5b4fc', background: speaking ? 'var(--accent)' : 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.4)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', flexShrink: 0 }}>
            {speaking ? '⏹ Stop' : '🎧 Voorlezen'}
          </button>
        )}
        <button onClick={onGenerate} disabled={generating}
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: generating ? 'default' : 'pointer', flexShrink: 0 }}>
          {generating ? '…' : '↻ Nu genereren'}
        </button>
      </div>
      {report ? (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{report.content}</p>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--dim)', textAlign: 'center', padding: '20px 0' }}>
          Nog geen {kind === 'week' ? 'weekrapport' : 'maandrapport'}. Klik op &quot;Nu genereren&quot; of wacht tot {kind === 'week' ? 'zondagavond' : 'het begin van de maand'}.
        </div>
      )}
    </div>
  )
}

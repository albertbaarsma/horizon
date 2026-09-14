'use client'
import { useState, useEffect } from 'react'
import type { MailSummary } from '@/app/api/gmail/summarize/route'
import type { Project } from '@/lib/types'

const PRIORITY_COLOR = { high: '#f85149', medium: '#d29922', low: '#484f58' }
const PRIORITY_LABEL = { high: '🔴 Urgent', medium: '🟡 Medium', low: '⚪ Laag' }
const CAT_ICON: Record<string, string> = {
  actie: '⚡', info: 'ℹ️', nieuwsbrief: '📰', financieel: '💶', werk: '💼', persoonlijk: '👤',
}

function fmtDate(raw: string) {
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return raw
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / 3600_000
    if (diff < 1) return 'Zojuist'
    if (diff < 24) return `${Math.floor(diff)}u geleden`
    if (diff < 48) return 'Gisteren'
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  } catch { return raw }
}

interface Props {
  projects: Project[]
  onCreateTask: (projId: string, name: string) => Promise<void>
}

export function MailTab({ projects, onCreateTask }: Props) {
  const [data, setData]           = useState<MailSummary[] | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [aiError, setAiError]     = useState<string | null>(null)
  const [filter, setFilter]       = useState<'all' | 'actie' | 'high'>('all')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [taskProjId, setTaskProjId] = useState<Record<string, string>>({})
  const [creatingTask, setCreatingTask] = useState<string | null>(null)
  const [taskDone, setTaskDone]   = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    fetch('/api/gmail/summarize')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else { setData(d.messages ?? []); setAiError(d.aiError ?? null) }
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const refresh = () => {
    setLoading(true); setData(null); setError(null); setAiError(null)
    fetch('/api/gmail/summarize')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setData(d.messages ?? []); setAiError(d.aiError ?? null) } })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:60, gap:16, color:'#64748b' }}>
      <div style={{ fontSize:32 }}>✉️</div>
      <div style={{ fontSize:13 }}>Mails ophalen en analyseren…</div>
      <div style={{ fontSize:11, color:'#374151' }}>AI leest je inbox</div>
    </div>
  )

  if (error) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:60, gap:12, color:'#64748b' }}>
      <div style={{ fontSize:32 }}>📭</div>
      <div style={{ fontSize:14, fontWeight:600, color:'#f85149' }}>Fout bij ophalen mails</div>
      <div style={{ fontSize:12, maxWidth:320, textAlign:'center' }}>{error}</div>
      {error.includes('verbonden') && (
        <a href="/login" style={{ fontSize:12, padding:'7px 16px', background:'#6366f1', color:'#fff', borderRadius:6, textDecoration:'none', fontWeight:600 }}>
          Opnieuw verbinden met Google
        </a>
      )}
    </div>
  )

  if (!data?.length) return (
    <div style={{ textAlign:'center', padding:60, color:'#64748b' }}>
      <div style={{ fontSize:32, marginBottom:12 }}>📭</div>
      <div>Geen ongelezen mails gevonden.</div>
    </div>
  )

  const filtered = data.filter(m => {
    if (filter === 'actie') return m.actionRequired
    if (filter === 'high') return m.priority === 'high'
    return true
  })

  const highCount   = data.filter(m => m.priority === 'high').length
  const actieCount  = data.filter(m => m.actionRequired).length

  return (
    <div style={{ maxWidth:720 }}>
      {/* AI analysis warning */}
      {aiError && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, padding:'8px 12px', borderRadius:8, background:'rgba(234,179,8,.08)', border:'1px solid rgba(234,179,8,.25)', color:'#d29922', fontSize:12 }}>
          <span>⚠️</span>
          <span style={{ flex:1 }}>{aiError} — sommige mails hebben geen AI-samenvatting.</span>
          <button onClick={() => setAiError(null)} style={{ background:'none', border:'none', color:'#d29922', cursor:'pointer', fontSize:14, lineHeight:1 }}>×</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <h2 style={{ fontSize:14, fontWeight:700, color:'#e2e8f0', margin:0 }}>
          ✉️ Inbox ({data.length} ongelezen)
        </h2>
        <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {(['all','actie','high'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize:11, padding:'4px 10px', borderRadius:5, cursor:'pointer',
              background: filter===f ? 'rgba(99,102,241,.25)' : 'transparent',
              border: filter===f ? '1px solid rgba(99,102,241,.5)' : '1px solid rgba(255,255,255,.1)',
              color: filter===f ? '#818cf8' : '#64748b',
            }}>
              {f==='all' ? `Alles (${data.length})` : f==='actie' ? `⚡ Actie (${actieCount})` : `🔴 Urgent (${highCount})`}
            </button>
          ))}
          <button onClick={refresh} style={{ fontSize:11, padding:'4px 10px', borderRadius:5, border:'1px solid rgba(255,255,255,.1)', background:'transparent', color:'#64748b', cursor:'pointer' }}>
            ↻ Verversen
          </button>
        </div>
      </div>

      {/* Mail list */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.map(m => {
          const isOpen = expanded === m.id
          const isDone = taskDone.has(m.id)
          const suggestedProjId = m.suggestedProject
            ? projects.find(p => p.name.toLowerCase() === m.suggestedProject!.toLowerCase())?.id
              ?? projects.find(p => p.name.toLowerCase().includes(m.suggestedProject!.toLowerCase()) || m.suggestedProject!.toLowerCase().includes(p.name.toLowerCase()))?.id
            : undefined
          const selProj = taskProjId[m.id] ?? suggestedProjId ?? projects[0]?.id ?? ''

          return (
            <div key={m.id} style={{
              background: 'rgba(255,255,255,.035)',
              borderTop:    `1px solid ${isOpen ? 'rgba(99,102,241,.35)' : 'rgba(255,255,255,.07)'}`,
              borderRight:  `1px solid ${isOpen ? 'rgba(99,102,241,.35)' : 'rgba(255,255,255,.07)'}`,
              borderBottom: `1px solid ${isOpen ? 'rgba(99,102,241,.35)' : 'rgba(255,255,255,.07)'}`,
              borderLeft:   `3px solid ${PRIORITY_COLOR[m.priority]}`,
              borderRadius: 9, overflow:'hidden', transition:'all .15s',
            }}>
              {/* Header row */}
              <div
                onClick={() => setExpanded(isOpen ? null : m.id)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer' }}
              >
                <span style={{ fontSize:14, flexShrink:0 }} title={m.category}>{CAT_ICON[m.category] ?? '📧'}</span>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {m.subject}
                  </div>
                  <div style={{ fontSize:11, color:'#64748b', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {m.fromName} · {fmtDate(m.date)}
                  </div>
                </div>

                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  {m.actionRequired && (
                    <span style={{ fontSize:9, fontWeight:700, color:'#f59e0b', border:'1px solid rgba(245,158,11,.3)', padding:'2px 5px', borderRadius:3 }}>
                      ACTIE
                    </span>
                  )}
                  <span style={{ fontSize:10, color: PRIORITY_COLOR[m.priority] }}>
                    {PRIORITY_LABEL[m.priority].split(' ')[0]}
                  </span>
                  <span style={{ color:'#374151', fontSize:12 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* AI one-liner (always visible) */}
              {!isOpen && (
                <div style={{ padding:'0 14px 10px 38px', fontSize:11, color:'#64748b', lineHeight:1.5 }}>
                  {m.oneLiner}
                </div>
              )}

              {/* Expanded view */}
              {isOpen && (
                <div style={{ borderTop:'1px solid rgba(255,255,255,.06)', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
                  {/* AI summary */}
                  <div style={{ padding:'10px 12px', background:'rgba(99,102,241,.07)', border:'1px solid rgba(99,102,241,.15)', borderRadius:6 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#6366f1', marginBottom:4, letterSpacing:'.05em' }}>AI SAMENVATTING</div>
                    <div style={{ fontSize:12, color:'#c7d2fe', lineHeight:1.6 }}>{m.oneLiner}</div>
                  </div>

                  {/* Raw snippet */}
                  <div style={{ fontSize:11, color:'#475569', lineHeight:1.6, fontStyle:'italic' }}>
                    &ldquo;{m.snippet}&rdquo;
                  </div>

                  {/* Suggested task */}
                  {m.suggestedTask && !isDone && (
                    <div style={{ padding:'10px 12px', background:'rgba(251,191,36,.06)', border:'1px solid rgba(251,191,36,.2)', borderRadius:6 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#fbbf24', marginBottom:6, letterSpacing:'.05em' }}>⚡ VOORGESTELDE TAAK</div>
                      <div style={{ fontSize:12, color:'#fde68a', marginBottom:8 }}>{m.suggestedTask}</div>
                      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                        <select
                          value={selProj}
                          onChange={e => setTaskProjId(prev => ({ ...prev, [m.id]: e.target.value }))}
                          style={{ fontSize:11, padding:'4px 8px', background:'#0d1117', border:'1px solid rgba(255,255,255,.15)', color:'#e2e8f0', borderRadius:5, flex:1, minWidth:120 }}
                        >
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                          ))}
                        </select>
                        <button
                          disabled={creatingTask === m.id}
                          onClick={async () => {
                            if (!selProj) return
                            setCreatingTask(m.id)
                            await onCreateTask(selProj, m.suggestedTask!)
                            setCreatingTask(null)
                            setTaskDone(prev => new Set([...prev, m.id]))
                          }}
                          style={{
                            fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:5, cursor: creatingTask===m.id ? 'default' : 'pointer',
                            background: creatingTask===m.id ? 'rgba(99,102,241,.1)' : 'rgba(99,102,241,.25)',
                            border:'1px solid rgba(99,102,241,.4)', color:'#818cf8',
                          }}
                        >
                          {creatingTask === m.id ? '…' : '＋ Taak aanmaken'}
                        </button>
                      </div>
                    </div>
                  )}
                  {m.suggestedTask && isDone && (
                    <div style={{ fontSize:11, color:'#4ade80', padding:'6px 10px', background:'rgba(74,222,128,.06)', border:'1px solid rgba(74,222,128,.15)', borderRadius:5 }}>
                      ✓ Taak aangemaakt
                    </div>
                  )}

                  {/* Open in Gmail */}
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${m.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize:11, color:'#64748b', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4 }}
                  >
                    📧 Openen in Gmail ↗
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:32, color:'#64748b', fontSize:13 }}>
          Geen mails in dit filter.
        </div>
      )}
    </div>
  )
}

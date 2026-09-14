'use client'
import { useState } from 'react'
import type { Category, GoalHorizon } from '@/lib/types'
import {
  SETUP_STEPS, type SetupStep, STARTER_AREAS,
  parseRoutineLines, parseGoalLines, type RoutineProposal, type GoalProposal,
} from '@/lib/onboarding'
import { DAY_LABELS_NL, DAY_KEYS, formatMinutes } from '@/lib/routine-hours'

/**
 * Startgesprek voor nieuwe gebruikers: een korte reeks vragen die Horizon
 * meteen vult. Alles is over te slaan en later aan te vullen — het belangrijkste
 * zijn de wekelijkse taken en de doelen.
 */
export function SetupWizard({
  categories, aiToken, startStep = 0,
  onCreateAreas, onCreateGoals, onCreateRoutines, onSaveVisionLink,
  onStepChange, onFinish, onClose,
}: {
  categories: Pick<Category, 'id' | 'name'>[]
  aiToken?: string | null
  startStep?: number
  onCreateAreas:    (areas: { id: string; name: string }[]) => Promise<void>
  onCreateGoals:    (goals: GoalProposal[], catId: string | null) => Promise<void>
  onCreateRoutines: (routines: RoutineProposal[], catId: string | null) => Promise<void>
  onSaveVisionLink: (link: string) => Promise<void>
  onStepChange:     (step: number) => void
  onFinish:         () => Promise<void>
  onClose:          () => void
}) {
  const [stepIdx, setStepIdx] = useState(Math.min(startStep, SETUP_STEPS.length - 1))
  const [busy, setBusy]       = useState(false)
  const step: SetupStep = SETUP_STEPS[stepIdx]

  // per stap
  const [visionLink, setVisionLink] = useState('')
  const [pickedAreas, setPickedAreas] = useState<string[]>(STARTER_AREAS.map(a => a.id))
  const [goalText, setGoalText]     = useState('')
  const [goalHorizon, setGoalHorizon] = useState<GoalHorizon>('kwartaal')
  const [routineText, setRoutineText] = useState('')
  const [routineDays, setRoutineDays] = useState<Record<number, string[]>>({})
  const [tokenShown, setTokenShown]   = useState(false)
  const [created, setCreated] = useState({ areas: 0, goals: 0, routines: 0 })

  const hasAreas   = categories.length > 0
  const goals      = parseGoalLines(goalText, goalHorizon)
  const routines   = parseRoutineLines(routineText)
  const firstCat   = categories[0]?.id ?? null

  function go(delta: number) {
    const next = Math.max(0, Math.min(SETUP_STEPS.length - 1, stepIdx + delta))
    setStepIdx(next)
    onStepChange(next)
  }

  async function withBusy(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const totalSteps = SETUP_STEPS.length

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9800, background:'rgba(3,5,12,.85)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'clamp(12px,4vh,48px) 16px', overflowY:'auto' }}>
      <div role="dialog" aria-label="Startgesprek"
        style={{ width:'min(620px,100%)', background:'#0b0f1a', border:'1px solid rgba(99,102,241,.3)', borderRadius:16, boxShadow:'0 40px 100px rgba(0,0,0,.7)', overflow:'hidden' }}>

        {/* Voortgang */}
        <div style={{ padding:'16px 22px 12px', borderBottom:'1px solid rgba(99,102,241,.15)', background:'linear-gradient(135deg,rgba(99,102,241,.18),rgba(11,15,26,.9))' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'#818cf8' }}>
              Welkom bij Horizon
            </span>
            <span style={{ fontSize:10, color:'#64748b' }}>stap {stepIdx + 1} van {totalSteps}</span>
            <button onClick={onClose} aria-label="Sluiten"
              style={{ marginLeft:'auto', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', color:'#94a3b8', cursor:'pointer', fontSize:13, padding:'3px 9px', borderRadius:7 }}>
              Later
            </button>
          </div>
          <div style={{ display:'flex', gap:3 }}>
            {SETUP_STEPS.map((s, i) => (
              <div key={s} style={{ flex:1, height:3, borderRadius:99, background: i <= stepIdx ? 'linear-gradient(90deg,#6366f1,#a855f7)' : 'rgba(255,255,255,.08)' }} />
            ))}
          </div>
        </div>

        <div style={{ padding:'20px 22px 24px' }}>

          {/* ── 1. Welkom ─────────────────────────────────────────────────── */}
          {step === 'welkom' && (
            <Step title="Even kort kennismaken" intro="Horizon wordt jouw plek voor doelen, week­planning en reflectie. Ik stel een paar vragen zodat je niet met een leeg scherm begint.">
              <ul style={{ fontSize:13, color:'#cbd5e1', lineHeight:1.8, paddingLeft:20, margin:0 }}>
                <li>Elke vraag mag je <strong>overslaan</strong> — later aanvullen kan altijd.</li>
                <li>Het belangrijkste: <strong>wat komt er elke week terug</strong> en <strong>waar wil je aan werken</strong>.</li>
                <li>Je hoeft niets perfect te doen. Eén regel is al genoeg om te beginnen.</li>
              </ul>
            </Step>
          )}

          {/* ── 2. Visie-document ─────────────────────────────────────────── */}
          {step === 'visie' && (
            <Step title="Heb je al ergens een visie of levensplan?" intro="Bijvoorbeeld een document in Google Drive of Notion. Zo ja, plak de link — dan staat hij bij de hand. Nog niet? Sla dit gewoon over.">
              <input value={visionLink} onChange={e => setVisionLink(e.target.value)}
                placeholder="https://docs.google.com/…"
                style={inputStyle} />
              {visionLink.trim() && (
                <button disabled={busy} onClick={() => withBusy(async () => { await onSaveVisionLink(visionLink.trim()); go(1) })}
                  style={primaryBtn}>Link bewaren en verder</button>
              )}
            </Step>
          )}

          {/* ── 3. Levensgebieden ─────────────────────────────────────────── */}
          {step === 'gebieden' && (
            <Step
              title="Welke levensgebieden wil je bijhouden?"
              intro={hasAreas
                ? 'Je hebt al gebieden staan — je kunt dit overslaan.'
                : 'Doelen, projecten en vaardigheden hangen hieronder. Kies wat past; je kunt later hernoemen en aanvullen.'}>
              {hasAreas ? (
                <div style={{ fontSize:13, color:'#94a3b8' }}>
                  Huidige gebieden: {categories.map(c => c.name).join(' · ')}
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                    {STARTER_AREAS.map(a => {
                      const on = pickedAreas.includes(a.id)
                      return (
                        <button key={a.id} aria-pressed={on}
                          onClick={() => setPickedAreas(p => on ? p.filter(x => x !== a.id) : [...p, a.id])}
                          style={{ fontSize:12, padding:'6px 12px', borderRadius:99, cursor:'pointer',
                            background: on ? 'rgba(99,102,241,.2)' : 'transparent',
                            border:`1px solid ${on ? 'rgba(99,102,241,.5)' : 'var(--border)'}`,
                            color: on ? '#a5b4fc' : '#94a3b8' }}>
                          {on ? '✓ ' : ''}{a.name}
                        </button>
                      )
                    })}
                  </div>
                  {pickedAreas.length > 0 && (
                    <button disabled={busy} onClick={() => withBusy(async () => {
                      const chosen = STARTER_AREAS.filter(a => pickedAreas.includes(a.id))
                      await onCreateAreas(chosen.map(a => ({ id: a.id, name: a.name })))
                      setCreated(c => ({ ...c, areas: chosen.length }))
                      go(1)
                    })} style={primaryBtn}>
                      {pickedAreas.length} gebieden aanmaken
                    </button>
                  )}
                </>
              )}
            </Step>
          )}

          {/* ── 4. Doelen ─────────────────────────────────────────────────── */}
          {step === 'doelen' && (
            <Step title="Waar wil je aan werken?" intro="Eén doel per regel, in je eigen woorden. Denk aan de komende maanden — niet je hele leven.">
              <textarea value={goalText} onChange={e => setGoalText(e.target.value)} rows={4}
                placeholder={'10 optredens spelen\nFitter worden\nDe zolder afmaken'}
                style={{ ...inputStyle, resize:'vertical', lineHeight:1.6 }} />
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, color:'var(--dim)' }}>Termijn:</span>
                {(['wk','6w','kwartaal','jaar'] as GoalHorizon[]).map(h => (
                  <button key={h} onClick={() => setGoalHorizon(h)} aria-pressed={goalHorizon === h}
                    style={{ fontSize:11, padding:'3px 10px', borderRadius:99, cursor:'pointer',
                      background: goalHorizon === h ? 'rgba(99,102,241,.2)' : 'transparent',
                      border:`1px solid ${goalHorizon === h ? 'rgba(99,102,241,.5)' : 'var(--border)'}`,
                      color: goalHorizon === h ? '#a5b4fc' : '#94a3b8' }}>
                    {h === 'wk' ? 'deze week' : h === '6w' ? '6 weken' : h === 'kwartaal' ? 'kwartaal' : 'dit jaar'}
                  </button>
                ))}
              </div>
              {goals.length > 0 && (
                <>
                  <Preview label={`${goals.length} ${goals.length === 1 ? 'doel' : 'doelen'}`}>
                    {goals.map((g, i) => <li key={i}>{g.text}</li>)}
                  </Preview>
                  <button disabled={busy} onClick={() => withBusy(async () => {
                    await onCreateGoals(goals, firstCat)
                    setCreated(c => ({ ...c, goals: goals.length }))
                    setGoalText('')
                    go(1)
                  })} style={primaryBtn}>Doelen toevoegen</button>
                </>
              )}
            </Step>
          )}

          {/* ── 5. Wekelijkse taken ───────────────────────────────────────── */}
          {step === 'routines' && (
            <Step
              title="Wat komt er elke week terug?"
              intro="Dit is het belangrijkste. Noem de dag en eventueel hoe lang — bijvoorbeeld “sportschool ma do 60m”. Eén per regel.">
              <textarea value={routineText} onChange={e => { setRoutineText(e.target.value); setRoutineDays({}) }} rows={4}
                placeholder={'sportschool maandag en donderdag 60m\nboodschappen zaterdag\nmediteren elke dag 15m'}
                style={{ ...inputStyle, resize:'vertical', lineHeight:1.6 }} />

              {routines.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--dim)' }}>
                    Zo ga ik het aanmaken — dagen kloppen niet? Klik ze aan.
                  </div>
                  {routines.map((r, i) => {
                    const days = routineDays[i] ?? r.days
                    return (
                      <div key={i} style={{ background:'rgba(255,255,255,.03)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <span style={{ fontSize:12, color:'#e2e8f0', flex:1 }}>{r.name}</span>
                          {r.duration_min != null && (
                            <span style={{ fontSize:10, color:'#a78bfa' }}>{formatMinutes(r.duration_min)}</span>
                          )}
                        </div>
                        <div style={{ display:'flex', gap:3 }}>
                          {DAY_KEYS.map((d, di) => {
                            const on = days.includes(d)
                            return (
                              <button key={d} aria-label={`${r.name} ${DAY_LABELS_NL[di]}`} aria-pressed={on}
                                onClick={() => setRoutineDays(prev => {
                                  const cur = prev[i] ?? r.days
                                  return { ...prev, [i]: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d] }
                                })}
                                style={{ flex:1, fontSize:9, padding:'3px 0', borderRadius:5, cursor:'pointer',
                                  background: on ? 'rgba(99,102,241,.25)' : 'var(--bg)',
                                  border:`1px solid ${on ? 'rgba(99,102,241,.5)' : 'var(--border)'}`,
                                  color: on ? '#a5b4fc' : 'var(--dim)' }}>
                                {DAY_LABELS_NL[di]}
                              </button>
                            )
                          })}
                        </div>
                        {days.length === 0 && (
                          <div style={{ fontSize:9, color:'#fb923c', marginTop:4 }}>Kies minstens één dag, anders sla ik deze over.</div>
                        )}
                      </div>
                    )
                  })}
                  <button disabled={busy} onClick={() => withBusy(async () => {
                    const withDays = routines
                      .map((r, i) => ({ ...r, days: routineDays[i] ?? r.days }))
                      .filter(r => r.days.length > 0)
                    if (withDays.length) {
                      await onCreateRoutines(withDays, firstCat)
                      setCreated(c => ({ ...c, routines: withDays.length }))
                    }
                    setRoutineText(''); setRoutineDays({})
                    go(1)
                  })} style={primaryBtn}>
                    Wekelijkse taken aanmaken
                  </button>
                </div>
              )}

              <div style={{ fontSize:11, color:'var(--dim)', lineHeight:1.6, borderTop:'1px solid var(--border)', paddingTop:10 }}>
                Liever laten doen? Sla deze stap over en zeg later tegen Horizon AI:
                <em> “mijn week: sportschool ma en do, boodschappen op zaterdag”</em> — dan zet hij het voor je klaar.
              </div>
            </Step>
          )}

          {/* ── 6. Koppelen aan Claude ────────────────────────────────────── */}
          {step === 'claude' && (
            <Step title="Horizon koppelen aan Claude" intro="Handig als je vanuit Claude (of een andere AI) je planning wilt lezen en bijwerken. Je hebt hiervoor je persoonlijke token nodig.">
              <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--dim)', marginBottom:6 }}>Jouw token</div>
                {aiToken ? (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <code style={{ flex:1, fontSize:11, color:'#a5b4fc', wordBreak:'break-all', fontFamily:'monospace' }}>
                      {tokenShown ? aiToken : '•'.repeat(Math.min(28, aiToken.length))}
                    </code>
                    <button onClick={() => setTokenShown(s => !s)}
                      style={{ fontSize:10, padding:'3px 9px', borderRadius:6, cursor:'pointer', background:'transparent', border:'1px solid var(--border)', color:'#94a3b8' }}>
                      {tokenShown ? 'verberg' : 'toon'}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize:12, color:'var(--dim)' }}>Nog geen token — die staat later bij Instellingen.</div>
                )}
                <div style={{ fontSize:10, color:'#fb923c', marginTop:7, lineHeight:1.5 }}>
                  Deel deze token met niemand: hij geeft toegang tot jouw gegevens.
                </div>
              </div>

              <div style={{ fontSize:12, color:'#cbd5e1', lineHeight:1.7 }}>
                Claude Desktop, Claude Code, of je eigen scripts — de stap-voor-stap gids laat per manier
                precies zien wat je moet plakken.
              </div>
              <a href="/ai-setup" style={{ fontSize:12, color:'#a5b4fc', fontWeight:600, textDecoration:'none' }}>
                Open de koppel-gids →
              </a>
              <div style={{ fontSize:11, color:'var(--dim)', lineHeight:1.6 }}>
                Je kunt dit ook later doen — de token blijft bij Instellingen staan. En de ingebouwde
                Horizon AI (het 🤖-knopje) werkt gewoon zonder deze koppeling.
              </div>
            </Step>
          )}

          {/* ── 7. Klaar ──────────────────────────────────────────────────── */}
          {step === 'klaar' && (
            <Step title="Je bent klaar om te beginnen" intro="Wat er nu staat, kun je altijd aanvullen of aanpassen.">
              <div style={{ display:'flex', flexDirection:'column', gap:5, fontSize:13, color:'#cbd5e1' }}>
                {created.areas    > 0 && <span>✓ {created.areas} levensgebieden aangemaakt</span>}
                {created.goals    > 0 && <span>✓ {created.goals} {created.goals === 1 ? 'doel' : 'doelen'} toegevoegd</span>}
                {created.routines > 0 && <span>✓ {created.routines} wekelijkse {created.routines === 1 ? 'taak' : 'taken'} ingesteld</span>}
                {created.areas + created.goals + created.routines === 0 && (
                  <span style={{ color:'var(--dim)' }}>Je hebt alles overgeslagen — helemaal goed. Je kunt zo beginnen met een lege week.</span>
                )}
              </div>
              <div style={{ fontSize:12, color:'var(--dim)', lineHeight:1.7, borderTop:'1px solid var(--border)', paddingTop:10 }}>
                Tips om verder te gaan:
                <ul style={{ paddingLeft:20, margin:'6px 0 0' }}>
                  <li>In <strong>Week</strong> plan je je dagen; herhaaltaken staan er automatisch in.</li>
                  <li>In <strong>Dagboek</strong> houd je bij hoe het met je gaat.</li>
                  <li>Vraag <strong>Horizon AI</strong> (🤖) om iets toe te voegen of je dag te plannen.</li>
                </ul>
              </div>
              <button disabled={busy} onClick={() => withBusy(async () => { await onFinish(); onClose() })}
                style={{ ...primaryBtn, background:'rgba(74,222,128,.18)', border:'1px solid rgba(74,222,128,.45)', color:'#4ade80' }}>
                Aan de slag
              </button>
            </Step>
          )}

          {/* Navigatie */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:20, paddingTop:14, borderTop:'1px solid var(--border)' }}>
            {stepIdx > 0 && (
              <button onClick={() => go(-1)}
                style={{ fontSize:12, padding:'7px 13px', borderRadius:8, cursor:'pointer', background:'transparent', border:'1px solid var(--border)', color:'#94a3b8' }}>
                ← Terug
              </button>
            )}
            {step !== 'klaar' && (
              <button onClick={() => go(1)}
                style={{ marginLeft:'auto', fontSize:12, padding:'7px 14px', borderRadius:8, cursor:'pointer', background:'rgba(255,255,255,.04)', border:'1px solid var(--border)', color:'#94a3b8' }}>
                {step === 'welkom' ? 'Beginnen →' : 'Overslaan →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── kleine bouwstenen ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width:'100%', boxSizing:'border-box', background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:8, color:'var(--text)', fontSize:13, padding:'9px 12px', outline:'none', fontFamily:'inherit',
}

const primaryBtn: React.CSSProperties = {
  alignSelf:'flex-start', fontSize:12, fontWeight:600, padding:'8px 16px', borderRadius:8, cursor:'pointer',
  background:'rgba(99,102,241,.2)', border:'1px solid rgba(99,102,241,.45)', color:'#a5b4fc',
}

function Step({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div>
        <h2 style={{ fontSize:17, fontWeight:700, color:'#f1f5f9', lineHeight:1.3 }}>{title}</h2>
        <p style={{ fontSize:12, color:'#94a3b8', lineHeight:1.6, marginTop:5 }}>{intro}</p>
      </div>
      {children}
    </div>
  )
}

function Preview({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background:'rgba(99,102,241,.05)', border:'1px solid rgba(99,102,241,.2)', borderRadius:8, padding:'8px 12px' }}>
      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', color:'#818cf8', marginBottom:4 }}>{label}</div>
      <ul style={{ fontSize:12, color:'#cbd5e1', lineHeight:1.7, paddingLeft:18, margin:0 }}>{children}</ul>
    </div>
  )
}

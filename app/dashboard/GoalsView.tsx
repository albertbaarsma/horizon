'use client'
// ─── GoalModal ──────────────────────────────────────────────────────────────
// Hetzelfde idee als ProjectModal (zie ProjectsView.tsx), maar dan voor een
// doel: Result, Why/Purpose, tijdlijn, notities, sub-doelen, de projecten uit
// hetzelfde levensgebied, en een vak voor geplakte HTML. Bewust dezelfde
// structuur — een doel en een project zijn allebei RPM in de kern.

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Goal, GoalHorizon, Category, Project } from '@/lib/types'
import { RpmSectionHead, extractNoteLinks } from './ProjectsView'
import { KIND_META, isHobbyGoal } from '@/lib/goal-kinds'
import { HORIZON_ORDER, HORIZON_META } from '@/lib/goal-horizons'
import { withOriginalDeadline, isDeadlinePostponed, effectiveHorizon } from '@/lib/deadline-horizon'
import { relatedProjectsFor } from '@/lib/goal-links'
import { beoordeelGoalUitwerking, goalUitwerkPrompt } from '@/lib/goal-depth'
import { CopyPromptButton } from './PromptButton'
import { Attachments } from './Attachments'

export function GoalModal({ goal, allGoals, categories, projects, userId, onUpdated, onTrash, onOpenGoal, onOpenProject, onClose }: {
  goal: Goal
  allGoals: Goal[]
  categories: Category[]
  projects: Project[]
  userId: string
  onUpdated?: (patch: Partial<Goal> & { id: number }) => void
  /** Weggooien loopt via dezelfde prullenbak als overal elders — geen apart hard-delete pad hier. */
  onTrash: (id: number) => void
  onOpenGoal?: (goal: Goal) => void
  onOpenProject?: (project: Project) => void
  onClose: () => void
}) {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [editText,  setEditText]  = useState(false)
  const [textDraft, setTextDraft] = useState(goal.text)
  const [result,  setResult]  = useState(goal.result ?? '')
  const [why,     setWhy]     = useState(goal.why ?? '')
  const [notes,   setNotes]   = useState(goal.notes ?? '')
  const [html,    setHtml]    = useState(goal.html_content ?? '')
  const [confirmDel, setConfirmDel] = useState(false)
  const [speaking,   setSpeaking]   = useState(false)
  const [uitwerkAf,  setUitwerkAf]  = useState(false)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  async function saveField(field: string, value: unknown) {
    const patch = field === 'deadline' ? withOriginalDeadline(goal, value as string | null) : { [field]: value }
    const { error } = await supabase.from('goals').update(patch).eq('id', goal.id).eq('user_id', userId)
    if (!error) onUpdated?.({ id: goal.id, ...patch } as Partial<Goal> & { id: number })
  }

  function schedSave(field: string, value: string, setter: (v: string) => void) {
    setter(value)
    clearTimeout(timers.current[field])
    timers.current[field] = setTimeout(() => saveField(field, value), 800)
  }

  function verwijderGoal() {
    onTrash(goal.id)
    onClose()
  }

  function speakGoal() {
    if (!window.speechSynthesis) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    const parts: string[] = [goal.text]
    if (result) parts.push('Result: ' + result)
    if (why)    parts.push('Why: ' + why)
    if (notes)  parts.push('Notities: ' + notes)
    const utt = new SpeechSynthesisUtterance(parts.join('. '))
    utt.lang = 'nl-NL'; utt.rate = 0.88
    const nl = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('nl'))
    if (nl) utt.voice = nl
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utt)
  }

  // Kandidaat-hoofddoelen: geen zichzelf, geen eigen sub-doelen (voorkomt cycli)
  const ownChildren  = new Set(allGoals.filter(g => g.parent_id === goal.id).map(g => g.id))
  const parentOpties = allGoals.filter(g => g.id !== goal.id && !ownChildren.has(g.id) && !g.deleted_at)
  const subGoals     = allGoals.filter(g => g.parent_id === goal.id && !g.deleted_at)
  const parentGoal   = goal.parent_id ? allGoals.find(g => g.id === goal.parent_id) : null
  const gerelateerd  = relatedProjectsFor(goal, projects)
  const uitwerking   = beoordeelGoalUitwerking(goal)
  const kind         = isHobbyGoal(goal) ? 'hobby' as const : 'doel' as const

  function fieldStyle(accent: string): React.CSSProperties {
    return {
      width:'100%', background:`${accent}08`, border:`1px solid ${accent}28`,
      borderRadius:8, color:'#e2e8f0', fontSize:13, padding:'10px 14px',
      resize:'vertical', lineHeight:1.65, outline:'none',
      fontFamily:'inherit', boxSizing:'border-box', transition:'border-color .15s',
    }
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9200, background:'rgba(0,0,0,.72)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(5px)', padding:'16px' }}>
      <div onClick={e => e.stopPropagation()}
        role="dialog" aria-label={`Doel: ${goal.text}`}
        style={{ background:'#0c1323', border:'1px solid rgba(99,102,241,.2)', borderRadius:14, width:'100%', maxWidth:840, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 72px rgba(0,0,0,.85)' }}>

        <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', gap:12, rowGap:10, flexWrap:'wrap', flexShrink:0, background:'rgba(255,255,255,.015)' }}>
          <div style={{ flex:'1 1 220px', minWidth:0 }}>
            {editText ? (
              <textarea autoFocus value={textDraft} onChange={e => setTextDraft(e.target.value)} aria-label="Doeltekst" rows={2}
                onBlur={() => { if (textDraft.trim() && textDraft.trim() !== goal.text) saveField('text', textDraft.trim()); setEditText(false) }}
                onKeyDown={e => { if (e.key === 'Escape') { setTextDraft(goal.text); setEditText(false) } }}
                style={{ fontSize:17, fontWeight:700, width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,.06)', border:'1px solid rgba(99,102,241,.4)', borderRadius:7, color:'#f1f5f9', outline:'none', padding:'4px 8px', fontFamily:'inherit', resize:'vertical' }} />
            ) : (
              <div onClick={() => { setTextDraft(goal.text); setEditText(true) }} title="Klik om te bewerken"
                style={{ fontSize:17, fontWeight:700, color:'#f1f5f9', lineHeight:1.3, cursor:'text' }}>
                {goal.done ? '✓ ' : ''}{goal.text}
              </div>
            )}
            <div style={{ display:'flex', gap:7, marginTop:7, alignItems:'center', flexWrap:'wrap' }}>
              <button onClick={() => saveField('kind', kind === 'hobby' ? 'doel' : 'hobby')} title="Wissel tussen doel en hobbydoel"
                style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:`${KIND_META[kind].color}18`, border:`1px solid ${KIND_META[kind].color}44`, color:KIND_META[kind].color, cursor:'pointer' }}>
                {KIND_META[kind].emoji} {KIND_META[kind].label.toLowerCase()}
              </button>
              <select value={effectiveHorizon(goal, today) ?? goal.horizon} onChange={e => saveField('horizon', e.target.value)} aria-label="Horizon"
                disabled={!!goal.deadline}
                title={goal.deadline ? 'Wordt automatisch bepaald door de deadline — wis de deadline om dit weer handmatig te zetten' : undefined}
                style={{ fontSize:10, padding:'2px 6px', borderRadius:10, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)', color: HORIZON_META[effectiveHorizon(goal, today) ?? goal.horizon].color, cursor: goal.deadline ? 'not-allowed' : 'pointer', outline:'none', opacity: goal.deadline ? .6 : 1 }}>
                {HORIZON_ORDER.map(h => (
                  <option key={h} value={h} style={{ background:'#0c1323', color:'#e2e8f0' }}>{HORIZON_META[h].icon} {HORIZON_META[h].label}</option>
                ))}
              </select>
              <select value={goal.cat_id ?? ''} onChange={e => saveField('cat_id', e.target.value || null)} aria-label="Levensgebied"
                style={{ fontSize:10, padding:'2px 6px', borderRadius:10, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)', color: goal.cat_id ? '#a5b4fc' : '#64748b', cursor:'pointer', outline:'none', maxWidth:150 }}>
                <option value="" style={{ background:'#0c1323', color:'#e2e8f0' }}>— geen gebied —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id} style={{ background:'#0c1323', color:'#e2e8f0' }}>{c.name}</option>
                ))}
              </select>
              <select value={goal.parent_id ?? ''} onChange={e => saveField('parent_id', e.target.value ? Number(e.target.value) : null)} aria-label="Hoofddoel"
                title="Koppel dit als sub-doel aan een hoofddoel"
                style={{ fontSize:10, padding:'2px 6px', borderRadius:10, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)', color: goal.parent_id ? '#a5b4fc' : '#64748b', cursor:'pointer', outline:'none', maxWidth:170 }}>
                <option value="" style={{ background:'#0c1323', color:'#e2e8f0' }}>↳ los doel</option>
                {parentOpties.map(g => (
                  <option key={g.id} value={g.id} style={{ background:'#0c1323', color:'#e2e8f0' }}>↳ onder &ldquo;{g.text.slice(0, 40)}&rdquo;</option>
                ))}
              </select>
              {parentGoal && onOpenGoal && (
                <button onClick={() => onOpenGoal(parentGoal)} title={`Open hoofddoel "${parentGoal.text}"`}
                  style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(99,102,241,.08)', border:'1px solid rgba(99,102,241,.25)', color:'#a5b4fc', cursor:'pointer' }}>
                  ↰ {parentGoal.text.slice(0, 30)}
                </button>
              )}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto' }}>
            <button onClick={speakGoal} title={speaking ? 'Stop' : 'Lees hardop'}
              style={{ background: speaking ? 'rgba(99,102,241,.15)' : 'none', border:`1px solid ${speaking ? '#818cf8' : 'rgba(255,255,255,.15)'}`, borderRadius:20, padding:'5px 14px', color: speaking ? '#c7d2fe' : '#94a3b8', cursor:'pointer', fontSize:12, transition:'all .15s', whiteSpace:'nowrap' }}>
              {speaking ? '⏹ Stop' : '🔊 Lees voor'}
            </button>
            {confirmDel ? (
              <span style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.35)', borderRadius:20, padding:'4px 10px' }}>
                <span style={{ fontSize:11, color:'#f87171', whiteSpace:'nowrap' }}>
                  Naar de prullenbak — terug te halen. Zeker?
                </span>
                <button onClick={verwijderGoal} aria-label="Naar de prullenbak"
                  style={{ fontSize:11, padding:'2px 10px', borderRadius:12, border:'none', background:'#b91c1c', color:'#fff', cursor:'pointer', fontWeight:700 }}>
                  Ja, weg
                </button>
                <button onClick={() => setConfirmDel(false)} aria-label="Verwijderen annuleren"
                  style={{ fontSize:11, padding:'2px 8px', borderRadius:12, border:'none', background:'none', color:'#94a3b8', cursor:'pointer' }}>
                  Nee
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmDel(true)} title="Doel verwijderen" aria-label="Doel verwijderen"
                style={{ background:'none', border:'1px solid rgba(248,81,73,.25)', borderRadius:20, padding:'5px 12px', color:'#f87171', cursor:'pointer', fontSize:12, whiteSpace:'nowrap' }}>
                🗑
              </button>
            )}
            <button onClick={onClose} aria-label="Sluiten"
              style={{ background:'none', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, color:'#64748b', cursor:'pointer', fontSize:20, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center' }}>
              ×
            </button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px', display:'flex', flexDirection:'column', gap:28 }}>

          {subGoals.length > 0 && (
            <section aria-label="Sub-doelen">
              <RpmSectionHead icon="🧩" label={`SUB-DOELEN (${subGoals.length})`} color="#a5b4fc" />
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {subGoals.map(sub => (
                  <button key={sub.id} onClick={() => onOpenGoal?.(sub)}
                    style={{ fontSize:12, padding:'6px 12px', borderRadius:8, background:'rgba(99,102,241,.08)', border:'1px solid rgba(99,102,241,.25)', color:'#c7d2fe', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                    <span>{sub.done ? '✓ ' : ''}{sub.text}</span>
                    <span style={{ fontSize:9, color: HORIZON_META[sub.horizon].color }}>{HORIZON_META[sub.horizon].label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* SMART-nudge: alleen als het gewicht draagt en er geen duidelijk result is */}
          {uitwerking.vraagtErom && !uitwerkAf && (
            <div style={{ padding:'12px 14px', borderRadius:9, marginBottom:4,
              background:'rgba(168,139,250,.07)', border:'1px solid rgba(168,139,250,.25)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <span style={{ fontSize:16, lineHeight:1.2 }}>🎯</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#c4b5fd', marginBottom:4 }}>
                    Dit doel heeft nog geen duidelijk result — nog niet echt SMART
                  </div>
                  <div style={{ fontSize:11.5, color:'#94a3b8', lineHeight:1.6 }}>
                    Er ontbreekt {uitwerking.ontbreekt.join(' en ')}. Zal ik je helpen dit scherper te krijgen?
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => setUitwerkAf(true)} title="Laat maar — dit doel is prima zoals het is"
                    style={{ fontSize:11, padding:'5px 10px', borderRadius:6, cursor:'pointer',
                      background:'none', borderWidth:1, borderStyle:'solid', borderColor:'rgba(255,255,255,.12)', color:'#64748b' }}>
                    Prima zo
                  </button>
                  <CopyPromptButton text={goalUitwerkPrompt(goal, uitwerking)} />
                </div>
              </div>
            </div>
          )}

          <section aria-label="Result-sectie">
            <RpmSectionHead icon="🎯" label="RESULT" color="#6366f1" />
            <textarea value={result} rows={3} aria-label="Result"
              onChange={e => schedSave('result', e.target.value, setResult)}
              placeholder="Wat is precies het resultaat? Hoe weet je dat je er bent?"
              style={fieldStyle('#6366f1')}
              onFocus={e => (e.target.style.borderColor='rgba(99,102,241,.55)')}
              onBlur={e => (e.target.style.borderColor='rgba(99,102,241,.28)')}
            />
          </section>

          <section aria-label="Why-sectie">
            <RpmSectionHead icon="📖" label="WHY / PURPOSE" color="#34d399" />
            <textarea value={why} rows={3} aria-label="Why"
              onChange={e => schedSave('why', e.target.value, setWhy)}
              placeholder="Waarom telt dit doel voor jou? Wat drijft je?"
              style={fieldStyle('#34d399')}
              onFocus={e => (e.target.style.borderColor='rgba(52,211,153,.5)')}
              onBlur={e => (e.target.style.borderColor='rgba(52,211,153,.28)')}
            />
          </section>

          <section aria-label="Tijdlijn-sectie">
            <RpmSectionHead icon="⏳" label="TIJDLIJN" color="#d29922" />
            <input type="date" value={goal.deadline ?? ''} aria-label="Streefdatum"
              onChange={e => saveField('deadline', e.target.value || null)}
              style={{ background:'rgba(210,153,34,.06)', border:'1px solid rgba(210,153,34,.28)', borderRadius:8, color:'#e2e8f0', fontSize:13, padding:'8px 12px', outline:'none' }} />
            <div style={{ fontSize:10.5, color:'var(--dim)', marginTop:6 }}>
              Aangemaakt: {new Date(goal.created_at).toLocaleDateString('nl-NL')}
              {isDeadlinePostponed(goal) && (
                <> · 🔀 deadline verschoven (was {goal.original_deadline})</>
              )}
            </div>
          </section>

          <section aria-label="Notities-sectie">
            <RpmSectionHead icon="📋" label="NOTITIES & ACTIEPLAN" color="#fb923c" />
            {extractNoteLinks(notes).length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                {extractNoteLinks(notes).map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}
                    style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid rgba(96,165,250,.3)', background:'rgba(96,165,250,.08)', color:'#60a5fa', textDecoration:'none', maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {l.label.toLowerCase().startsWith('map') ? '📁' : '📄'} {l.label}
                  </a>
                ))}
              </div>
            )}
            <textarea value={notes} rows={6} aria-label="Notities"
              onChange={e => schedSave('notes', e.target.value, setNotes)}
              placeholder="Stand van zaken, referenties, actiepunten..."
              style={fieldStyle('#fb923c')}
              onFocus={e => (e.target.style.borderColor='rgba(251,146,60,.5)')}
              onBlur={e => (e.target.style.borderColor='rgba(251,146,60,.28)')}
            />
          </section>

          <section aria-label="Bijlagen">
            <RpmSectionHead icon="📎" label="BIJLAGEN" color="#f472b6" />
            <Attachments entityType="goal" entityId={String(goal.id)} />
          </section>

          {gerelateerd.length > 0 && (
            <section aria-label="Gerelateerde projecten">
              <RpmSectionHead icon="🗂" label={`PROJECTEN IN DIT LEVENSGEBIED (${gerelateerd.length})`} color="#60a5fa" />
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {gerelateerd.map(p => (
                  <button key={p.id} onClick={() => onOpenProject?.(p)}
                    style={{ fontSize:12, padding:'6px 12px', borderRadius:8, background:'rgba(96,165,250,.08)', border:'1px solid rgba(96,165,250,.25)', color:'#93c5fd', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                    {p.emoji} {p.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Visualisaties">
            <RpmSectionHead icon="📊" label="VISUALISATIES & EXTRA" color="#06b6d4" />
            <textarea value={html} rows={5} aria-label="HTML content"
              onChange={e => schedSave('html_content', e.target.value, setHtml)}
              placeholder="Plak hier HTML — grafieken, afbeeldingen, tabellen... De AI kan dit voor je genereren."
              style={fieldStyle('#06b6d4')}
              onFocus={e => (e.target.style.borderColor='rgba(6,182,212,.55)')}
              onBlur={e => (e.target.style.borderColor='rgba(6,182,212,.28)')}
            />
            {html.trim() && (
              <div
                dangerouslySetInnerHTML={{ __html: html }}
                style={{ marginTop:12, padding:'14px 16px', background:'rgba(6,182,212,.04)', border:'1px solid rgba(6,182,212,.15)', borderRadius:8, overflowX:'auto' }}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

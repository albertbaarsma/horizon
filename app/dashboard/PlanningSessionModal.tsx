'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile, Task, Project, WeekItem, Achievement } from '@/lib/types'
import type { ParsedItem } from '@/app/api/achievements/parse/route'
import { ULTIEME_VISIE } from './VisiTab'
import { resolveLang } from '@/lib/lang'
import { ApiKeyNotice } from '@/app/ApiKeyNotice'

const DEFAULT_MUSIC_URL = 'https://music.youtube.com/watch?v=fWRISvgAygU'

const DAYS_NL_SHORT = ['Zo','Ma','Di','Wo','Do','Vr','Za']

type JournalKey = 'achievement' | 'magic' | 'verbeter'
const JOURNAL_TYPES: { key: JournalKey; label: string; emoji: string; color: string; dim: string; placeholder: string }[] = [
  { key: 'achievement', label: 'Achievement',  emoji: '🏆', color: '#fbbf24', dim: 'rgba(251,191,36,.12)',  placeholder: 'Wat heb je bereikt?' },
  { key: 'magic',       label: 'Magic Moment', emoji: '✨', color: '#c084fc', dim: 'rgba(192,132,252,.12)', placeholder: 'Beschrijf het bijzondere moment…' },
  { key: 'verbeter',    label: 'Verbeterpunt', emoji: '💡', color: '#38bdf8', dim: 'rgba(56,189,248,.12)',  placeholder: 'Wat kan er beter?' },
]
function emojiToKey(emoji: string): JournalKey {
  if (emoji === '✨') return 'magic'
  if (emoji === '💡') return 'verbeter'
  return 'achievement'
}

function getWeekDates() {
  const today = new Date()
  const dow   = today.getDay()
  const daysFromMon = dow === 0 ? 6 : dow - 1
  const mon = new Date(today)
  mon.setDate(today.getDate() - daysFromMon)
  const todayStr = today.toISOString().slice(0, 10)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    const date = d.toISOString().slice(0, 10)
    return { date, label: DAYS_NL_SHORT[d.getDay()], isToday: date === todayStr }
  })
}

interface Props {
  profile: Profile
  userId: string
  onClose: () => void
  onSaved?: () => void
  onGoToWeek?: () => void
  tasks?: Task[]
  projects?: Project[]
  weekItems?: WeekItem[]
  achievements?: Achievement[]
  onAddAchievement?: (a: Achievement) => void
}

export function PlanningSessionModal({ profile, userId, onClose, onSaved, onGoToWeek, tasks = [], projects = [], weekItems = [], achievements = [], onAddAchievement }: Props) {
  const lang = resolveLang(profile.language)
  const [phase,        setPhase]        = useState(1)
  const [visionText,   setVisionText]   = useState(profile.vision_text ?? ULTIEME_VISIE)
  const [musicUrl,     setMusicUrl]     = useState(profile.planning_music_url ?? DEFAULT_MUSIC_URL)
  const [editingMusic, setEditingMusic] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [speaking,     setSpeaking]     = useState(false)
  // Phase 2 — quick-add
  const [journalTab,   setJournalTab]   = useState<JournalKey>('achievement')
  const [quickText,    setQuickText]    = useState('')
  const [quickSaving,  setQuickSaving]  = useState(false)
  const [localAchs,    setLocalAchs]    = useState<Achievement[]>(achievements)
  const [showPaste,    setShowPaste]    = useState(false)
  // Phase 2 — paste + AI
  const [pasteText,    setPasteText]    = useState('')
  const [parsing,      setParsing]      = useState(false)
  const [parseError,   setParseError]   = useState('')
  const [parsedItems,  setParsedItems]  = useState<ParsedItem[]>([])
  const [checked,      setChecked]      = useState<boolean[]>([])
  const [savingAch,    setSavingAch]    = useState(false)
  const [savedCount,   setSavedCount]   = useState(0)
  // Phase 3 state
  const [assignments,  setAssignments]  = useState<{ taskId: number; date: string }[]>([])
  const [savingWeek,   setSavingWeek]   = useState(false)
  const [weekSaved,    setWeekSaved]    = useState(false)
  const supabase = createClient()
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const todayStr        = new Date().toISOString().slice(0, 10)
  const activeJournalType = JOURNAL_TYPES.find(t => t.key === journalTab)!
  const todayAll        = localAchs.filter(a => a.date === todayStr)
  const todayTabEntries = todayAll.filter(a => emojiToKey(a.emoji) === journalTab)

  const weekDates = useMemo(() => getWeekDates(), [])

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  // Stop speech on unmount
  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  // Auto-save defaults on first open if profile fields are empty
  useEffect(() => {
    const needsVision = !profile.vision_text
    const needsMusic  = !profile.planning_music_url
    if (needsVision || needsMusic) {
      supabase.from('profiles').update({
        ...(needsVision ? { vision_text: ULTIEME_VISIE }           : {}),
        ...(needsMusic  ? { planning_music_url: DEFAULT_MUSIC_URL } : {}),
      }).eq('id', userId).then(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveProfile(vision: string, music: string) {
    setSaving(true); setSaved(false)
    await supabase.from('profiles').update({
      vision_text:        vision || null,
      planning_music_url: music  || null,
    }).eq('id', userId)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function onVisionChange(v: string) {
    setVisionText(v)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => saveProfile(v, musicUrl), 1500)
  }

  async function saveMusicUrl() {
    setEditingMusic(false)
    await saveProfile(visionText, musicUrl)
  }

  function openMusic() {
    if (musicUrl) window.open(musicUrl, '_blank', 'noopener,noreferrer')
  }

  function speakVision() {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    if (!visionText.trim()) return
    const utt = new SpeechSynthesisUtterance(visionText)
    utt.lang = 'nl-NL'
    utt.rate = 0.88
    const voices = window.speechSynthesis.getVoices()
    const nlVoice = voices.find(v => v.lang.startsWith('nl'))
    if (nlVoice) utt.voice = nlVoice
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utt)
  }

  async function parseAchievements() {
    if (!pasteText.trim()) return
    setParsing(true); setParseError(''); setParsedItems([]); setSavedCount(0)
    try {
      const res = await fetch('/api/achievements/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })
      const data = await res.json() as { items?: ParsedItem[]; error?: string }
      if (data.error) { setParseError(data.error); return }
      const items = data.items ?? []
      setParsedItems(items)
      setChecked(items.map(() => true))
    } catch {
      setParseError('Verbindingsfout — probeer opnieuw')
    } finally {
      setParsing(false)
    }
  }

  async function quickSave() {
    const trimmed = quickText.trim()
    if (!trimmed || quickSaving) return
    setQuickSaving(true)
    const emoji = journalTab === 'magic' ? '✨' : journalTab === 'verbeter' ? '💡' : '🏆'
    const { data } = await supabase.from('achievements').insert({
      user_id: userId, text: trimmed, emoji, date: todayStr, cat_id: null,
    }).select().single()
    if (data) {
      const a = data as Achievement
      setLocalAchs(prev => [...prev, a])
      onAddAchievement?.(a)
      onSaved?.()
    }
    setQuickText('')
    setQuickSaving(false)
  }

  async function saveAchievements() {
    const toSave = parsedItems.filter((_, i) => checked[i])
    if (!toSave.length) return
    setSavingAch(true)
    const rows = toSave.map(item => ({
      user_id: userId, date: todayStr, text: item.text, emoji: item.emoji, cat_id: null,
    }))
    const { data } = await supabase.from('achievements').insert(rows).select()
    if (data) {
      const added = data as Achievement[]
      setLocalAchs(prev => [...prev, ...added])
      added.forEach(a => onAddAchievement?.(a))
    }
    setSavedCount(toSave.length)
    setSavingAch(false)
    setParsedItems([])
    setPasteText('')
    onSaved?.()
  }

  function isAssigned(taskId: number, date: string) {
    return assignments.some(a => a.taskId === taskId && a.date === date)
  }

  function isAlreadyPlanned(taskId: number, date: string) {
    return weekItems.some(w => w.task_id === String(taskId) && w.date === date)
  }

  function toggleDay(taskId: number, date: string) {
    if (isAlreadyPlanned(taskId, date)) return
    setAssignments(prev => {
      const has = prev.some(a => a.taskId === taskId && a.date === date)
      return has
        ? prev.filter(a => !(a.taskId === taskId && a.date === date))
        : [...prev, { taskId, date }]
    })
  }

  async function saveWeekPlan() {
    if (!assignments.length) return
    setSavingWeek(true)
    const rows = assignments
      .filter(a => !isAlreadyPlanned(a.taskId, a.date))
      .map(a => {
        const task = tasks.find(t => t.id === a.taskId)
        return {
          user_id:  userId,
          date:     a.date,
          type:     'task' as const,
          text:     task?.name ?? '',
          done:     false,
          proj_id:  task?.proj_id ?? null,
          task_id:  String(a.taskId),
          recur_id: null,
        }
      })
      .filter(r => r.text)
    if (rows.length) await supabase.from('week_items').insert(rows)
    setSavingWeek(false)
    setWeekSaved(true)
    setAssignments([])
    onSaved?.()
  }

  const backlogTasks = tasks.filter(t => t.status === 'backlog' || t.status === 'doing')

  const phaseLabels = ['🌟 Vision', '🏆 Achievements']

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ width:'100%', maxWidth:740, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column', maxHeight:'90vh', boxShadow:'0 32px 96px rgba(0,0,0,.8)' }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:14, background:'rgba(99,102,241,.04)' }}>
          <span style={{ fontSize:22 }}>🗓</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700 }}>Wekelijkse Plansessie</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
              {new Date().toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </div>
          </div>

          {/* Phase tabs */}
          <div style={{ display:'flex', gap:6 }}>
            {phaseLabels.map((label, i) => {
              const p = i + 1
              const active = phase === p
              const done   = p < phase
              return (
                <button key={p} onClick={() => setPhase(p)} style={{
                  padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight: active ? 700 : 400,
                  border:`1px solid ${active ? '#6366f1' : done ? 'rgba(99,102,241,.4)' : 'var(--border)'}`,
                  background: active ? '#6366f1' : done ? 'rgba(99,102,241,.12)' : 'var(--bg)',
                  color: active ? '#fff' : done ? '#818cf8' : 'var(--muted)',
                  cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap',
                }}>
                  {done ? '✓ ' : ''}{label}
                </button>
              )
            })}
          </div>

          <button onClick={onClose} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'5px 10px', color:'var(--muted)', cursor:'pointer', fontSize:13, marginLeft:4 }}>✕</button>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div style={{ flex:1, overflowY:'auto', padding:'28px 28px 8px' }}>

          {/* ── Phase 1: Vision ──────────────────────────────────── */}
          {phase === 1 && (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'#818cf8' }}>
                  Jouw Ultimate Vision
                </div>
                {saving && <span style={{ fontSize:10, color:'var(--muted)' }}>opslaan…</span>}
                {saved  && <span style={{ fontSize:10, color:'var(--green)' }}>✓ opgeslagen</span>}
                <button
                  onClick={speakVision}
                  title={speaking ? 'Stop voorlezen' : 'Lees hardop voor'}
                  style={{
                    marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
                    background: speaking ? 'rgba(99,102,241,.18)' : 'var(--bg)',
                    border:`1px solid ${speaking ? '#818cf8' : 'var(--border)'}`,
                    borderRadius:20, padding:'4px 12px 4px 9px',
                    color: speaking ? '#c7d2fe' : 'var(--muted)',
                    cursor:'pointer', fontSize:11, fontWeight: speaking ? 700 : 400,
                    transition:'all .15s',
                  }}>
                  {speaking ? '⏹ Stop' : '🔊 Lees voor'}
                </button>
              </div>

              <p style={{ fontSize:12, color:'var(--muted)', marginBottom:16, lineHeight:1.7 }}>
                Lees dit opnieuw door. Laat het landen. Herinner jezelf aan <em>waarom</em> je doet wat je doet.
              </p>

              <textarea
                value={visionText}
                onChange={e => onVisionChange(e.target.value)}
                placeholder={[
                  'Schrijf hier je ultimate vision…',
                  '',
                  'Wie wil je zijn? Wat wil je bereiken?',
                  'Wat maakt jouw leven zinvol en vol?',
                  'Hoe ziet je ideale dag eruit over 5 jaar?',
                ].join('\n')}
                style={{
                  width:'100%', minHeight:260, background:'var(--bg)', border:'1px solid var(--border)',
                  borderRadius:10, padding:'18px', fontSize:13, color:'var(--text)', lineHeight:1.9,
                  resize:'vertical', outline:'none', fontFamily:'inherit', boxSizing:'border-box',
                  transition:'border-color .15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#6366f1')}
                onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
              />

              {/* Music */}
              <div style={{ marginTop:20, padding:'16px 18px', background:'var(--bg)', borderRadius:10, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'var(--muted)', marginBottom:12 }}>
                  🎵 Motiverende muziek
                </div>

                {editingMusic ? (
                  <div style={{ display:'flex', gap:8 }}>
                    <input
                      autoFocus
                      value={musicUrl}
                      onChange={e => setMusicUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveMusicUrl(); if (e.key === 'Escape') setEditingMusic(false) }}
                      placeholder="YouTube of Spotify URL (https://…)"
                      style={{ flex:1, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 11px', fontSize:12, color:'var(--text)', outline:'none' }}
                    />
                    <button onClick={saveMusicUrl} style={{ background:'#6366f1', border:'none', borderRadius:6, padding:'8px 16px', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                      Opslaan
                    </button>
                    <button onClick={() => { setMusicUrl(profile.planning_music_url ?? ''); setEditingMusic(false) }}
                      style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 10px', color:'var(--muted)', cursor:'pointer', fontSize:12 }}>
                      Annuleer
                    </button>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    {musicUrl ? (
                      <button onClick={openMusic} style={{
                        background:'linear-gradient(135deg, rgba(99,102,241,.15), rgba(139,92,246,.15))',
                        border:'1px solid rgba(99,102,241,.4)', borderRadius:8, padding:'10px 20px',
                        color:'#c7d2fe', cursor:'pointer', fontSize:13, fontWeight:600,
                        display:'flex', alignItems:'center', gap:8, transition:'all .15s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background='linear-gradient(135deg, rgba(99,102,241,.28), rgba(139,92,246,.28))')}
                        onMouseLeave={e => (e.currentTarget.style.background='linear-gradient(135deg, rgba(99,102,241,.15), rgba(139,92,246,.15))')}
                      >
                        ▶ Zet muziek aan
                      </button>
                    ) : (
                      <span style={{ fontSize:12, color:'var(--dim)', fontStyle:'italic' }}>Geen muziek-URL ingesteld</span>
                    )}
                    <button onClick={() => setEditingMusic(true)} style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:11, textDecoration:'underline', padding:0 }}>
                      {musicUrl ? 'URL wijzigen' : 'URL instellen'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Phase 2: Achievements ─────────────────────────────── */}
          {phase === 2 && (
            <div>
              {/* Type tabs */}
              <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                {JOURNAL_TYPES.map(t => (
                  <button key={t.key} onClick={() => { setJournalTab(t.key); setQuickText('') }} style={{
                    flex:1, padding:'9px 4px', border:`1px solid ${journalTab === t.key ? t.color : 'var(--border)'}`,
                    borderRadius:8, background: journalTab === t.key ? t.dim : 'var(--bg)',
                    color: journalTab === t.key ? t.color : 'var(--muted)', cursor:'pointer',
                    fontSize:11, fontWeight: journalTab === t.key ? 700 : 400, transition:'all .12s',
                  }}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              {/* Quick-add input */}
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <input
                  autoFocus
                  value={quickText}
                  onChange={e => setQuickText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') quickSave() }}
                  placeholder={activeJournalType.placeholder}
                  style={{
                    flex:1, background:'var(--bg)',
                    border:`1px solid ${quickText ? activeJournalType.color + '66' : 'var(--border)'}`,
                    color:'var(--text)', borderRadius:8, padding:'9px 13px', fontSize:13,
                    outline:'none', fontFamily:'inherit', transition:'border .12s', boxSizing:'border-box',
                  }}
                />
                <button
                  onClick={quickSave}
                  disabled={!quickText.trim() || quickSaving}
                  style={{
                    width:40, flexShrink:0, background: quickText.trim() ? activeJournalType.color : 'var(--bg3)',
                    border:'none', borderRadius:8, color: quickText.trim() ? '#fff' : 'var(--muted)',
                    cursor: quickText.trim() ? 'pointer' : 'default', fontSize:20, fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center', transition:'all .12s',
                  }}>
                  {quickSaving ? '…' : '+'}
                </button>
              </div>

              {/* Today's entries for active tab */}
              {todayTabEntries.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:12, maxHeight:180, overflowY:'auto' }}>
                  {todayTabEntries.map(a => (
                    <div key={a.id} style={{
                      display:'flex', alignItems:'flex-start', gap:10, padding:'8px 11px',
                      background:'var(--bg)', borderRadius:7,
                      border:`1px solid ${activeJournalType.color}33`,
                    }}>
                      <span style={{ fontSize:14, flexShrink:0 }}>{a.emoji}</span>
                      <span style={{ fontSize:12, color:'var(--text)', lineHeight:1.5 }}>{a.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {todayAll.length > 0 && (
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:16 }}>
                  {todayAll.length} item{todayAll.length !== 1 ? 's' : ''} toegevoegd vandaag
                </div>
              )}

              {/* Paste + AI — collapsible */}
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                <button
                  onClick={() => setShowPaste(p => !p)}
                  style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:11, padding:0, display:'flex', alignItems:'center', gap:5 }}>
                  {showPaste ? '▲' : '▼'} Weeknotities plakken → verwerken via AI
                </button>

                {showPaste && (
                  <div style={{ marginTop:12 }}>
                    {!parsedItems.length && !savedCount ? (
                      <>
                        <textarea
                          value={pasteText}
                          onChange={e => setPasteText(e.target.value)}
                          placeholder={'Plak hier je notities:\n\nACCOMPLISHMENTS:\n- ...\n\nMAGIC MOMENTS:\n- ...\n\nVERBETERPUNTEN:\n- ...'}
                          style={{
                            width:'100%', minHeight:150, background:'var(--bg)', border:'1px solid var(--border)',
                            borderRadius:9, padding:'12px', fontSize:12, color:'var(--text)', lineHeight:1.8,
                            resize:'vertical', outline:'none', fontFamily:'inherit', boxSizing:'border-box',
                          }}
                          onFocus={e => (e.target.style.borderColor = '#3fb950')}
                          onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
                        />
                        {parseError && <div style={{ marginTop:8 }}><ApiKeyNotice error={parseError} lang={lang} /></div>}
                        <button
                          onClick={parseAchievements}
                          disabled={parsing || !pasteText.trim()}
                          style={{
                            marginTop:10, background: parsing || !pasteText.trim() ? 'var(--bg3)' : '#3fb950',
                            border:'none', borderRadius:8, padding:'8px 18px',
                            color: parsing || !pasteText.trim() ? 'var(--muted)' : '#fff',
                            cursor: parsing || !pasteText.trim() ? 'default' : 'pointer', fontSize:12, fontWeight:600,
                          }}>
                          {parsing ? '⏳ AI verwerkt…' : '✨ Verwerk via AI'}
                        </button>
                      </>
                    ) : savedCount ? (
                      <div style={{ padding:'12px 0', display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:18 }}>🎉</span>
                        <span style={{ fontSize:13, fontWeight:600 }}>{savedCount} items via AI opgeslagen</span>
                        <button onClick={() => { setSavedCount(0); setPasteText('') }} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, textDecoration:'underline' }}>
                          Meer
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', marginBottom:8 }}>
                          {parsedItems.length} items gevonden — selecteer wat je wilt opslaan:
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:12, maxHeight:220, overflowY:'auto' }}>
                          {parsedItems.map((item, i) => (
                            <label key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'8px 10px', background:'var(--bg)', borderRadius:7, border:`1px solid ${checked[i] ? 'rgba(63,185,80,.3)' : 'var(--border)'}`, cursor:'pointer' }}>
                              <input
                                type="checkbox"
                                checked={checked[i] ?? true}
                                onChange={e => setChecked(c => c.map((v, j) => j === i ? e.target.checked : v))}
                                style={{ marginTop:2, flexShrink:0, accentColor:'#3fb950' }}
                              />
                              <span style={{ fontSize:15, flexShrink:0 }}>{item.emoji}</span>
                              <div>
                                <div style={{ fontSize:12, color:'var(--text)', lineHeight:1.4 }}>{item.text}</div>
                                <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>
                                  {item.type === 'accomplishment' ? 'Accomplishment' : item.type === 'magic_moment' ? 'Magic moment' : 'Verbeterpunt'}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <button
                            onClick={saveAchievements}
                            disabled={savingAch || !checked.some(Boolean)}
                            style={{
                              background: savingAch || !checked.some(Boolean) ? 'var(--bg3)' : '#3fb950',
                              border:'none', borderRadius:7, padding:'8px 16px',
                              color: savingAch || !checked.some(Boolean) ? 'var(--muted)' : '#fff',
                              cursor: savingAch || !checked.some(Boolean) ? 'default' : 'pointer',
                              fontSize:12, fontWeight:600,
                            }}>
                            {savingAch ? 'Opslaan…' : `✓ Sla ${checked.filter(Boolean).length} item${checked.filter(Boolean).length !== 1 ? 's' : ''} op`}
                          </button>
                          <button onClick={() => { setParsedItems([]); setChecked([]) }} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, textDecoration:'underline' }}>
                            Opnieuw plakken
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Phase 3: Week planning ────────────────────────────── */}
          {phase === 3 && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'#f97316' }}>
                  📅 Plan de week
                </div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>
                  {weekDates[0].date.slice(5).replace('-','/') } – {weekDates[6].date.slice(5).replace('-','/')}
                </div>
              </div>
              <p style={{ fontSize:12, color:'var(--muted)', marginBottom:14, lineHeight:1.6 }}>
                Klik op een dag om een taak in te plannen. Reeds ingeplande taken zijn gemarkeerd.
              </p>

              {weekSaved ? (
                <div style={{ textAlign:'center', padding:'40px 24px' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>✅</div>
                  <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>Weekplan opgeslagen!</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:18 }}>De taken staan nu in je weekoverzicht.</div>
                  <button onClick={() => setWeekSaved(false)} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 14px', color:'var(--muted)', cursor:'pointer', fontSize:12 }}>
                    Meer plannen
                  </button>
                </div>
              ) : backlogTasks.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 24px', color:'var(--dim)', fontSize:12, background:'var(--bg)', borderRadius:10, border:'1px dashed var(--border)' }}>
                  Geen backlog taken gevonden
                </div>
              ) : (
                <>
                  {/* Day header */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr repeat(7, 36px)', gap:4, marginBottom:6, paddingLeft:4 }}>
                    <div />
                    {weekDates.map(d => (
                      <div key={d.date} style={{ textAlign:'center', fontSize:10, fontWeight:700, color: d.isToday ? '#f97316' : 'var(--muted)', letterSpacing:'.3px' }}>
                        {d.label}
                      </div>
                    ))}
                  </div>

                  {/* Tasks grouped by project */}
                  <div style={{ display:'flex', flexDirection:'column', gap:2, maxHeight:320, overflowY:'auto' }}>
                    {projects
                      .filter(proj => backlogTasks.some(t => t.proj_id === proj.id))
                      .map(proj => (
                        <div key={proj.id}>
                          <div style={{ fontSize:9, fontWeight:700, letterSpacing:'.8px', textTransform:'uppercase', color:'var(--dim)', padding:'8px 4px 3px' }}>
                            {proj.emoji} {proj.name.split('—')[0].trim()}
                          </div>
                          {backlogTasks.filter(t => t.proj_id === proj.id).map(task => (
                            <div key={task.id} style={{ display:'grid', gridTemplateColumns:'1fr repeat(7, 36px)', gap:4, alignItems:'center', padding:'4px', borderRadius:6, background: assignments.some(a => a.taskId === task.id) ? 'rgba(249,115,22,.06)' : 'transparent' }}>
                              <div style={{ fontSize:11, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:4 }} title={task.name}>
                                {task.name}
                              </div>
                              {weekDates.map(d => {
                                const planned = isAlreadyPlanned(task.id, d.date)
                                const selected = isAssigned(task.id, d.date)
                                return (
                                  <button
                                    key={d.date}
                                    onClick={() => toggleDay(task.id, d.date)}
                                    title={planned ? 'Al ingepland' : d.label}
                                    style={{
                                      width:32, height:24, borderRadius:5, border:'none',
                                      background: planned ? 'rgba(99,102,241,.25)' : selected ? '#f97316' : 'var(--bg)',
                                      cursor: planned ? 'default' : 'pointer',
                                      fontSize:10, color: planned ? '#818cf8' : selected ? '#fff' : 'var(--dim)',
                                      transition:'all .1s',
                                    }}>
                                    {planned ? '✓' : selected ? '●' : ''}
                                  </button>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      ))
                    }
                  </div>

                  {/* Save button */}
                  <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10 }}>
                    <button
                      onClick={saveWeekPlan}
                      disabled={savingWeek || !assignments.length}
                      style={{
                        background: savingWeek || !assignments.length ? 'var(--bg3)' : '#f97316',
                        border:'none', borderRadius:8, padding:'10px 22px',
                        color: savingWeek || !assignments.length ? 'var(--muted)' : '#fff',
                        cursor: savingWeek || !assignments.length ? 'default' : 'pointer',
                        fontSize:13, fontWeight:600,
                      }}>
                      {savingWeek ? 'Opslaan…' : assignments.length ? `📅 Plan ${assignments.length} item${assignments.length !== 1 ? 's' : ''} in` : 'Selecteer taken'}
                    </button>
                    {assignments.length > 0 && (
                      <button onClick={() => setAssignments([])} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:12, textDecoration:'underline' }}>
                        Reset
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div style={{ padding:'16px 28px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button
            onClick={() => setPhase(p => Math.max(1, p - 1))}
            disabled={phase === 1}
            style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'8px 18px', color:'var(--muted)', cursor: phase === 1 ? 'default' : 'pointer', fontSize:13, opacity: phase === 1 ? .35 : 1 }}>
            ← Vorige
          </button>

          {/* Dot indicator */}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {[1,2].map(p => (
              <div key={p} style={{ width:8, height:8, borderRadius:'50%', transition:'all .2s', background: p === phase ? '#6366f1' : p < phase ? 'rgba(99,102,241,.5)' : 'var(--border)', transform: p === phase ? 'scale(1.3)' : 'scale(1)' }} />
            ))}
          </div>

          {phase < 2 ? (
            <button
              onClick={() => setPhase(2)}
              style={{ background:'#6366f1', border:'none', borderRadius:6, padding:'8px 20px', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
              Volgende →
            </button>
          ) : (
            <button
              onClick={() => { onGoToWeek?.(); onClose() }}
              style={{ background:'#3fb950', border:'none', borderRadius:6, padding:'8px 20px', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
              Naar week planning →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

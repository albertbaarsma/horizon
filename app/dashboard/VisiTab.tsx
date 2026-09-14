'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import type { Category, Goal, GoalHorizon, RecurringTask, WeekItem, Project, Achievement } from '@/lib/types'
import { syncGoalAchievement } from '@/lib/goal-achievement'
import { activeGoals, trashGoalEverywhere } from '@/lib/goal-links'
import { HORIZON_ORDER, HORIZON_META } from '@/lib/goal-horizons'
import { CAT_COLORS, categoryColorMap } from '@/lib/category-colors'
import { categoryIcon } from '@/lib/xp'

/** Horizons die je per levensgebied ziet — 'nu' hoort bij de dag, niet bij een
 *  gebied. Afgeleid van HORIZON_ORDER (niet een eigen kopie) zodat de volgorde
 *  hier nooit kan afwijken van Doelen/Projecten/Taken. */
const CATEGORIE_HORIZONS: GoalHorizon[] = HORIZON_ORDER.filter(h => h !== 'nu')

// Document order from RPM document
const SORT_ORDER = [
  'gezondheid','sport','fysiek',
  'content','creator',
  'ondernemer','business',
  'persoonlijk','personal',
  'vrienden','social',
  'kinderen','children',
  'thuis','land','huis','home',
  'liefde','lover',
  'muzikant','musician',
  'klussen',
  'hektare',
]

function sortCategories(cats: Category[]): Category[] {
  return [...cats].sort((a, b) => {
    const ai = SORT_ORDER.findIndex(k => a.name.toLowerCase().includes(k))
    const bi = SORT_ORDER.findIndex(k => b.name.toLowerCase().includes(k))
    const av = ai === -1 ? 999 : ai
    const bv = bi === -1 ? 999 : bi
    return av - bv
  })
}

// Woordelijk uit Jordan's eigen visiedocument — regel voor regel zo overgenomen,
// inclusief de blanco regel vóór "Mijn kinderen". Niet herschrijven of inkorten.
export const ULTIEME_VISIE_REGELS: string[] = [
  'In mijn ultieme visie heb ik een huis op mijn eigen hectare grond. Als ik mijn domijn binnenkom voel ik me meteen thuis. Ik ben trots het te laten zien. Ik ben mezelf. Ik ben in flow. De woning heeft zonnepanelen, een jacuzzi en een sportruimte met sporttoestellen. Ik heb een elektrische auto die ik thuis kan opladen. Ook heb ik mijn eigen studio, uitgebreid met een drumstel, een piano, drie keyboards, gitaren aan de muur (akoestisch, elektrisch en bas), etc.',
  'Een echte professionele studio.',
  'De studio verhuur aan artiesten. Ze kunnen hier in alle rust, opnames doen. De studio fungeerd ook als cursusruimte.',
  'Je kunt in de studio/cursusruimte opnames maken van de cursus. Het heeft een gezellige woonkamer en hipster vibe. Er zijn banken en zachte stoelen en accoustische panelen verstopt achter kunstwerken die sfeer maken en geluid dempen. Er is een koffie en theebar, met een gasfornuis, oven, afwasmachiene e.d. - alles wat je nodig hebt om jezelf comfortabel te maken tijdens het verblijf hier.',
  'Er zijn luxe gastverblijven waar mensen kunnen overnachten. De mensen die hier op bezoek komen zijn heel blij dat ze hier kunnen zijn, en maken het goed. Dit verblijf staat ook hoog aangeschreven.',
  'Ik woon in het Anastaciadorp, samen met gelijkgestemden. We hebben een gemeenschap..',
  'We hebben een community (online en offline) opgebouwd van mensen die willen groeien en iets goeds willen doen in de wereld.',
  'Mijn inkomen is goed en grotendeels passief. Zonder dat ik er veel tijd aan kwijt ben. Ik voel me gewaardeerd.',
  'Ik verbind mensen met elkaar. Ik geef feestjes en organiseer festivals.',
  'Ik ben onderdeel van een band en we touren. We hebben nummers uitgebracht en zijn op de radio geweest met onze nummers. Onze optredens voelen fantastisch; het publiek zingt onze nummers terug.',
  'Onze muziek inspireert mensen om meer zelfvertrouwen te hebben.',
  'Ik werk hard en haal voldoening uit mijn werk.',
  'Ik voel me gebalanceerd, gelukkig en productief. Ik ben regelmatig in de flow.',
  'Fysiek voel ik me topfit. Ik heb voluit energie. Ik ben blij, energiek. Levend.',
  'Ik blijf gezond tot op hoge leeftijd.',
  'Ik heb de liefde van mijn leven gevonden. Ik heb een fantastische relatie.',
  'Ze is mooi, energiek, grappig, lief, ondernemend, sportief, intelligent. We begrijpen en respecteren elkaar.',
  '',
  'Mijn kinderen doen het fantastisch. Ik hou van ze en ben heel blij met ze. Ze zijn gelukkig en leven zoals zij willen leven.',
  'Ik ben gelukkig.',
  'En ik weet en voel dat ik een positieve impact maak — een positieve bijdrage die doorwerkt in toekomstige generaties.',
]

/** Voor wie de losse regels als één string wil (bijv. kopiëren). */
export const ULTIEME_VISIE = ULTIEME_VISIE_REGELS.join('\n')

// ─── Klikbare woorden in de visie ──────────────────────────────────────────────
// Woorden die naar een levensgebied, doel of achievement verwijzen worden
// klikbaar — maar alleen als dat ding ook echt bestaat. Geen gok-koppelingen.
interface VisieLink {
  pattern: RegExp
  kind: 'category' | 'goal' | 'achievement'
  id: string | number
  titel: string
}

function vindVisieLinks(categories: Category[], goals: Goal[], achievements: Achievement[]): VisieLink[] {
  const links: VisieLink[] = []
  const kinderenCat = categories.find(c => c.id === 'kinderen' || /kinderen/i.test(c.name))
  if (kinderenCat) links.push({ pattern: /\bkinderen\b/i, kind: 'category', id: kinderenCat.id, titel: `Naar levensgebied "${kinderenCat.name}"` })
  const topfitGoal = goals.find(g => /topfit/i.test(g.text))
  if (topfitGoal) links.push({ pattern: /Fysiek voel ik me topfit/i, kind: 'goal', id: topfitGoal.id, titel: 'Naar dit meerjarendoel' })
  const zonnepanelenAch = achievements.find(a => /zonnepanelen/i.test(a.text))
  if (zonnepanelenAch) links.push({ pattern: /\bzonnepanelen\b/i, kind: 'achievement', id: zonnepanelenAch.id, titel: 'Al gehaald — zie je prestaties' })
  const muzikantCat = categories.find(c => c.id === 'muzikant' || /muzikant/i.test(c.name))
  if (muzikantCat) links.push({ pattern: /\bband\b/i, kind: 'category', id: muzikantCat.id, titel: `Naar levensgebied "${muzikantCat.name}"` })
  return links
}

const LINK_COLORS: Record<VisieLink['kind'], string> = { category: '#818cf8', goal: '#a78bfa', achievement: '#fbbf24' }

/** Eén regel visietekst, met eventuele treffers uit `links` als klikbaar woord. */
function VisieRegel({ regel, links, onCategory, onGoal, onAchievement }: {
  regel: string
  links: VisieLink[]
  onCategory: (id: string) => void
  onGoal: (id: number) => void
  onAchievement: () => void
}) {
  let nodes: React.ReactNode[] = [regel]
  for (const link of links) {
    nodes = nodes.flatMap<React.ReactNode>((n, i) => {
      if (typeof n !== 'string') return [n]
      const m = n.match(link.pattern)
      if (!m || m.index === undefined) return [n]
      const before = n.slice(0, m.index)
      const woord = m[0]
      const after = n.slice(m.index + woord.length)
      const onClick = link.kind === 'category' ? () => onCategory(link.id as string)
        : link.kind === 'goal' ? () => onGoal(link.id as number)
        : onAchievement
      return [
        before,
        <button key={`${link.kind}-${link.id}-${i}`} onClick={onClick} title={link.titel} style={{
          background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer',
          color: LINK_COLORS[link.kind], textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3,
        }}>
          {woord}
        </button>,
        after,
      ].filter(x => x !== '')
    })
  }
  return <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.8, margin: '0 0 14px' }}>{nodes}</p>
}

// ─── Inline-editable text field ───────────────────────────────────────────────

function EditableField({ value, onSave, placeholder, multiline = true }: {
  value?: string | null
  onSave: (v: string) => void
  placeholder: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => { setDraft(value ?? ''); setEditing(true) }
  const commit = () => { setEditing(false); if (draft !== (value ?? '')) onSave(draft) }

  const sharedStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: '#0a1020', border: '1px solid rgba(99,102,241,.5)',
    color: '#e2e8f0', borderRadius: 6, padding: '7px 10px',
    fontSize: 13, fontFamily: 'inherit', lineHeight: 1.65, outline: 'none',
  }

  if (editing) {
    return multiline
      ? <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
          rows={Math.max(3, (draft.match(/\n/g)?.length ?? 0) + 2)}
          style={{ ...sharedStyle, resize: 'vertical' }} />
      : <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={sharedStyle} />
  }

  return (
    <div onClick={start} title="Klik om te bewerken" style={{
      cursor: 'text', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap',
      color: value ? '#94a3b8' : '#374151', fontStyle: value ? 'normal' : 'italic',
      padding: '4px 6px', borderRadius: 5, minHeight: 28,
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {value || placeholder}
    </div>
  )
}

function SectionLabel({ icon, label, color = '#4b5563' }: { icon: string; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, marginTop: 18 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color }}>{label}</span>
    </div>
  )
}

// ─── Goal row ─────────────────────────────────────────────────────────────────

function GoalRow({ goal, onToggle, onDelete, onOpen }: {
  goal: Goal
  onToggle: (id: number, done: boolean) => void
  onDelete: (id: number) => void
  /** Klik op de rij (niet het vinkje, niet het kruisje) opent het detailvenster. */
  onOpen?: (id: number) => void
}) {
  const deadline = goal.deadline ? new Date(goal.deadline) : null
  const today = new Date()
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - today.getTime()) / 86400000) : null
  const overdue = daysLeft !== null && daysLeft < 0 && !goal.done

  const deadlineColor = goal.done ? '#374151' : overdue ? '#f87171' : daysLeft !== null && daysLeft < 14 ? '#fbbf24' : '#4b5563'

  return (
    <div onClick={() => onOpen?.(goal.id)} title={onOpen ? 'Klik om te openen' : undefined} style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
      borderRadius: 8, marginBottom: 5, cursor: onOpen ? 'pointer' : 'default',
      background: goal.done ? 'rgba(63,185,80,.04)' : overdue ? 'rgba(248,81,73,.05)' : 'rgba(255,255,255,.03)',
      border: `1px solid ${goal.done ? 'rgba(63,185,80,.12)' : overdue ? 'rgba(248,81,73,.15)' : 'rgba(255,255,255,.07)'}`,
    }}>
      <input type="checkbox" checked={goal.done} onClick={e => e.stopPropagation()}
        onChange={e => onToggle(goal.id, e.target.checked)}
        style={{ marginTop: 2, cursor: 'pointer', accentColor: '#6366f1', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: goal.done ? '#374151' : '#94a3b8', textDecoration: goal.done ? 'line-through' : 'none' }}>
          {goal.text}
        </div>
        {deadline && (
          <div style={{ fontSize: 10, marginTop: 3, color: deadlineColor }}>
            {goal.done
              ? '✓ gehaald'
              : overdue
              ? `⚠ ${Math.abs(daysLeft!)} dagen verlopen`
              : `${daysLeft} dagen — ${deadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </div>
        )}
        {goal.done && (
          <div style={{ fontSize: 10, marginTop: 4, color: '#3fb950', fontWeight: 500 }}>
            🎉 Doel gehaald! Stel een nieuw doel in.
          </div>
        )}
      </div>
      <button onClick={e => { e.stopPropagation(); onDelete(goal.id) }}
        style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
        onMouseLeave={e => (e.currentTarget.style.color = '#374151')}>×</button>
    </div>
  )
}

// ─── Add goal form ─────────────────────────────────────────────────────────────

function AddGoalForm({ onAdd, onCancel }: {
  onAdd: (text: string, deadline: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [deadline, setDeadline] = useState('')
  const canAdd = text.trim().length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: 'rgba(99,102,241,.07)', borderRadius: 8, border: '1px solid rgba(99,102,241,.2)', marginTop: 6 }}>
      <textarea autoFocus placeholder="Omschrijf je doel…" value={text} onChange={e => setText(e.target.value)} rows={2}
        style={{ background: '#0a1020', border: '1px solid rgba(99,102,241,.3)', color: '#e2e8f0', borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, color: '#6b7280' }}>Deadline:</label>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
          style={{ background: '#0a1020', border: '1px solid rgba(255,255,255,.1)', color: '#e2e8f0', borderRadius: 5, padding: '4px 8px', fontSize: 12, outline: 'none' }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#6b7280', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>Annuleer</button>
          <button onClick={() => canAdd && onAdd(text.trim(), deadline)} disabled={!canAdd}
            style={{ background: canAdd ? 'rgba(99,102,241,.25)' : 'rgba(255,255,255,.04)', border: `1px solid ${canAdd ? '#6366f1' : 'rgba(255,255,255,.08)'}`, color: canAdd ? '#a5b4fc' : '#374151', borderRadius: 6, padding: '4px 14px', fontSize: 12, cursor: canAdd ? 'pointer' : 'default' }}>
            ＋ Toevoegen
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Goals section ─────────────────────────────────────────────────────────────

function GoalsSection({ label, icon, horizon, goals, catId, color, onToggle, onDelete, onAdd, onOpen }: {
  label: string; icon: string; horizon: GoalHorizon
  goals: Goal[]; catId: string; color: string
  onToggle: (id: number, done: boolean) => void
  onDelete: (id: number) => void
  onAdd: (catId: string, horizon: GoalHorizon, text: string, deadline: string) => void
  onOpen?: (id: number) => void
}) {
  const [adding, setAdding] = useState(false)
  return (
    <div>
      <SectionLabel icon={icon} label={label} color={color} />
      {goals.map(g => <GoalRow key={g.id} goal={g} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} />)}
      {adding
        ? <AddGoalForm onAdd={(t, d) => { onAdd(catId, horizon, t, d); setAdding(false) }} onCancel={() => setAdding(false)} />
        : <button onClick={() => setAdding(true)} style={{
            width: '100%', marginTop: 4, padding: '5px 0', fontSize: 11, cursor: 'pointer',
            background: 'none', border: '1px dashed rgba(255,255,255,.1)', borderRadius: 6,
            color: '#374151', transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'; e.currentTarget.style.color = '#374151' }}>
            ＋ Voeg {label.toLowerCase()} toe
          </button>
      }
    </div>
  )
}

// ─── Week preview inside category ─────────────────────────────────────────────

const MONTHS_V = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
const DAY_SHORT_NL = ['ma','di','wo','do','vr','za','zo']
const DAY_NAMES_EN_V = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

function dayIdx(date: string): number {
  const d = new Date(date + 'T12:00:00')
  return (d.getDay() + 6) % 7 // 0=Mon…6=Sun
}

function WeekPreviewSection({ cat, weekItems, recurringTasks, projects, color }: {
  cat: Category
  weekItems: WeekItem[]
  recurringTasks: RecurringTask[]
  projects: Project[]
  color: string
}) {
  const now = new Date()
  const dow = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const catProjIds = new Set(projects.filter(p => p.cat_id === cat.id).map(p => p.id))
  const catRecurring = recurringTasks.filter(r => r.cat_id === cat.id && r.active)

  // Type → category pattern mapping for items without an explicit link
  const TYPE_CAT_PATTERNS: Partial<Record<WeekItem['type'], RegExp>> = {
    sport: /gezondheid|sport|fit|vitaliteit/i,
    kids:  /familie|kinderen|vrienden/i,
  }
  const matchedType = (Object.entries(TYPE_CAT_PATTERNS) as [WeekItem['type'], RegExp][])
    .find(([, re]) => re.test(cat.name))?.[0] ?? null

  const catWeekItems = weekItems.filter(w =>
    weekDates.includes(w.date) &&
    ((w.proj_id && catProjIds.has(w.proj_id)) ||
     (w.recur_id && recurringTasks.find(r => r.id === w.recur_id)?.cat_id === cat.id) ||
     (matchedType && w.type === matchedType && !w.proj_id && !w.recur_id))
  )

  if (catWeekItems.length === 0 && catRecurring.length === 0) return null

  return (
    <div>
      <SectionLabel icon="📆" label="Deze week" color={color} />

      {catRecurring.map(rt => {
        const activeDays = weekDates
          .map((date, i) => ({ date, i, scheduled: rt.days.includes(DAY_NAMES_EN_V[i]) && !rt.skip_dates?.includes(date), done: weekItems.some(w => w.recur_id === rt.id && w.date === date && w.done) }))
          .filter(x => x.scheduled)
        if (!activeDays.length) return null
        return (
          <div key={rt.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:`${color}08`, border:`1px solid ${color}20`, borderRadius:7, marginBottom:5 }}>
            <span style={{ fontSize:13, flexShrink:0 }}>↻</span>
            <span style={{ fontSize:12, flex:1, color:'#94a3b8' }}>{rt.name}</span>
            <div style={{ display:'flex', gap:3 }}>
              {activeDays.map(({ date, i, done }) => {
                const d = new Date(date+'T12:00:00')
                return (
                  <span key={date} style={{ fontSize:9, padding:'2px 6px', borderRadius:4, fontWeight:600,
                    background: done ? 'rgba(74,222,128,.2)' : `${color}18`,
                    border: `1px solid ${done ? 'rgba(74,222,128,.4)' : color+'40'}`,
                    color: done ? '#4ade80' : color }}>
                    {DAY_SHORT_NL[i]} {d.getDate()}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}

      {catWeekItems.filter(w => !w.recur_id).map(w => {
        const d = new Date(w.date+'T12:00:00')
        const di = dayIdx(w.date)
        return (
          <div key={w.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 8px', marginBottom:3, opacity: w.done ? 0.5 : 1 }}>
            <span style={{ fontSize:11, color: w.done ? '#4ade80' : color }}>{w.done ? '✓' : '○'}</span>
            <span style={{ fontSize:12, flex:1, color: w.done ? '#374151' : '#94a3b8', textDecoration: w.done ? 'line-through' : 'none' }}>{w.text}</span>
            <span style={{ fontSize:9, color:'#4b5563', flexShrink:0 }}>{DAY_SHORT_NL[di]} {d.getDate()} {MONTHS_V[d.getMonth()]}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Category detail panel ─────────────────────────────────────────────────────

function CategoryDetail({ cat, color, catGoals, weekItems, recurringTasks, projects, onSave, onToggleGoal, onDeleteGoal, onAddGoal, onOpenGoal, isMobile = false }: {
  cat: Category; color: string; catGoals: Goal[]
  weekItems: WeekItem[]
  recurringTasks: RecurringTask[]
  projects: Project[]
  onSave: (catId: string, field: string, value: string) => void
  onToggleGoal: (id: number, done: boolean) => void
  onDeleteGoal: (id: number) => void
  onAddGoal: (catId: string, horizon: GoalHorizon, text: string, deadline: string) => void
  onOpenGoal?: (id: number) => void
  isMobile?: boolean
}) {
  const sf = (field: string) => (v: string) => onSave(cat.id, field, v)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 14px' : '28px 32px' }}>
      {/* Category header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ width: 4, height: 36, borderRadius: 2, background: color, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color, marginBottom: 3 }}>
            Levensgebied
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>{cat.name}</div>
        </div>
      </div>

      {/* RPM fields */}
      <SectionLabel icon="🌟" label="Ultieme Visie" color={color} />
      <EditableField value={cat.vision} onSave={sf('vision')} placeholder="Beschrijf je ultieme visie voor dit levensgebied…" />

      <SectionLabel icon="🎯" label="Ultimate Purpose — Waarom" color={color} />
      <EditableField value={cat.purpose ?? cat.why} onSave={sf('purpose')} placeholder="Waarom is dit gebied zo essentieel voor jou?" />

      <SectionLabel icon="👤" label="Rollen" color={color} />
      <EditableField value={cat.roles} onSave={sf('roles')} placeholder="Bijv. Creator · Star · Legend" multiline={false} />

      <SectionLabel icon="⚡" label="3 to Thrive" color={color} />
      <EditableField value={cat.three_to_thrive} onSave={sf('three_to_thrive')} placeholder="De 3 dingen die het meeste impact hebben…" />

      <SectionLabel icon="🧰" label="Resources" color={color} />
      <EditableField value={cat.resources} onSave={sf('resources')} placeholder="Wat heb je al? Skills, netwerk, geld, mensen…" />

      <SectionLabel icon="🍊" label="Juicy Factor — Hoe maak je het leuker?" color={color} />
      <EditableField value={cat.juicy_factor} onSave={sf('juicy_factor')} placeholder="Wat maakt dit extra motiverend en leuk?" />

      <SectionLabel icon="📝" label="Notities" color={color} />
      <EditableField value={cat.notes} onSave={sf('notes')} placeholder="Losse gedachten over dit levensgebied die nergens anders passen…" />

      <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '22px 0 6px' }} />

      {CATEGORIE_HORIZONS.map(h => (
        <div key={h}>
          <GoalsSection label={`${HORIZON_META[h].label} doelen`} icon={HORIZON_META[h].icon} horizon={h} color={color}
            goals={catGoals.filter(g => g.horizon === h)} catId={cat.id}
            onToggle={onToggleGoal} onDelete={onDeleteGoal} onAdd={onAddGoal} onOpen={onOpenGoal} />
          <div style={{ height: 14 }} />
        </div>
      ))}

      <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '22px 0 6px' }} />

      <WeekPreviewSection cat={cat} weekItems={weekItems} recurringTasks={recurringTasks} projects={projects} color={color} />

      <div style={{ height: 32 }} />
    </div>
  )
}

// ─── Ultieme Visie — inhoud van het content-paneel ────────────────────────────
// Zelfde sentinel-waarde als 'activeCat' gebruikt om deze weergave te kiezen
// i.p.v. een categorie — staat als los "hoofdstuk" bovenaan de sidebar.
export const VISIE_KEY = '__visie__'

function UltiemeVisieContent({ categories, goals, achievements, onOpenCategory, onOpenGoal, onOpenAchievements, isMobile = false }: {
  categories: Category[]
  goals: Goal[]
  achievements: Achievement[]
  onOpenCategory: (id: string) => void
  onOpenGoal: (id: number) => void
  onOpenAchievements: () => void
  isMobile?: boolean
}) {
  const links = vindVisieLinks(categories, goals, achievements)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 14px' : '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ width: 4, height: 36, borderRadius: 2, background: '#6366f1', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#6366f1', marginBottom: 3 }}>Ultimate Vision</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>Mijn Ultieme Visie voor het Leven</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, marginBottom: 16 }}>
        {ULTIEME_VISIE_REGELS.map((regel, i) => regel === ''
          ? <div key={i} style={{ height: 8 }} />
          : <VisieRegel key={i} regel={regel} links={links} onCategory={onOpenCategory} onGoal={onOpenGoal} onAchievement={onOpenAchievements} />
        )}
      </div>
      <div style={{ padding: '12px 14px', background: 'rgba(99,102,241,.07)', borderRadius: 8, borderLeft: '3px solid #6366f1', marginBottom: 14, maxWidth: 640 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#6366f1', marginBottom: 6 }}>Persoonlijke Missie</div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
          Ik laat zien dat er een andere manier van leven mogelijk is: dat je met de natuur kunt leven, dat je kunt herstellen van een heftige mentale ziekte, dat je ondanks tegenslagen je doelen kunt behalen. Ik inspireer mensen — die inspiratie draagt eraan bij dat meer mensen hun dromen verwerkelijken.
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 640 }}>
        {['Liefde', 'Het juiste doen', 'Vrijheid & Gelijkheid', 'Wijsheid', 'Energie & Vreugde', 'Het pad is de weg'].map(s => (
          <span key={s} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)', color: '#818cf8' }}>{s}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Main VisiTab ──────────────────────────────────────────────────────────────

export default function VisiTab({ categories, goals: initialGoals, achievements = [], userId, weekItems, recurringTasks, projects, focusCatId, onCreateCategory, onDeleteCategory, onOpenGoal, onOpenAchievements }: {
  categories: Category[]
  goals: Goal[]
  achievements?: Achievement[]
  userId: string
  weekItems: WeekItem[]
  recurringTasks: RecurringTask[]
  projects: Project[]
  focusCatId?: string | null
  onCreateCategory?: (name: string) => void
  onDeleteCategory?: (id: string) => void
  onOpenGoal?: (id: number) => void
  onOpenAchievements?: () => void
}) {
  const sorted = sortCategories(categories)
  // Kleur per categorie op de volledige, ongesorteerde lijst — zo krijgt een
  // categorie hier dezelfde kleur als in Inzicht en Wins.
  const colorMap = useMemo(() => categoryColorMap(categories), [categories])
  const [cats, setCats]           = useState(sorted)
  // Nooit een weggegooid doel tonen, ook niet als de lijst er nog eentje bevat
  const [goals, setGoals]         = useState(() => activeGoals(initialGoals))
  // Verandert er elders iets aan de doelen (andere tab, de AI), dan hier ook
  useEffect(() => { setGoals(activeGoals(initialGoals)) }, [initialGoals])
  const [activeCat, setActiveCat] = useState<string>(VISIE_KEY)
  const [isMobile, setIsMobile]   = useState(false)
  const [addingCat, setAddingCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [savingCat, setSavingCat] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (focusCatId) setActiveCat(focusCatId)
  }, [focusCatId])

  async function saveField(catId: string, field: string, value: string) {
    const snapshot = cats
    setCats(c => c.map(cat => cat.id === catId ? { ...cat, [field]: value } : cat))
    const { error } = await supabase.from('categories').update({ [field]: value }).eq('id', catId).eq('user_id', userId)
    if (error) setCats(snapshot)
  }

  async function toggleGoal(goalId: number, done: boolean) {
    const goal = goals.find(g => g.id === goalId)
    const snapshot = goals
    setGoals(g => g.map(g2 => g2.id === goalId ? { ...g2, done } : g2))
    const { error } = await supabase.from('goals').update({ done }).eq('id', goalId).eq('user_id', userId)
    if (error) { setGoals(snapshot); return }

    // Een gehaald doel levert automatisch een prestatie op — ongeacht de horizon.
    // De prestatielijst zelf leeft in het dashboard; die pikt het bij de volgende
    // verversing op.
    if (goal) {
      await syncGoalAchievement(supabase, userId, goal, done, new Date().toISOString().slice(0, 10))
    }
  }

  async function deleteGoal(goalId: number) {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return
    const snapshot = goals
    setGoals(g => g.filter(x => x.id !== goalId))
    // Naar de prullenbak in plaats van echt wissen — terug te halen bij Doelen,
    // en het doel verdwijnt tegelijk uit de rest van de app.
    const res = await trashGoalEverywhere(supabase, userId, goal)
    if (!res.ok) setGoals(snapshot)
  }

  async function addGoal(catId: string, horizon: GoalHorizon, text: string, deadline: string) {
    const { data } = await supabase.from('goals').insert({
      user_id: userId, cat_id: catId,
      horizon,
      text, done: false,
      deadline: deadline || null,
    }).select('*').single()
    if (data) setGoals(prev => [...prev, data as Goal])
  }

  async function handleCreateCategory() {
    if (!newCatName.trim()) { setAddingCat(false); return }
    setSavingCat(true)
    const { data: newCat } = await supabase.from('categories').insert({ user_id: userId, name: newCatName.trim() }).select('*').single()
    if (newCat) {
      const cat = newCat as Category
      setCats(prev => [...prev, cat])
      setActiveCat(cat.id)
      onCreateCategory?.(newCatName.trim())
    }
    setNewCatName(''); setAddingCat(false); setSavingCat(false)
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('Categorie verwijderen? Projecten in deze categorie blijven bestaan maar worden ontkoppeld.')) return
    const snapshot = cats
    setCats(prev => prev.filter(c => c.id !== id))
    if (activeCat === id) setActiveCat(cats.find(c => c.id !== id)?.id ?? '')
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', userId)
    if (error) setCats(snapshot)
    else onDeleteCategory?.(id)
  }

  const selectedCat = cats.find(c => c.id === activeCat)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Mobile: horizontal pills — Ultimate vision + levensgebieden ── */}
      {isMobile && (
        <div style={{ flexShrink: 0, overflowX: 'auto', padding: '8px 12px', display: 'flex', gap: 6, scrollbarWidth: 'none' }}>
          <button onClick={() => setActiveCat(VISIE_KEY)}
            style={{ flexShrink: 0, padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: activeCat === VISIE_KEY ? 700 : 400, border: `1px solid ${activeCat === VISIE_KEY ? '#6366f1' : 'rgba(255,255,255,.12)'}`, background: activeCat === VISIE_KEY ? 'rgba(99,102,241,.2)' : 'transparent', color: activeCat === VISIE_KEY ? '#818cf8' : '#64748b', transition: 'all .15s' }}>
            🌟 Ultimate vision
          </button>
          {cats.map(cat => {
            const color = colorMap.get(cat.id) ?? CAT_COLORS[0]
            const isActive = cat.id === activeCat
            return (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                style={{ flexShrink: 0, padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: isActive ? 700 : 400, border: `1px solid ${isActive ? color : 'rgba(255,255,255,.12)'}`, background: isActive ? `${color}20` : 'transparent', color: isActive ? color : '#64748b', transition: 'all .15s' }}>
                {cat.name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Sidebar + detail layout ────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', marginTop: isMobile ? 0 : 16 }}>

        {/* Sidebar (desktop only) */}
        {!isMobile && (
          <div style={{
            width: 188, flexShrink: 0, background: 'var(--bg2)', overflowY: 'auto', borderRight: '1px solid var(--border)',
            padding: '6px 0',
          }}>
            <button onClick={() => setActiveCat(VISIE_KEY)}
              style={{
                width: '100%', textAlign: 'left', background: activeCat === VISIE_KEY ? 'rgba(99,102,241,0.08)' : 'transparent',
                border: 'none', borderLeft: `2px solid ${activeCat === VISIE_KEY ? '#6366f1' : 'transparent'}`,
                padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all .15s', fontSize: 12,
              }}
              onMouseEnter={e => { if (activeCat !== VISIE_KEY) e.currentTarget.style.background = 'rgba(99,102,241,0.04)' }}
              onMouseLeave={e => { if (activeCat !== VISIE_KEY) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>🌟</span>
              <span style={{ fontSize: 12, fontWeight: activeCat === VISIE_KEY ? 700 : 500, color: activeCat === VISIE_KEY ? 'var(--text)' : 'var(--muted)' }}>Ultimate vision</span>
            </button>
            <div style={{ height: 1, background: 'var(--border)', margin: '6px 10px' }} />
            <div style={{ padding: '8px 12px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--dim)' }}>Levensgebieden</div>
            {cats.map(cat => {
              const color = colorMap.get(cat.id) ?? CAT_COLORS[0]
              const catGoals = goals.filter(g => g.cat_id === cat.id && !g.done)
              const isActive = cat.id === activeCat
              return (
                <div key={cat.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.querySelector<HTMLButtonElement>('.del-cat')!.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.querySelector<HTMLButtonElement>('.del-cat')!.style.opacity = '0'}>
                  <button onClick={() => setActiveCat(cat.id)}
                    style={{
                      flex: 1, textAlign: 'left', background: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                      border: 'none', borderLeft: `2px solid ${isActive ? '#6366f1' : 'transparent'}`,
                      padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                      transition: 'all .15s', fontSize: 12,
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(99,102,241,0.04)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>{categoryIcon(cat.name)}</span>
                    <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text)' : 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.name}
                    </span>
                    {catGoals.length > 0 && (
                      <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--dim)', flexShrink: 0 }}>
                        {catGoals.length}
                      </span>
                    )}
                  </button>
                  <button className="del-cat" onClick={() => handleDeleteCategory(cat.id)} title="Categorie verwijderen"
                    style={{ position: 'absolute', right: 6, opacity: 0, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, padding: '2px 4px', borderRadius: 3, transition: 'opacity .15s, color .1s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>×</button>
                </div>
              )
            })}

            {/* Add category */}
            {addingCat ? (
              <div style={{ padding: '8px 14px' }}>
                <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName('') } }}
                  onBlur={handleCreateCategory}
                  placeholder="Naam categorie…"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid rgba(99,102,241,.4)', color: 'var(--text)', borderRadius: 5, padding: '5px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
              </div>
            ) : (
              <button onClick={() => setAddingCat(true)} disabled={savingCat}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderLeft: '2px solid transparent', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--dim)', fontSize: 12, transition: 'color .15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--dim)'}>
                + Categorie toevoegen
              </button>
            )}
          </div>
        )}

        {/* Detail panel */}
        {activeCat === VISIE_KEY ? (
          <UltiemeVisieContent
            categories={cats} goals={goals} achievements={achievements}
            onOpenCategory={setActiveCat}
            onOpenGoal={id => onOpenGoal?.(id)}
            onOpenAchievements={() => onOpenAchievements?.()}
            isMobile={isMobile}
          />
        ) : selectedCat && (
          <CategoryDetail
            key={selectedCat.id}
            cat={selectedCat}
            color={colorMap.get(selectedCat.id) ?? CAT_COLORS[0]}
            catGoals={goals.filter(g => g.cat_id === selectedCat.id)}
            weekItems={weekItems}
            recurringTasks={recurringTasks}
            projects={projects}
            onSave={saveField}
            onToggleGoal={toggleGoal}
            onDeleteGoal={deleteGoal}
            onAddGoal={addGoal}
            onOpenGoal={onOpenGoal}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  )
}

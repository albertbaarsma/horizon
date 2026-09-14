'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { plannedTaskDates } from '@/lib/planned-tasks'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { DashboardData, Task, Project, Category, TaskStatus, ProjectStatus, WeekItem, RecurringTask, Goal, Achievement, Subtask, XpEvent, DiaryEntry, MoodEntry, ShoppingItem, GoalHorizon } from '@/lib/types'
import { goalAchievementText, syncGoalAchievement } from '@/lib/goal-achievement'
import { resolveHorizonDrop, withOriginalDeadline } from '@/lib/deadline-horizon'
import { activeGoals, trashGoalEverywhere, restoreGoalEverywhere } from '@/lib/goal-links'
import { checkIsDue, type ItemKind } from '@/lib/consistency'
import { computeMissingOccurrences, MATERIALIZE_WINDOW_DAYS } from '@/lib/recurring'
import type { FixAction } from './ConsistencyPanel'
import VisiTab from './VisiTab'
import MonthView from './MonthView'
import { YouTubeTab } from './YouTubeTab'
import { MailTab } from './MailTab'
import { WeekTab, WeekItemDetailPanel, CtxItem, type DetailPanelState, WEEK_TYPE } from './WeekTab'
import { DiaryTab } from './DiaryTab'
import { RoutinesPanel } from './RoutinesPanel'
import { GraphTab } from './GraphTab'
import { TasksTab, KANBAN_COLS } from './TasksTab'
import { GoalTrashDialog, type TaskKeuze } from './GoalTrashDialog'
import { tasksForGoal } from '@/lib/goal-tasks'
import { UsageTracker, type UsageEvent } from '@/lib/usage'
import { JarvisWidget } from './JarvisWidget'
import { JournalWidget } from './JournalWidget'
import { ErrorBoundary } from './ErrorBoundary'
import { PlanningSessionModal } from './PlanningSessionModal'
import { ProjectsTab, ProjectModal, CreateProjectModal } from './ProjectsView'
import { GoalModal } from './GoalsView'
import { UitwerkPanel } from './UitwerkPanel'
import { ShoppingListPanel } from './ShoppingListPanel'
import { verzamelNietSmart } from '@/lib/uitwerk-overzicht'
import { NotificationBell, type AlertItem } from './NotificationBell'
import { DagTab } from './DagTab'
import { WeekReviewModal } from './WeekReviewModal'
import { ShutdownModal } from './ShutdownModal'
import { FocusTimer } from './FocusTimer'
import { XpBar } from './XpBar'
import { OnboardingTour } from './OnboardingTour'
import { SetupWizard } from './SetupWizard'
import { StatsSheet } from './StatsSheet'
import { levelForXp, XP_AMOUNTS } from '@/lib/xp'
import { parseQuickAdd } from '@/lib/parse-quick-add'
import { hasUnseenIds, pruneDismissed, loadDismissed, saveDismissed } from '@/lib/alerts'
import { RecurringTaskModal } from './RecurringTaskModal'
import { TaskModal } from './TaskModal'
import { GoalsTab } from './GoalsTab'
import { AchievementsTab } from './AchievementsTab'
import { SearchModal } from './SearchModal'
import { QuickAddModal } from './QuickAddModal'
import { LangProvider } from '@/lib/i18n/LangContext'
import { resolveLang } from '@/lib/lang'
import { DASHBOARD_CHROME } from '@/lib/i18n/dashboard-chrome'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  actief: '#3fb950', lopend: '#58a6ff', urgent: '#f85149',
  soon: '#d29922', visie: '#bc8cff', slapend: '#484f58',
  onzeker: '#fb8f44', love: '#f778ba',
}
const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: '#484f58', doing: '#58a6ff', waiting: '#d29922', done: '#3fb950',
}
const DAYS_NL  = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']

type Tab = 'dag' | 'week' | 'month' | 'projects' | 'tasks' | 'goals' | 'achievements' | 'visie' | 'overige'
// Eerst tijd: dag → week → maand. Dan het werk zelf, van klein naar groot:
// taken zitten in projecten, projecten komen uit doelen. Daarna terugkijken:
// wins. Inzicht, YouTube, Mail, Plansessie, Weekreview, Dag afsluiten, AI/chat
// en Voortgang (level/XP) zitten allemaal onder Overige — 1 menu-item met een
// eigen linker submenu (zelfde vorm als Inzicht dat altijd al had), zodat de
// hoofdbalk niet volloopt met dingen die de meeste dagen niet nodig zijn.
const TABS: Tab[] = ['dag','week','month','tasks','projects','goals','achievements','visie','overige']
// De 9 dingen die onder Overige samenkomen — 3 daarvan (graph/youtube/mail)
// zijn een volwaardige weergave met eigen inhoud, de rest is een kant-en-klare
// actie (modal openen / event versturen / linken) die al bestond als losse
// topbar-knop. Zelfde sleutels worden hergebruikt voor mobile_hidden_features.
type OverigeKey = 'graph' | 'youtube' | 'mail' | 'voortgang' | 'plansessie' | 'weekreview' | 'dagafsluiten' | 'ai' | 'chat'
const OVERIGE_VIEW_KEYS: OverigeKey[] = ['graph', 'youtube', 'mail']
const OVERIGE_ALL_KEYS: OverigeKey[] = ['graph', 'youtube', 'mail', 'voortgang', 'plansessie', 'weekreview', 'dagafsluiten', 'ai', 'chat']
type CtxMenu = { x:number; y:number; item:WeekItem; date:string; proj:Project|null; catObj:Category|null; catGoals:Goal[] }

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardClient({ data, userId, today }: {
  data: DashboardData; userId: string; userEmail: string; today: string
}) {
  const [tasks,          setTasks]          = useState(data.tasks)
  const [projects,       setProjects]       = useState(data.projects)
  const [weekItems,      setWeekItems]      = useState(data.weekItems)
  const [recurringTasks, setRecurringTasks] = useState(data.recurringTasks)
  const [achievements,   setAchievements]   = useState<Achievement[]>(data.achievements)
  const [diaryEntries,   setDiaryEntries]   = useState<DiaryEntry[]>(data.diaryEntries ?? [])
  const [moodEntries,    setMoodEntries]    = useState<MoodEntry[]>(data.moodEntries ?? [])
  const [shoppingItems,  setShoppingItems]  = useState<ShoppingItem[]>(data.shoppingItems ?? [])
  const [categories,     setCategories]     = useState<Category[]>(data.categories)
  const [selectedProject,setSelectedProject]= useState<Project|null>(null)
  const [selectedGoal,   setSelectedGoal]   = useState<Goal|null>(null)
  // Waar de app opent: jouw keuze uit het gebruiksoverzicht, anders de week
  const [activeTab,      setActiveTab]      = useState<Tab>(
    (data.profile.start_tab && (TABS as string[]).includes(data.profile.start_tab)) ? data.profile.start_tab as Tab : 'week')
  const [now,            setNow]            = useState(() => new Date(today + 'T12:00:00'))
  const [ctxMenu,        setCtxMenu]        = useState<CtxMenu|null>(null)
  const [taskModal,      setTaskModal]      = useState<Task|null>(null)
  const [showRecurModal, setShowRecurModal] = useState(false)
  const [showRoutines,   setShowRoutines]   = useState(false)
  const [showSetup,      setShowSetup]      = useState(false)
  const [weekViewMode,   setWeekViewMode]   = useState<'week'|'month'>('week')
  const [weekJumpDate,   setWeekJumpDate]   = useState<string|null>(null)
  const [detailPanel,    setDetailPanel]    = useState<DetailPanelState | null>(null)
  const [visieFocusCat,  setVisieFocusCat]  = useState<string | null>(null)
  const [isOnline,       setIsOnline]       = useState(true)
  const [mounted,        setMounted]        = useState(false)
  const [planningOpen,   setPlanningOpen]   = useState(false)
  const [weekReviewOpen, setWeekReviewOpen] = useState(false)
  const [shutdownOpen,   setShutdownOpen]   = useState(false)
  const [focusTask,      setFocusTask]      = useState<Task|null>(null)
  const [weather,        setWeather]        = useState<{temp:number;icon:string;desc:string}|null>(null)
  const [showSearch,     setShowSearch]     = useState(false)
  const [showQuickAdd,   setShowQuickAdd]   = useState(false)
  const [goals,          setGoals]          = useState(data.goals)
  // Overal buiten de prullenbak geldt: een weggegooid doel of een weggegooide
  // taak bestaat niet meer. Alleen het overzicht met de prullenbak zelf krijgt
  // de volledige lijst.
  const levendeDoelen = useMemo(() => activeGoals(goals), [goals])
  const levendeTaken  = useMemo(() => tasks.filter(t => !t.deleted_at), [tasks])

  // Wanneer heb je alles voor het laatst nagekeken? (Wekelijkse controle.)
  const [lastCheck, setLastCheck] = useState<string | null>(null)
  // Een doel weggooien vraagt eerst wat er met de gekoppelde taken moet gebeuren
  const [goalTrashAsk, setGoalTrashAsk] = useState<Goal | null>(null)

  // ── Gebruik meten ────────────────────────────────────────────────────────
  // Zonder meting geen verbetering: hier wordt bijgehouden welke tabs en
  // onderdelen je gebruikt. Alleen sleutels en tijd, nooit de inhoud.
  const [tracking, setTracking]     = useState(data.profile.usage_tracking !== false)
  const [hiddenTabs, setHiddenTabs] = useState<string[]>(data.profile.hidden_tabs ?? [])
  // Zelfde idee als hiddenTabs, maar voor mobiel — daar is de standaard juist
  // "alles uit" (zie supabase/add-mobile-hidden-features.sql), dus los gehouden.
  const [mobileHiddenFeatures, setMobileHiddenFeatures] = useState<string[]>(data.profile.mobile_hidden_features ?? [])
  const [overigeView, setOverigeView] = useState<OverigeKey>('graph')
  // Meldingsbalkjes los bovenin tonen — standaard uit, dan zitten ze alleen onder het belletje.
  // Zet je 'm om via Instellingen, dan laadt deze pagina opnieuw en pakt de nieuwe waarde vanzelf op.
  const showAlertBanners = data.profile.show_alert_banners === true
  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>([])
  const trackingRef = useRef(tracking)
  useEffect(() => { trackingRef.current = tracking }, [tracking])

  const trackerRef = useRef<UsageTracker | null>(null)
  if (!trackerRef.current) {
    trackerRef.current = new UsageTracker(
      async rijen => {
        await supabase.from('usage_events').insert(rijen.map(r => ({ user_id: userId, ...r })))
      },
      () => trackingRef.current,
    )
  }
  const track = (key: string) => trackerRef.current?.feature(key)

  // Tabwissel meten, en de buffer periodiek (en bij weggaan) wegschrijven
  useEffect(() => { trackerRef.current?.tab(activeTab) }, [activeTab])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === 'overige' && overigeView === 'graph') loadUsage() }, [activeTab, overigeView])
  useEffect(() => {
    const t = trackerRef.current!
    const iv = setInterval(() => { t.flush() }, 60_000)
    const bye = () => { t.flush() }
    window.addEventListener('beforeunload', bye)
    document.addEventListener('visibilitychange', () => { if (document.hidden) t.flush() })
    return () => { clearInterval(iv); window.removeEventListener('beforeunload', bye); t.flush() }
  }, [])

  /** De meting ophalen zodra je het gebruiksoverzicht opent. */
  async function loadUsage() {
    await trackerRef.current?.flush()
    const { data: rows } = await supabase.from('usage_events')
      .select('kind, target, seconds, created_at').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(5000)
    setUsageEvents((rows ?? []) as UsageEvent[])
  }

  async function setStartTab(tab: string) {
    await supabase.from('profiles').update({ start_tab: tab }).eq('id', userId)
    setDeleteToast(`De app opent nu op ${tab}`)
    if (deleteToastTimerRef.current) clearTimeout(deleteToastTimerRef.current)
    deleteToastTimerRef.current = setTimeout(() => setDeleteToast(null), 2500)
  }

  async function toggleHiddenTab(tab: string) {
    const next = hiddenTabs.includes(tab) ? hiddenTabs.filter(t => t !== tab) : [...hiddenTabs, tab]
    setHiddenTabs(next)
    if (next.includes(activeTab)) setActiveTab('dag')
    await supabase.from('profiles').update({ hidden_tabs: next }).eq('id', userId)
  }

  async function toggleMobileFeature(key: string) {
    const next = mobileHiddenFeatures.includes(key) ? mobileHiddenFeatures.filter(k => k !== key) : [...mobileHiddenFeatures, key]
    setMobileHiddenFeatures(next)
    await supabase.from('profiles').update({ mobile_hidden_features: next }).eq('id', userId)
  }

  /** Overige-item aanklikken: 3 ervan wisselen de inhoud, de rest voert meteen de bijbehorende actie uit. */
  function pickOverige(key: OverigeKey) {
    if ((OVERIGE_VIEW_KEYS as string[]).includes(key)) { setOverigeView(key as 'graph' | 'youtube' | 'mail'); setActiveTab('overige'); return }
    if (key === 'voortgang')    { setShowStats(true); return }
    if (key === 'plansessie')   { setPlanningOpen(true); return }
    if (key === 'weekreview')   { setWeekReviewOpen(true); return }
    if (key === 'dagafsluiten') { setShutdownOpen(true); return }
    if (key === 'ai')           { window.dispatchEvent(new CustomEvent('open-jarvis')); return }
  }

  async function setUsageTracking(aan: boolean) {
    setTracking(aan)
    await supabase.from('profiles').update({ usage_tracking: aan }).eq('id', userId)
  }

  async function clearUsage() {
    setUsageEvents([])
    await supabase.from('usage_events').delete().eq('user_id', userId)
  }
  useEffect(() => { setLastCheck(localStorage.getItem('controle-laatste')) }, [])
  const [xpEvents,       setXpEvents]       = useState<XpEvent[]>(data.xpEvents)
  const [showTour,       setShowTour]       = useState(false)
  const [showStats,      setShowStats]      = useState(false)
  const [levelUpToast,   setLevelUpToast]   = useState<number | null>(null)
  const [mutationToast,  setMutationToast]  = useState<{ message: string; tab: Tab } | null>(null)
  const [weekSplit,      setWeekSplit]      = useState(false)
  const [splitPos,       setSplitPos]       = useState(57)
  const [deleteToast,    setDeleteToast]    = useState<string | null>(null)
  const [isMobile,       setIsMobile]       = useState(false)
  const [vw,             setVw]             = useState(1280)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [dismissedUrgent,  setDismissedUrgent]  = useState<number[]>([])
  const [dismissedOverdue, setDismissedOverdue] = useState<number[]>([])
  const [dismissedUitwerk, setDismissedUitwerk] = useState<string[]>([])
  const [uitwerkPanelOpen, setUitwerkPanelOpen] = useState(false)
  const [shoppingPanelOpen, setShoppingPanelOpen] = useState(false)
  const [journalOpen,       setJournalOpen]       = useState(false)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const splitContainerRef  = useRef<HTMLDivElement>(null)
  const undoStackRef       = useRef<Array<{ task: Task; timerId: ReturnType<typeof setTimeout> }>>([])
  const deleteToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const weekItemsRef       = useRef(weekItems)
  const supabase = createClient()
  const router   = useRouter()
  const todayStr = new Date(today + 'T12:00:00').toISOString().slice(0, 10)
  // Onafhankelijk van welke week net op het scherm staat — voor het sidebar-badge.
  const weekOverdueCount = useMemo(() => weekItems.filter(i => i.date < todayStr && !i.done).length, [weekItems, todayStr])

  async function refreshFromDb() {
    const [{ data: t }, { data: wi }, { data: rt }, { data: ac }, { data: pr }, { data: xp }, { data: di }, { data: go }] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('week_items').select('*').eq('user_id', userId).order('date').order('id'),
      supabase.from('recurring_tasks').select('*').eq('user_id', userId).order('id'),
      supabase.from('achievements').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('projects').select('*').eq('user_id', userId).order('sort_order').order('created_at'),
      supabase.from('xp_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
      supabase.from('diary_entries').select('*').eq('user_id', userId).order('date', { ascending: false }).order('id', { ascending: false }).limit(300),
      // Doelen horen hier ook bij: past de AI (of een ander tabblad) een doel
      // aan, dan moet de hele app dat meteen zien.
      supabase.from('goals').select('*').eq('user_id', userId).order('id'),
    ])
    if (t)  setTasks(t as Task[])
    if (wi) setWeekItems(wi as WeekItem[])
    if (rt) setRecurringTasks(rt as RecurringTask[])
    if (ac) setAchievements(ac as Achievement[])
    if (pr) setProjects(pr as Project[])
    if (go) setGoals(go as Goal[])
    if (di) setDiaryEntries(di as DiaryEntry[])
    if (xp) {
      const before = levelForXp(xpEvents.reduce((s, e) => s + e.amount, 0))
      const after  = levelForXp((xp as XpEvent[]).reduce((s, e) => s + e.amount, 0))
      setXpEvents(xp as XpEvent[])
      if (after > before) { setLevelUpToast(after); setTimeout(() => setLevelUpToast(null), 6000) }
    }
  }

  // XP-events als gedaan markeren (opent het paneel → geen ongelezen badge meer)
  async function markXpSeen() {
    setXpEvents(prev => prev.map(e => e.seen ? e : { ...e, seen: true }))
    await supabase.from('xp_events').update({ seen: true }).eq('user_id', userId).eq('seen', false)
  }

  // Onboarding: eerste doel aanmaken (levert XP via de goals-trigger)
  async function createOnboardingGoal(text: string, catId: string | null) {
    const { data: row } = await supabase.from('goals')
      .insert({ user_id: userId, text, horizon: 'jaar', cat_id: catId, done: false })
      .select('*').single()
    if (row) setGoals(prev => [row as Goal, ...prev])
    await refreshFromDb()
  }

  // Onboarding afronden: bonus-XP + vlag zetten
  async function finishOnboarding() {
    await supabase.from('xp_events').insert({
      user_id: userId, amount: XP_AMOUNTS.tutorial, reason: 'Rondleiding afgerond', source: 'tutorial',
    })
    await supabase.from('profiles').update({ onboarding_done: true }).eq('id', userId)
    await refreshFromDb()
  }

  useEffect(() => { weekItemsRef.current = weekItems }, [weekItems])

  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date())
      if (typeof window === 'undefined' || !('Notification' in window)) return
      if (Notification.permission !== 'granted') return
      const n = new Date()
      const nowMin = n.getHours() * 60 + n.getMinutes()
      weekItemsRef.current
        .filter(w => w.date === todayStr && w.time_block && !w.done)
        .forEach(w => {
          const [h, m] = (w.time_block ?? '').split(':').map(Number)
          const blockMin = h * 60 + m
          if (blockMin - nowMin >= 4 && blockMin - nowMin <= 6) {
            new Notification('⏰ Taak over 5 minuten', {
              body: `${w.time_block} — ${w.text}`,
              tag: `tb-${w.id}`,
            })
          }
        })
    }, 60000)
    return () => clearInterval(t)
  }, [todayStr])

  useEffect(() => {
    fetch('/api/weather').then(r => r.json()).then(d => {
      if (d.current) setWeather({ temp: Math.round(d.current.temperature), icon: d.current.icon || '🌤', desc: d.current.description })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setMounted(true)
    setIsOnline(navigator.onLine)
    // Startgesprek bij een nieuw account; ?setup=1 opent het altijd opnieuw.
    const wantsSetup = new URLSearchParams(window.location.search).get('setup') === '1'
    if (data.profile.setup_done === false || wantsSetup) setShowSetup(true)
    // Rondleiding pas daarna — niet twee vensters tegelijk over elkaar.
    else if (data.profile.onboarding_done === false) setShowTour(true)
    const up   = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online',  up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [data.profile.onboarding_done])

  // close context menu on outside click / Escape
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('click',   close)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey) }
  }, [!!ctxMenu])

  useEffect(() => {
    const check = () => { setIsMobile(window.innerWidth < 768); setVw(window.innerWidth) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Weggeklikte meldingen laden (blijven weg tot er een nieuw item bijkomt)
  useEffect(() => {
    setDismissedUrgent(loadDismissed('alert-urgent-weggeklikt'))
    setDismissedOverdue(loadDismissed('alert-overdue-weggeklikt'))
    setDismissedUitwerk(loadDismissed('alert-uitwerk-weggeklikt', 'string'))
  }, [])

  // Alt+1–9 switches tabs
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx < TABS.length) { e.preventDefault(); setActiveTab(TABS[idx]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Ctrl+K → search; Ctrl+Z → undo delete; N → quick-add today
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        const tag = (document.activeElement as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault(); undoDelete(); return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault(); setShowSearch(s => !s); return
      }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (document.activeElement as HTMLElement)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault(); setShowQuickAdd(s => !s)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const todayName       = DAYS_NL[now.getDay()]
  // Tablet/smal venster: compacte emoji-tabs zodat alle 11 tabs zichtbaar blijven
  const compactTabs     = vw < 1150
  const showWeather     = vw >= 900
  // Rondzwevende AI-/dagboek-knopjes: op telefoon én tablet (tot 1024px) staan
  // ze al in het ☰ Meer-menu, dus geen los FAB'tje meer nodig dat in de weg zit.
  const showFloatingFabs = vw >= 1024
  const urgentTasks     = tasks.filter(t => t.urgent && t.status !== 'done')
  const activeTasks     = tasks.filter(t => t.status !== 'done' && (t.urgent || t.status === 'doing'))
  // Alleen de afgelopen week — is iets langer geleden niet bijgewerkt, dan hoeft
  // de app daar niet steeds opnieuw over te blijven melden.
  const eenWeekGeleden  = new Date(new Date(todayStr).getTime() - 7 * 86400000).toISOString().slice(0, 10)
  const overdueItems    = weekItems.filter(w => w.date < todayStr && w.date >= eenWeekGeleden && !w.done)
  const todayOpenItems  = weekItems.filter(w => w.date === todayStr && !w.done).length
  const urgentIds       = urgentTasks.map(t => t.id)
  const overdueIds      = overdueItems.map(w => w.id)
  const showUrgentBar     = hasUnseenIds(urgentIds, dismissedUrgent)
  const showOverdueBanner = hasUnseenIds(overdueIds, dismissedOverdue)
  // Eén keer per week: klopt de administratie nog met zichzelf?
  const checkDue          = checkIsDue(lastCheck, now)

  // Doelen en projecten zonder duidelijk result — gecombineerd, want ze horen
  // bij dezelfde vraag: is dit eigenlijk wel SMART?
  const nietSmart      = useMemo(() => verzamelNietSmart(levendeDoelen, projects, tasks), [levendeDoelen, projects, tasks])
  const nietSmartIds   = nietSmart.map(i => i.id)
  const showUitwerkBar = hasUnseenIds(nietSmartIds, dismissedUitwerk)

  // Snoei weggeklikte ids die niet meer bestaan, zodat een item dat later
  // opnieuw urgent/achterstallig wordt weer gewoon een melding geeft
  useEffect(() => {
    setDismissedUrgent(prev => {
      const next = pruneDismissed(prev, urgentIds)
      if (next.length !== prev.length) { saveDismissed('alert-urgent-weggeklikt', next); return next }
      return prev
    })
    setDismissedOverdue(prev => {
      const next = pruneDismissed(prev, overdueIds)
      if (next.length !== prev.length) { saveDismissed('alert-overdue-weggeklikt', next); return next }
      return prev
    })
    setDismissedUitwerk(prev => {
      const next = pruneDismissed(prev, nietSmartIds)
      if (next.length !== prev.length) { saveDismissed('alert-uitwerk-weggeklikt', next); return next }
      return prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urgentIds.join(','), overdueIds.join(','), nietSmartIds.join(',')])

  function dismissUitwerkBar() {
    setDismissedUitwerk(nietSmartIds)
    saveDismissed('alert-uitwerk-weggeklikt', nietSmartIds)
  }

  function dismissUrgentBar() {
    setDismissedUrgent(urgentIds)
    saveDismissed('alert-urgent-weggeklikt', urgentIds)
  }
  function dismissOverdueBanner() {
    setDismissedOverdue(overdueIds)
    saveDismissed('alert-overdue-weggeklikt', overdueIds)
  }

  // Alle meldingen ook onder het belletje — dat blijft de vaste plek, los van
  // of de balkjes er bovenin ook nog los bij staan (show_alert_banners).
  const alertItems: AlertItem[] = useMemo(() => {
    const items: AlertItem[] = []
    if (showUrgentBar) items.push({
      key: 'urgent', icon: '⚡', color: '#fb923c', onDismiss: dismissUrgentBar,
      dismissTitle: 'Wegklikken — komt terug zodra er een nieuwe urgente taak bijkomt',
      body: (
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{urgentTasks.length} urgente taak{urgentTasks.length === 1 ? '' : 'en'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {urgentTasks.map(t => {
              const proj = projects.find(p => p.id === t.proj_id)
              return (
                <button key={t.id} onClick={() => setTaskModal(t)} title="Open taakdetails"
                  style={{ background: '#3d1a00', border: '1px solid #5c2800', borderRadius: 4, padding: '2px 8px', color: '#fca5a5', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                  {proj?.emoji} {kort(t.name, 28)}
                </button>
              )
            })}
          </div>
        </div>
      ),
    })
    if (showOverdueBanner) items.push({
      key: 'overdue', icon: '⏰', color: '#d29922', onDismiss: dismissOverdueBanner,
      dismissTitle: 'Wegklikken — komt terug zodra er een nieuw achterstallig item bijkomt',
      body: (
        <span>
          {overdueItems.length} niet-afgerond{overdueItems.length === 1 ? '' : 'e'} {overdueItems.length === 1 ? 'item' : 'items'} van vorige week{' '}
          <button onClick={() => setActiveTab('week')} style={{ background: 'none', border: 'none', color: '#d29922', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0 }}>
            Bekijken →
          </button>
        </span>
      ),
    })
    if (checkDue) items.push({
      key: 'controle', icon: '🔍', color: '#58a6ff', onDismiss: markChecked,
      dismissTitle: 'Wegklikken — komt volgende week terug',
      body: (
        <span>
          Tijd voor de wekelijkse controle — klopt alles nog met elkaar?{' '}
          <button onClick={() => { try { localStorage.setItem('inzicht-modus', 'controle') } catch { /* privémodus */ }; setOverigeView('graph'); setActiveTab('overige') }}
            style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0 }}>
            Nakijken →
          </button>
        </span>
      ),
    })
    if (showUitwerkBar) items.push({
      key: 'uitwerk', icon: '🧭', color: '#c4b5fd', onDismiss: dismissUitwerkBar,
      dismissTitle: 'Wegklikken — komt terug zodra er een nieuw doel of project bijkomt',
      body: (
        <span>
          {nietSmart.length} doel{nietSmart.length === 1 ? '' : 'en'} en project{nietSmart.length === 1 ? '' : 'en'} {nietSmart.length === 1 ? 'mist' : 'missen'} nog een duidelijk result{' '}
          <button onClick={() => setUitwerkPanelOpen(true)} style={{ background: 'none', border: 'none', color: '#c4b5fd', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0 }}>
            Uitwerken →
          </button>
        </span>
      ),
    })
    return items
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUrgentBar, showOverdueBanner, checkDue, showUitwerkBar, urgentTasks, overdueItems, nietSmart, projects])

  const projectTasks    = (id: string) => tasks.filter(t => t.proj_id === id)
  const byCat           = categories.map(c => ({ ...c, projects: projects.filter(p => p.cat_id === c.id) }))

  async function toggleWeekItem(id: number) {
    const item = weekItems.find(w => w.id === id)
    if (!item) return
    const done = !item.done
    const prev = weekItems
    setWeekItems(p => p.map(w => w.id === id ? { ...w, done } : w))
    const { error } = await supabase.from('week_items').update({ done }).eq('id', id).eq('user_id', userId)
    if (error) { setWeekItems(prev); return }
    // Sync linked task: marking done → task becomes 'done', unmarking → 'doing'
    if (item.task_id) {
      const taskId = parseInt(item.task_id)
      if (!isNaN(taskId)) await updateTask(taskId, done ? 'done' : 'doing')
    }
  }

  async function moveWeekItem(id: number, newDate: string) {
    const item = weekItems.find(w => w.id === id)
    const prev = weekItems
    // Uitstellen = een open item van vandaag/verleden naar later schuiven
    const isPostpone = !!item && !item.done && item.date <= todayStr && newDate > item.date
    const newCount = (item?.postponed_count ?? 0) + (isPostpone ? 1 : 0)
    // Een herhalende bezetting die naar een andere dag verhuist: de eerste keer
    // onthouden we de oorspronkelijke dag (moved_from), zodat materialisatie
    // 'm daar niet nogmaals aanmaakt voor deze week. Het patroon zelf
    // (recurring_tasks.days) verandert hier niet van.
    const movedFrom = item?.recur_id && !item.moved_from ? item.date : undefined
    setWeekItems(p => p.map(w => w.id === id ? { ...w, date: newDate, postponed_count: newCount, ...(movedFrom ? { moved_from: movedFrom } : {}) } : w))
    const payload: Record<string, unknown> = { date: newDate, ...(isPostpone ? { postponed_count: newCount } : {}), ...(movedFrom ? { moved_from: movedFrom } : {}) }
    let { error } = await supabase.from('week_items').update(payload).eq('id', id).eq('user_id', userId)
    if (error && isPostpone) {
      // Kolom postponed_count bestaat mogelijk nog niet (migratie niet gedraaid) — val terug op alleen datum
      ;({ error } = await supabase.from('week_items').update({ date: newDate, ...(movedFrom ? { moved_from: movedFrom } : {}) }).eq('id', id).eq('user_id', userId))
    }
    if (error) setWeekItems(prev)
  }

  /** Herschikken binnen dezelfde dag — WeekTab heeft de nieuwe sort_order-
   *  waarden al berekend (reorderList), hier alleen nog toepassen + opslaan. */
  function reorderWeekItems(updates: { id: number; sort_order: number }[]) {
    setWeekItems(p => p.map(w => {
      const u = updates.find(x => x.id === w.id)
      return u ? { ...w, sort_order: u.sort_order } : w
    }))
    updates.forEach(u => { supabase.from('week_items').update({ sort_order: u.sort_order }).eq('id', u.id).eq('user_id', userId) })
  }

  async function updateTask(id: number, status: TaskStatus) {
    track(status === 'done' ? 'taak-afvinken' : 'taak-status')
    const prev = tasks
    setTasks(p => p.map(t => t.id === id ? { ...t, status } : t))
    const { error } = await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setTasks(prev)
  }

  async function updateTaskDuration(id: number, duration_min: number | null) {
    const prev = tasks
    setTasks(p => p.map(t => t.id === id ? { ...t, duration_min } : t))
    const { error } = await supabase.from('tasks').update({ duration_min, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setTasks(prev)
  }

  async function updateTaskPriority(id: number, priority: number) {
    const prev = tasks
    setTasks(p => p.map(t => t.id === id ? { ...t, priority } : t))
    const { error } = await supabase.from('tasks').update({ priority, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setTasks(prev)
  }

  async function addActualMin(id: number, minutes: number) {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const actual_min = (task.actual_min ?? 0) + minutes
    const prev = tasks
    setTasks(p => p.map(t => t.id === id ? { ...t, actual_min } : t))
    const { error } = await supabase.from('tasks').update({ actual_min, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setTasks(prev)
  }

  async function updateTaskNotes(id: number, notes: string) {
    const prev = tasks
    setTasks(p => p.map(t => t.id === id ? { ...t, notes } : t))
    const { error } = await supabase.from('tasks').update({ notes: notes || null, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setTasks(prev)
  }

  async function renameTask(id: number, name: string) {
    const oudeNaam = tasks.find(t => t.id === id)?.name
    const prev = tasks
    setTasks(p => p.map(t => t.id === id ? { ...t, name } : t))
    const { error } = await supabase.from('tasks').update({ name, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) { setTasks(prev); return }
    // Weekitems die de taaknaam overnamen bij het inplannen, krijgen de nieuwe naam mee.
    // Een item waarvan je de tekst zelf al had aangepast, blijft zoals het is.
    const gekoppeld = weekItems.filter(w => w.task_id === String(id) && w.text === oudeNaam).map(w => w.id)
    if (gekoppeld.length) {
      setWeekItems(p => p.map(w => gekoppeld.includes(w.id) ? { ...w, text: name } : w))
      await supabase.from('week_items').update({ text: name }).in('id', gekoppeld).eq('user_id', userId)
    }
  }

  async function updateTaskSubtasks(id: number, subtasks: Subtask[]) {
    const prev = tasks
    setTasks(p => p.map(t => t.id === id ? { ...t, subtasks } : t))
    const { error } = await supabase.from('tasks').update({ subtasks, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setTasks(prev)
  }

  async function addWinAchievement(text: string) {
    const { data: row } = await supabase.from('achievements').insert({
      user_id: userId, text, emoji: '🏆', date: todayStr, cat_id: null,
    }).select().single()
    if (row) setAchievements(prevA => [row as Achievement, ...prevA])
  }

  async function createTaskFromMail(projId: string, name: string) {
    const { data: newTask } = await supabase.from('tasks').insert({
      user_id: userId, proj_id: projId, name, status: 'backlog', urgent: false,
    }).select('*').single()
    if (newTask) setTasks(prev => [newTask as Task, ...prev])
  }

  /** Verwijderen van een gematerialiseerde herhaling betekent niet "voorgoed
   *  weg" maar "sla deze ene dag over" — anders staat 'm er bij de volgende
   *  materialisatie gewoon weer, want het patroon (recurring_tasks.days)
   *  verandert hier niet van. Een gewone (niet-herhalende) taak verdwijnt
   *  gewoon, zoals altijd. */
  async function deleteWeekItem(id: number) {
    const prev = weekItems
    const item = weekItems.find(i => i.id === id)
    setWeekItems(p => p.filter(i => i.id !== id))
    const { error } = await supabase.from('week_items').delete().eq('id', id).eq('user_id', userId)
    if (error) { setWeekItems(prev); return }
    if (item?.recur_id) {
      const rt = recurringTasks.find(r => r.id === item.recur_id)
      if (rt) {
        const skipDate = item.moved_from ?? item.date
        const nextSkip = [...(rt.skip_dates ?? []), skipDate]
        setRecurringTasks(p => p.map(r => r.id === rt.id ? { ...r, skip_dates: nextSkip } : r))
        await supabase.from('recurring_tasks').update({ skip_dates: nextSkip }).eq('id', rt.id).eq('user_id', userId)
      }
    }
  }

  async function deleteRecurringTask(recurId: number) {
    const prevR = recurringTasks
    const prevW = weekItems
    setRecurringTasks(p => p.filter(r => r.id !== recurId))
    setWeekItems(p => p.filter(i => i.recur_id !== recurId))
    const { error } = await supabase.from('recurring_tasks').delete().eq('id', recurId).eq('user_id', userId)
    if (error) { setRecurringTasks(prevR); setWeekItems(prevW) }
  }

  /** Zorgt dat elke actieve herhaling een echte week_items-rij heeft voor de
   *  komende ~13 weken — dezelfde rij die je gewoon kan afvinken en slepen als
   *  elke andere taak. Idempotent (maakt nooit een dubbele rij), dus veilig om
   *  vaker te draaien: bij het laden, en meteen na het aanmaken/heractiveren
   *  van een patroon. */
  async function materializeRecurring(patterns: RecurringTask[], existing: WeekItem[]) {
    const missing = computeMissingOccurrences(patterns, existing, todayStr, MATERIALIZE_WINDOW_DAYS)
    if (missing.length === 0) return
    const rows = missing.map(m => ({
      user_id: userId, date: m.date, type: m.type, text: m.text, done: false,
      proj_id: m.proj_id, recur_id: m.recur_id,
    }))
    // upsert + ignoreDuplicates i.p.v. plain insert: de unique index op
    // (recur_id, date) (supabase/add-recur-date-unique.sql) is de echte
    // garantie tegen dubbele bezettingen — deze check hierboven is alleen de
    // snelle weg, niet de enige. Zo blijft een race (twee tabbladen open, een
    // toekomstige dubbele aanroep) altijd onschadelijk in plaats van dubbele rijen.
    const { data } = await supabase.from('week_items')
      .upsert(rows, { onConflict: 'recur_id,date', ignoreDuplicates: true })
      .select('*')
    if (data) setWeekItems(prev => [...prev, ...(data as WeekItem[])])
  }

  // Eén keer bij het laden — daarna alleen nog gericht na het aanmaken of
  // heractiveren van een patroon (zie createRecurTask/toggleRecurTask). De
  // ref beschermt tegen React Strict Mode's dubbele mount-aanroep in dev: die
  // tweede aanroep zou anders tegen de nog-niet-bijgewerkte state aan lopen en
  // (vóór de unique index hieronder) dubbele rijen aanmaken.
  const materializedOnMountRef = useRef(false)
  useEffect(() => {
    if (materializedOnMountRef.current) return
    materializedOnMountRef.current = true
    materializeRecurring(recurringTasks, weekItems)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Van een bestaande (niet-herhalende) taak een herhaalpatroon maken — de
   *  taak zelf blijft gewoon staan als de eerste bezetting, toekomstige weken
   *  worden meteen gematerialiseerd. */
  async function makeWeekItemRecurring(item: WeekItem, days: string[]) {
    const { data: newRt } = await supabase.from('recurring_tasks').insert({
      user_id: userId, name: item.text, type: item.type, days, cat_id: null, proj_id: item.proj_id, active: true,
    }).select('*').single()
    if (!newRt) return
    const rt = newRt as RecurringTask
    setRecurringTasks(prev => [...prev, rt])
    const prevItems = weekItems
    setWeekItems(p => p.map(w => w.id === item.id ? { ...w, recur_id: rt.id } : w))
    const { error } = await supabase.from('week_items').update({ recur_id: rt.id }).eq('id', item.id).eq('user_id', userId)
    if (error) { setWeekItems(prevItems); setRecurringTasks(prev => prev.filter(r => r.id !== rt.id)); return }
    materializeRecurring([rt], [...weekItems, { ...item, recur_id: rt.id }])
  }

  async function makeWeekItemOneTime(item: WeekItem) {
    // Detach from recurring task — keep the week_item but remove recur_id link
    const prev = weekItems
    setWeekItems(p => p.map(i => i.id === item.id ? { ...i, recur_id: null } : i))
    const { error } = await supabase.from('week_items').update({ recur_id: null }).eq('id', item.id).eq('user_id', userId)
    if (error) setWeekItems(prev)
  }

  async function linkWeekItemToCat(item: WeekItem | null, rt: RecurringTask | null, catId: string) {
    if (rt) {
      const prev = recurringTasks
      setRecurringTasks(p => p.map(r => r.id === rt.id ? { ...r, cat_id: catId } : r))
      const { error } = await supabase.from('recurring_tasks').update({ cat_id: catId }).eq('id', rt.id).eq('user_id', userId)
      if (error) setRecurringTasks(prev)
    }
    // week_items don't have cat_id directly — link via recurring task or project
  }

  function gotoVisie(catId: string) {
    setVisieFocusCat(catId)
    setActiveTab('visie')
  }

  async function toggleGoal(id: number) {
    track('doel-afvinken')
    const goal = goals.find(g => g.id === id)
    if (!goal) return
    const nowDone = !goal.done
    const prev = goals
    setGoals(p => p.map(g => g.id === id ? { ...g, done: nowDone } : g))
    const { error } = await supabase.from('goals').update({ done: nowDone }).eq('id', id).eq('user_id', userId)
    if (error) { setGoals(prev); return }

    // Een gehaald doel levert automatisch een prestatie op — ongeacht de horizon.
    const row = await syncGoalAchievement(supabase, userId, goal, nowDone, todayStr)
    if (row) setAchievements(prevA => [row, ...prevA])
    else     setAchievements(prevA => prevA.filter(a => a.text !== goalAchievementText(goal)))
  }

  async function addGoal(text: string, horizon: string, kind: 'doel' | 'hobby') {
    track('doel-toevoegen')
    const { data: row } = await supabase.from('goals')
      .insert({ user_id: userId, text, horizon, cat_id: kind === 'hobby' ? 'hobby' : null, done: false, kind })
      .select('*').single()
    if (row) setGoals(prev => [row as Goal, ...prev])
  }

  /** Doel naar een andere horizon slepen — bijv. een kwartaaldoel naar 6 weken.
   *  Heeft het doel een deadline, dan verschuift die mee (of laat los bij een
   *  langetermijn-kolom) i.p.v. alleen het horizon-veld te zetten — anders
   *  spreken horizon en deadline elkaar tegen. Zie lib/deadline-horizon.ts. */
  async function moveGoal(id: number, horizon: string) {
    const goal = goals.find(g => g.id === id)
    if (!goal) return
    const patch = resolveHorizonDrop(goal, horizon as Goal['horizon'], todayStr)
    if (goal.horizon === patch.horizon && goal.deadline === (patch.deadline ?? goal.deadline)) return
    track('doel-verslepen')
    const prev = goals
    setGoals(p => p.map(g => g.id === id ? { ...g, ...patch } : g))
    const { error } = await supabase.from('goals').update(patch).eq('id', id).eq('user_id', userId)
    if (error) setGoals(prev)
  }

  /** Herschikken binnen een horizon-kolom — GoalsTab heeft de nieuwe
   *  sort_order-waarden al berekend (reorderList), hier alleen nog toepassen + opslaan. */
  function reorderGoals(updates: { id: number; sort_order: number }[]) {
    setGoals(p => p.map(g => {
      const u = updates.find(x => x.id === g.id)
      return u ? { ...g, sort_order: u.sort_order } : g
    }))
    updates.forEach(u => { supabase.from('goals').update({ sort_order: u.sort_order }).eq('id', u.id).eq('user_id', userId) })
  }

  // Prullenbak: een weggegooid doel verdwijnt uit de hele app (visie,
  // weekplanning, terugblik, zoeken, AI) én neemt zijn XP en prestatie mee —
  // maar blijft herstelbaar. Zie lib/goal-links.ts.
  /** Vraagt eerst na over gekoppelde taken; zonder taken gaat het direct. */
  function trashGoal(id: number) {
    track('doel-weggooien')
    const goal = goals.find(g => g.id === id)
    if (!goal) return
    if (tasksForGoal(goal, levendeTaken, projects).length > 0) { setGoalTrashAsk(goal); return }
    return trashGoalNow(goal)
  }

  async function trashGoalNow(goal: Goal) {
    const id = goal.id
    const prevG = goals, prevX = xpEvents, prevA = achievements
    const now = new Date().toISOString()

    setGoals(p => p.map(g => g.id === id ? { ...g, deleted_at: now } : g))
    setXpEvents(p => p.filter(e => !(e.source === 'goal' && e.ref_id === String(id))))
    if (goal.done) setAchievements(p => p.filter(a => a.text !== goalAchievementText(goal)))

    const res = await trashGoalEverywhere(supabase, userId, goal, now)
    if (!res.ok) { setGoals(prevG); setXpEvents(prevX); setAchievements(prevA) }
  }

  /** Doel weggooien nadat je per taak hebt gezegd wat ermee moet. */
  async function trashGoalWithTasks(goal: Goal, keuzes: Record<number, TaskKeuze>) {
    setGoalTrashAsk(null)
    for (const [idStr, keuze] of Object.entries(keuzes)) {
      const id = Number(idStr)
      if (keuze === 'klaar')     await updateTask(id, 'done')
      else if (keuze === 'weg')  await deleteTask(id)
    }
    await trashGoalNow(goal)
  }

  async function restoreGoal(id: number) {
    const goal = goals.find(g => g.id === id)
    if (!goal) return
    const prevG = goals
    setGoals(p => p.map(g => g.id === id ? { ...g, deleted_at: null } : g))

    const res = await restoreGoalEverywhere(supabase, userId, goal, todayStr)
    if (!res.ok) { setGoals(prevG); return }
    if (res.achievement) setAchievements(p => [res.achievement as Achievement, ...p])
    await refreshFromDb()   // XP-teller weer gelijktrekken
  }

  async function purgeGoal(id: number) {
    const goal = goals.find(g => g.id === id)
    const prev = goals
    setGoals(p => p.filter(g => g.id !== id))
    const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId)
    if (error) { setGoals(prev); return }
    // Vangnet: mocht er nog XP of een prestatie aan hangen, dan gaat die nu ook weg
    await supabase.from('xp_events').delete().eq('user_id', userId).eq('source', 'goal').eq('ref_id', String(id))
    if (goal?.done) {
      setAchievements(p => p.filter(a => a.text !== goalAchievementText(goal)))
      await supabase.from('achievements').delete().eq('user_id', userId).eq('text', goalAchievementText(goal))
    }
  }


  async function addTask(name: string, status: TaskStatus, projId: string | null): Promise<Task | null> {
    track('taak-toevoegen')
    const { data: newTask } = await supabase.from('tasks').insert({
      user_id: userId, proj_id: projId, name, status, urgent: false,
    }).select('*').single()
    if (newTask) { setTasks(prev => [...prev, newTask as Task]); return newTask as Task }
    return null
  }

  async function updateTaskProject(id: number, projId: string) {
    const prev = tasks
    setTasks(p => p.map(t => t.id === id ? { ...t, proj_id: projId } : t))
    const { error } = await supabase.from('tasks').update({ proj_id: projId, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setTasks(prev)
  }

  /** Heeft de taak een deadline, dan verschuift die mee met het slepen (of
   *  laat los bij een langetermijn-kolom) i.p.v. alleen het horizon-veld te
   *  zetten — anders spreken horizon en deadline elkaar tegen. */
  async function updateTaskHorizon(id: number, horizon: GoalHorizon | null) {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const patch = resolveHorizonDrop(task, horizon, todayStr)
    const prev = tasks
    setTasks(p => p.map(t => t.id === id ? { ...t, ...patch } : t))
    const { error } = await supabase.from('tasks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setTasks(prev)
  }

  /** Herschikken binnen een groep (Kanban-kolom, Lijst-groep of horizon-kolom)
   *  — de aanroeper heeft de nieuwe sort_order-waarden al berekend (reorderList),
   *  hier alleen nog toepassen + opslaan. Zelfde patroon als Projecten. */
  function reorderTasks(updates: { id: number; sort_order: number }[]) {
    setTasks(p => p.map(t => {
      const u = updates.find(x => x.id === t.id)
      return u ? { ...t, sort_order: u.sort_order } : t
    }))
    updates.forEach(u => { supabase.from('tasks').update({ sort_order: u.sort_order }).eq('id', u.id).eq('user_id', userId) })
  }

  /** Deadline van een taak wijzigen (vanuit TaskModal) — legt bij de eerste
   *  keer meteen de original_deadline vast. */
  async function updateTaskDeadline(id: number, deadline: string | null) {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const patch = withOriginalDeadline(task, deadline)
    const prev = tasks
    setTasks(p => p.map(t => t.id === id ? { ...t, ...patch } : t))
    const { error } = await supabase.from('tasks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setTasks(prev)
  }

  async function addWeekItem(date: string, text: string, type: WeekItem['type'], projId: string | null, timeBlock?: string): Promise<WeekItem | null> {
    const { data: newItem } = await supabase.from('week_items').insert({
      user_id: userId, date, text, type, done: false, proj_id: projId ?? null, recur_id: null,
      time_block: timeBlock ?? null,
    }).select('*').single()
    if (newItem) { setWeekItems(prev => [...prev, newItem as WeekItem]); return newItem as WeekItem }
    return null
  }

  async function setWeekItemTime(id: number, timeBlock: string | null) {
    setWeekItems(prev => prev.map(w => w.id === id ? { ...w, time_block: timeBlock } : w))
    await supabase.from('week_items').update({ time_block: timeBlock }).eq('id', id).eq('user_id', userId)
  }

  async function toggleWeekItemStar(id: number) {
    const item = weekItems.find(w => w.id === id)
    if (!item) return
    const starred = !item.starred
    const prev = weekItems
    setWeekItems(p => p.map(w => w.id === id ? { ...w, starred } : w))
    const { error } = await supabase.from('week_items').update({ starred }).eq('id', id).eq('user_id', userId)
    if (error) setWeekItems(prev)  // rollback bij fout
  }

  async function saveMoodEntry(e: { mood: number; energy: number | null; sleep_hours: number | null; note: string; date: string; source?: 'manual' | 'ai' }) {
    track('stemming-invullen')
    // upsert: één meting per dag, opnieuw invullen werkt de dag bij
    const { data: row } = await supabase.from('mood_entries')
      .upsert({ user_id: userId, date: e.date, mood: e.mood, energy: e.energy, sleep_hours: e.sleep_hours, note: e.note || null, source: e.source ?? 'manual' },
              { onConflict: 'user_id,date' })
      .select('*').single()
    if (row) setMoodEntries(prev => [row as MoodEntry, ...prev.filter(m => m.date !== e.date)])
  }

  /** Vraagt de AI een stemmingscijfer te schatten op basis van dagboektekst — puur een voorstel, nooit stil opgeslagen. */
  async function suggestMoodFromDiary(text: string, date: string): Promise<{ mood: number; rationale: string } | null> {
    try {
      const res = await fetch('/api/diary/mood', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, date }) })
      if (!res.ok) return null
      const { suggestion } = await res.json()
      return suggestion ?? null
    } catch { return null }
  }

  async function addShoppingItem(text: string) {
    const { data: row } = await supabase.from('shopping_items')
      .insert({ user_id: userId, text }).select('*').single()
    if (row) setShoppingItems(prev => [...prev, row as ShoppingItem])
  }

  async function toggleShoppingItem(id: number) {
    const item = shoppingItems.find(i => i.id === id)
    if (!item) return
    const done = !item.done
    const prev = shoppingItems
    setShoppingItems(p => p.map(i => i.id === id ? { ...i, done } : i))
    const { error } = await supabase.from('shopping_items').update({ done }).eq('id', id).eq('user_id', userId)
    if (error) setShoppingItems(prev)
  }

  async function deleteShoppingItem(id: number) {
    const prev = shoppingItems
    setShoppingItems(p => p.filter(i => i.id !== id))
    const { error } = await supabase.from('shopping_items').delete().eq('id', id).eq('user_id', userId)
    if (error) setShoppingItems(prev)
  }

  async function addDiaryEntry(text: string, date: string) {
    track('dagboek-schrijven')
    const { data: entry } = await supabase.from('diary_entries')
      .insert({ user_id: userId, text, date }).select('*').single()
    if (entry) setDiaryEntries(prev => [entry as DiaryEntry, ...prev])
  }

  // ── Startgesprek voor nieuwe gebruikers ────────────────────────────────────

  async function setupCreateAreas(areas: { id: string; name: string }[]) {
    const rows = areas
      .filter(a => !categories.some(c => c.id === a.id))
      .map(a => ({ id: a.id, user_id: userId, name: a.name }))
    if (!rows.length) return
    const { data } = await supabase.from('categories').insert(rows).select('*')
    if (data) setCategories(prev => [...prev, ...(data as typeof categories)])
  }

  async function setupCreateGoals(goals: { text: string; horizon: string }[], catId: string | null) {
    if (!goals.length) return
    const { data } = await supabase.from('goals').insert(
      goals.map(g => ({ user_id: userId, text: g.text, horizon: g.horizon, cat_id: catId, done: false }))
    ).select('*')
    if (data) setGoals(prev => [...(data as Goal[]), ...prev])
  }

  async function setupCreateRoutines(
    routines: { name: string; days: string[]; duration_min: number | null; type: RecurringTask['type'] }[],
    catId: string | null,
  ) {
    if (!routines.length) return
    const { data } = await supabase.from('recurring_tasks').insert(
      routines.map(r => ({
        user_id: userId, name: r.name, type: r.type, days: r.days,
        duration_min: r.duration_min, cat_id: catId, active: true,
      }))
    ).select('*')
    if (data) setRecurringTasks(prev => [...prev, ...(data as RecurringTask[])])
  }

  async function setupSaveVisionLink(link: string) {
    const current = data.profile.vision_text ?? ''
    const next = current.trim() ? `${current}

Visie-document: ${link}` : `Visie-document: ${link}`
    await supabase.from('profiles').update({ vision_text: next }).eq('id', userId)
  }

  async function setupSetStep(step: number) {
    await supabase.from('profiles').update({ setup_step: step }).eq('id', userId)
  }

  async function finishSetup() {
    await supabase.from('profiles').update({ setup_done: true }).eq('id', userId)
    await refreshFromDb()
  }

  async function createCategory(name: string) {
    const { data: newCat } = await supabase.from('categories').insert({ user_id: userId, name }).select('*').single()
    if (newCat) setCategories(prev => [...prev, newCat as typeof categories[0]])
  }

  async function deleteCategory(id: string) {
    const snapshot = categories
    setCategories(prev => prev.filter(c => c.id !== id))
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', userId)
    if (error) setCategories(snapshot)
  }

  // Verwijderen zet de taak in de prullenbak (deleted_at). Hij blijft dus
  // bestaan — met zijn project en dus zijn kleur — tot je hem definitief weggooit.
  async function deleteTask(id: number) {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    track('taak-verwijderen')
    const now = new Date().toISOString()
    setTasks(prev => prev.map(t => t.id === id ? { ...t, deleted_at: now } : t))
    if (deleteToastTimerRef.current) clearTimeout(deleteToastTimerRef.current)
    setDeleteToast(`"${kort(task.name)}" naar de prullenbak`)
    deleteToastTimerRef.current = setTimeout(() => setDeleteToast(null), 5000)
    undoStackRef.current.push({ task, timerId: setTimeout(() => {}, 0) })
    const { error } = await supabase.from('tasks').update({ deleted_at: now }).eq('id', id).eq('user_id', userId)
    if (error) setTasks(prev => prev.map(t => t.id === id ? { ...t, deleted_at: null } : t))
  }

  async function restoreTask(id: number) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, deleted_at: null } : t))
    const { error } = await supabase.from('tasks').update({ deleted_at: null }).eq('id', id).eq('user_id', userId)
    if (error) await refreshFromDb()
  }

  /** Definitief weg uit de prullenbak — hierna is hij echt verdwenen. */
  async function purgeTask(id: number) {
    const prev = tasks
    setTasks(p => p.filter(t => t.id !== id))
    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId)
    if (error) setTasks(prev)
  }

  function kort(s: string, n = 35) { return s.length > n ? s.slice(0, n) + '…' : s }

  function undoDelete() {
    const entry = undoStackRef.current.pop()
    if (!entry) return
    clearTimeout(entry.timerId)
    restoreTask(entry.task.id)
    if (deleteToastTimerRef.current) clearTimeout(deleteToastTimerRef.current)
    setDeleteToast(`"${kort(entry.task.name)}" teruggezet`)
    deleteToastTimerRef.current = setTimeout(() => setDeleteToast(null), 2500)
  }

  async function scheduleTask(taskId: number, name: string, projId: string | null, date: string) {
    // Verplaatsen, niet kopiëren: staat de taak al open in de week, dan verzetten
    // we dat item naar de nieuwe dag in plaats van er een tweede bij te maken.
    const alIngepland = weekItems.find(w => w.task_id === String(taskId) && !w.done && w.date >= todayStr)
    if (alIngepland) {
      if (alIngepland.date !== date) await moveWeekItem(alIngepland.id, date)
      return
    }
    const { data: newItem } = await supabase.from('week_items').insert({
      user_id: userId, date, text: name, type: 'task' as WeekItem['type'],
      done: false, proj_id: projId, recur_id: null, task_id: String(taskId),
    }).select('*').single()
    if (newItem) setWeekItems(prev => [...prev, newItem as WeekItem])
  }

  function onSplitMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    const container = splitContainerRef.current
    if (!container) return
    const { left, width } = container.getBoundingClientRect()
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    function onMove(ev: MouseEvent) {
      const pct = ((ev.clientX - left) / width) * 100
      setSplitPos(Math.max(20, Math.min(80, pct)))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  async function createRecurTask(name: string, type: RecurringTask['type'], days: string[], catId: string | null) {
    const { data: newTask } = await supabase.from('recurring_tasks').insert({
      user_id: userId, name, type, days, cat_id: catId ?? null, active: true,
    }).select('*').single()
    if (!newTask) return
    setRecurringTasks(prev => [...prev, newTask as RecurringTask])
    materializeRecurring([newTask as RecurringTask], weekItems)
  }

  /** Herhaaltaak maken van een losse taak: de taak gaat naar de prullenbak
   *  (gewoon terug te halen, net als een normale verwijdering) en de nieuwe
   *  herhaling neemt de categorie van het project over. */
  async function convertTaskToRecurring(task: Task, days: string[]) {
    const proj = projects.find(p => p.id === task.proj_id)
    await createRecurTask(task.name, 'task', days, proj?.cat_id ?? null)
    await deleteTask(task.id)
  }

  /** Losse taak maken van een herhaaltaak: de herhaling gaat uit (niet weg —
   *  blijft terug te zetten via "aan"), er komt een losse taak voor terug. */
  async function convertRecurringToTask(rt: RecurringTask) {
    if (rt.active) await toggleRecurTask(rt.id)
    await addTask(rt.name, 'backlog', rt.proj_id)
  }

  // ── Controle: iets rechtzetten dat tussen de tabs uit elkaar liep ──────────
  // Alles loopt via de bestaande handlers, dus elke tab ziet het meteen.
  async function fixItem(kind: ItemKind, id: string, action: FixAction) {
    if (action === 'done') {
      if (kind === 'task')      return updateTask(Number(id), 'done')
      if (kind === 'week')      { const w = weekItems.find(x => x.id === Number(id)); if (w && !w.done) await toggleWeekItem(w.id); return }
      if (kind === 'goal')      { const g = goals.find(x => x.id === Number(id));     if (g && !g.done) await toggleGoal(g.id);     return }
      if (kind === 'project')   return archiveProject(id)
      if (kind === 'recurring') { const r = recurringTasks.find(x => x.id === Number(id)); if (r?.active) await toggleRecurTask(r.id); return }
      return
    }
    if (kind === 'task')      return deleteTask(Number(id))
    if (kind === 'week')      return deleteWeekItem(Number(id))
    if (kind === 'goal')      return trashGoal(Number(id))
    if (kind === 'recurring') return deleteRecurringTask(Number(id))
    if (kind === 'project')   return archiveProject(id)   // een project gooien we niet zomaar weg
  }

  /** Een project 'afronden' = naar het archief; het werk erin blijft bestaan. */
  async function archiveProject(id: string) {
    const prev = projects
    setProjects(p => p.map(x => x.id === id ? { ...x, status: 'archief' as ProjectStatus } : x))
    const { error } = await supabase.from('projects')
      .update({ status: 'archief', updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
    if (error) setProjects(prev)
  }

  function markChecked() {
    const now = new Date().toISOString()
    setLastCheck(now)
    try { localStorage.setItem('controle-laatste', now) } catch { /* privémodus: dan onthouden we het niet */ }
  }

  /** Uit: het patroon pauzeert — toekomstige, nog niet afgeronde bezettingen
   *  verdwijnen (voltooide/verleden blijven staan als geschiedenis). Aan:
   *  meteen weer materialiseren vanaf vandaag. */
  async function toggleRecurTask(id: number) {
    const rt = recurringTasks.find(r => r.id === id)
    if (!rt) return
    const nextActive = !rt.active
    const prev = recurringTasks
    setRecurringTasks(p => p.map(r => r.id === id ? { ...r, active: nextActive } : r))
    const { error } = await supabase.from('recurring_tasks').update({ active: nextActive }).eq('id', id).eq('user_id', userId)
    if (error) { setRecurringTasks(prev); return }
    if (nextActive) {
      materializeRecurring([{ ...rt, active: true }], weekItems)
    } else {
      const toRemove = weekItems.filter(w => w.recur_id === id && w.date >= todayStr && !w.done)
      if (toRemove.length) {
        const prevItems = weekItems
        setWeekItems(p => p.filter(w => !toRemove.some(r => r.id === w.id)))
        const { error: delErr } = await supabase.from('week_items').delete().in('id', toRemove.map(w => w.id)).eq('user_id', userId)
        if (delErr) setWeekItems(prevItems)
      }
    }
  }


  function inferCatByType(type: string): string | null {
    const cats = categories
    if (type === 'kids') {
      return cats.find(c => /familie|kinderen|vrienden/i.test(c.name))?.id ?? null
    }
    if (type === 'sport') {
      return cats.find(c => /gezondheid|sport|fit|vitaliteit/i.test(c.name))?.id ?? null
    }
    return null
  }

  function ctxData(projId: string|null, catId: string|null, type?: string) {
    const proj   = projId ? projects.find(p => p.id === projId) ?? null : null
    const cId    = proj?.cat_id ?? catId ?? (type ? inferCatByType(type) : null)
    const catObj = cId ? categories.find(c => c.id === cId) ?? null : null
    const catGoals = cId ? levendeDoelen.filter(g => g.cat_id === cId) : []
    return { proj, catObj, catGoals }
  }

  function showCtx(e: React.MouseEvent, item: WeekItem) {
    e.preventDefault()
    const rt = item.recur_id ? (recurringTasks.find(r => r.id === item.recur_id) ?? null) : null
    const { proj, catObj, catGoals } = ctxData(item.proj_id, rt?.cat_id ?? null, item.type)
    setCtxMenu({ x: e.clientX, y: e.clientY, item, date: item.date, proj, catObj, catGoals })
  }

  async function setRecurDuration(recurId: number, minutes: number | null) {
    const prev = recurringTasks
    setRecurringTasks(p => p.map(r => r.id === recurId ? { ...r, duration_min: minutes } : r))
    const { error } = await supabase.from('recurring_tasks')
      .update({ duration_min: minutes }).eq('id', recurId).eq('user_id', userId)
    if (error) setRecurringTasks(prev)
  }

  const lang = resolveLang(data.profile.language)
  const tc = DASHBOARD_CHROME[lang]

  return (
    <LangProvider lang={lang}>
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)', color:'var(--text)' }}>

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      <div style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)', padding:'0 8px', display:'flex', alignItems:'center', height:44, flexShrink:0, gap:4 }}>
        {/* Op mobiel vervangt dit de oude categorie-sidebar-knop: nu opent het
            hetzelfde menu als "⋯ Meer" onderin, met alle hoofdtabs erin
            (zelfde lijst als de bovenbalk op desktop). */}
        {isMobile && (
          <button onClick={() => setMobileMoreOpen(o => !o)} aria-label={tc.meerTitel}
            style={{ fontSize:18, background:'none', border:'none', color:'var(--muted)', cursor:'pointer', padding:'4px 6px', flexShrink:0, lineHeight:1 }}>
            ☰
          </button>
        )}
        <h1 style={{ fontSize:14, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>
          ⚡{!compactTabs && ' Horizon'}{mounted && <span style={{ color:'var(--muted)', fontWeight:400 }}>{compactTabs ? ` ${todayName}` : ` / ${todayName}`}</span>}
        </h1>
        {isMobile && <div style={{ flex:1 }} />}
        {!isMobile && <div style={{ display:'flex', flex:1, overflowX:'auto', scrollbarWidth:'none' }}>
          {TABS.filter(t => !hiddenTabs.includes(t)).map((tab, i) => {
            const label =
              tab === 'dag'          ? (compactTabs ? '☀️' : `☀️ ${tc.tabs.dag}`) :
              tab === 'week'         ? (compactTabs ? `📅${mounted&&todayOpenItems?` (${todayOpenItems})`:''}` : `📅 ${tc.tabs.week}${mounted&&todayOpenItems?` (${todayOpenItems})`:''}`) :
              tab === 'month'        ? (compactTabs ? '🗓' : `🗓 ${tc.tabs.maand}`) :
              tab === 'projects'     ? (compactTabs ? '🗂' : `🗂 ${tc.tabs.projecten}`) :
              tab === 'tasks'        ? (compactTabs ? `✅(${activeTasks.length})` : `✅ ${tc.tabs.taken} (${activeTasks.length})`) :
              tab === 'goals'        ? (compactTabs ? '🎯' : `🎯 ${tc.tabs.doelen}`) :
              tab === 'achievements' ? (compactTabs ? '🏆' : `🏆 ${tc.tabs.wins}`) :
              tab === 'visie'        ? (compactTabs ? '🌟' : `🌟 ${tc.tabs.visie}`) :
                                       (compactTabs ? '⋯' : `⋯ ${tc.tabs.overige}`)
            const tabName =
              tab === 'dag' ? tc.tabs.dag :
              tab === 'week' ? tc.tabs.week :
              tab === 'month' ? tc.tabs.maand :
              tab === 'projects' ? tc.tabs.projecten :
              tab === 'tasks' ? tc.tabs.taken :
              tab === 'goals' ? tc.tabs.doelen :
              tab === 'achievements' ? tc.tabs.wins :
              tab === 'visie' ? tc.tabs.visie :
              tc.tabs.overige
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} title={`${tabName} — Alt+${i+1}`} style={{
                padding: compactTabs ? '0 9px' : '0 10px', height:44, background:'none', border:'none',
                borderBottom:`2px solid ${activeTab===tab?'#6366f1':'transparent'}`,
                color: activeTab===tab ? 'var(--text)' : 'var(--muted)',
                fontSize: compactTabs ? 15 : 12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap', transition:'color .1s', flexShrink:0,
              }}>
                {label}
              </button>
            )
          })}
        </div>}
        <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 2 : 8, flexShrink:0 }}>
          {/* Op mobiel hoort het level-systeem bij het Overige-cluster (standaard uit) — zie mobile_hidden_features. */}
          {(!isMobile || !mobileHiddenFeatures.includes('voortgang')) && (
            <XpBar
              events={xpEvents}
              categories={categories}
              unlockedFeatures={data.profile.unlocked_features}
              compact={isMobile}
              onMarkSeen={markXpSeen}
              onReplayTour={() => setShowTour(true)}
              onOpenStats={() => setShowStats(true)}
            />
          )}
          {!isMobile && showWeather && weather && (
            <div title={weather.desc} style={{ fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center', gap:4, paddingRight:8, borderRight:'1px solid var(--border)' }}>
              {weather.icon?.startsWith('http')
                ? <img src={weather.icon} alt={weather.desc} style={{ width:20, height:20, display:'block' }} />
                : <span>{weather.icon || '🌤'}</span>}
              <span style={{ fontWeight:600, color:'var(--text)' }}>{weather.temp}°</span>
            </div>
          )}
          {/* Plansessie/Weekreview/AI zijn nu Overige-items i.p.v. losse topbar-knoppen. */}
          {!isMobile && (
            <button onClick={() => setShutdownOpen(true)} title={tc.dagAfsluiten}
              style={{ fontSize:13, color:'#a78bfa', background:'rgba(139,92,246,.08)', border:'1px solid rgba(139,92,246,.3)', borderRadius:5, padding:'4px 8px', cursor:'pointer', fontWeight:600, lineHeight:1 }}>
              🌙{mounted && todayOpenItems ? <span style={{ fontSize:10, marginLeft:3 }}>{todayOpenItems}</span> : null}
            </button>
          )}
          <button onClick={() => setShowSearch(true)} title={tc.zoeken}
            style={{ fontSize: isMobile ? 18 : 13, color:'var(--muted)', background:'none', border: isMobile ? 'none' : '1px solid var(--border)', borderRadius:5, padding: isMobile ? '4px 6px' : '4px 8px', cursor:'pointer', display:'flex', alignItems:'center', whiteSpace:'nowrap', lineHeight:1 }}>
            🔍
          </button>
          <NotificationBell items={alertItems} isMobile={isMobile} />
          <button onClick={() => setShoppingPanelOpen(true)} title={tc.boodschappenlijstje}
            style={{ position:'relative', fontSize: isMobile ? 16 : 13, color:'var(--muted)', background:'none', border:'none', cursor:'pointer', padding: isMobile ? '4px 4px' : '4px 6px', borderRadius:5, lineHeight:1 }}>
            🛒
            {shoppingItems.filter(i => !i.done).length > 0 && (
              <span style={{ position:'absolute', top:-2, right:-2, background:'#3fb950', color:'#fff', fontSize:9, fontWeight:700, lineHeight:1, minWidth:14, height:14, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>
                {shoppingItems.filter(i => !i.done).length}
              </span>
            )}
          </button>
          {!isMobile && (
            <a href="/settings" title={tc.instellingen} style={{ fontSize:13, color:'var(--muted)', textDecoration:'none', padding:'4px 8px', border:'1px solid var(--border)', borderRadius:5, lineHeight:1 }}>⚙</a>
          )}
        </div>
      </div>

      {/* ── Urgent bar (wegklikbaar — komt terug bij nieuwe urgente taak) ── */}
      {showAlertBanners && showUrgentBar && (
        <div style={{ background:'#2d1a00', borderBottom:'1px solid #5c3400', display:'flex', alignItems:'center', flexShrink:0 }}>
          {/* Op mobiel één horizontaal scrollende regel i.p.v. 5+ regels hoog */}
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, padding:'4px 4px 4px 16px', flex:1, minWidth:0, overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', scrollbarWidth:'none' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#f97316', display:'inline-block', flexShrink:0, animation:'pulse 1.5s infinite' }} />
            <span style={{ color:'#fb923c', fontWeight:700, flexShrink:0 }}>Urgent:</span>
            {urgentTasks.map(t => {
              const proj = projects.find(p => p.id === t.proj_id)
              return (
                <button key={t.id} onClick={() => setTaskModal(t)} title="Open taakdetails"
                  style={{ background:'#3d1a00', border:'1px solid #5c2800', borderRadius:4, padding:'2px 8px', color:'#fca5a5', cursor:'pointer', fontSize:11, fontWeight:500, flexShrink:0, whiteSpace:'nowrap' }}>
                  {proj?.emoji} {t.name.length>35 ? t.name.slice(0,35)+'…' : t.name}
                </button>
              )
            })}
          </div>
          <button onClick={dismissUrgentBar} aria-label="Urgente meldingen wegklikken"
            title="Wegklikken — komt terug zodra er een nieuwe urgente taak bijkomt"
            style={{ background:'none', border:'none', color:'#b45309', cursor:'pointer', fontSize:15, lineHeight:1, padding:'8px 12px', flexShrink:0, borderRadius:6 }}>
            ✕
          </button>
        </div>
      )}

      {/* ── Overdue banner (wegklikbaar — komt terug bij nieuw item) ──── */}
      {showAlertBanners && showOverdueBanner && (
        <div style={{ background:'rgba(210,153,34,.07)', borderBottom:'1px solid rgba(210,153,34,.2)', padding:'3px 8px 3px 16px', display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#d29922', flexShrink:0 }}>
          <span>⏰</span>
          <span>{overdueItems.length} niet-afgerond{overdueItems.length === 1 ? '' : 'e'} {overdueItems.length === 1 ? 'item' : 'items'} van vorige week</span>
          {activeTab !== 'week' && (
            <button onClick={() => setActiveTab('week')} style={{ background:'none', border:'none', color:'#d29922', cursor:'pointer', fontSize:11, textDecoration:'underline', padding:0, marginLeft:4 }}>
              Bekijken →
            </button>
          )}
          <button onClick={dismissOverdueBanner} aria-label="Achterstallige-items-melding wegklikken"
            title="Wegklikken — komt terug zodra er een nieuw achterstallig item bijkomt"
            style={{ marginLeft:'auto', background:'none', border:'none', color:'#8a6d1d', cursor:'pointer', fontSize:15, lineHeight:1, padding:'8px 12px', flexShrink:0, borderRadius:6 }}>
            ✕
          </button>
        </div>
      )}

      {/* Wekelijkse controle: lopen doelen, projecten, taken en planning nog gelijk? */}
      {showAlertBanners && checkDue && activeTab !== 'overige' && (
        <div style={{ background:'rgba(88,166,255,.07)', borderBottom:'1px solid rgba(88,166,255,.2)', padding:'3px 8px 3px 16px', display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#58a6ff', flexShrink:0 }}>
          <span>🔍</span>
          <span>Tijd voor de wekelijkse controle — klopt alles nog met elkaar?</span>
          <button onClick={() => { try { localStorage.setItem('inzicht-modus', 'controle') } catch { /* privémodus */ } ; setOverigeView('graph'); setActiveTab('overige') }}
            style={{ background:'none', border:'none', color:'#58a6ff', cursor:'pointer', fontSize:11, textDecoration:'underline', padding:0, marginLeft:4 }}>
            Nakijken →
          </button>
          <button onClick={markChecked} aria-label="Controle-melding wegklikken"
            title="Wegklikken — komt volgende week terug"
            style={{ marginLeft:'auto', background:'none', border:'none', color:'#3d5a7a', cursor:'pointer', fontSize:15, lineHeight:1, padding:'8px 12px', flexShrink:0, borderRadius:6 }}>
            ✕
          </button>
        </div>
      )}

      {/* Doelen en projecten zonder duidelijk result — is dit eigenlijk SMART? */}
      {showAlertBanners && showUitwerkBar && (
        <div style={{ background:'rgba(168,139,250,.07)', borderBottom:'1px solid rgba(168,139,250,.2)', padding:'3px 8px 3px 16px', display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#c4b5fd', flexShrink:0 }}>
          <span>🧭</span>
          <span>{nietSmart.length} doel{nietSmart.length === 1 ? '' : 'en'} en project{nietSmart.length === 1 ? '' : 'en'} {nietSmart.length === 1 ? 'mist' : 'missen'} nog een duidelijk result</span>
          <button onClick={() => setUitwerkPanelOpen(true)} style={{ background:'none', border:'none', color:'#c4b5fd', cursor:'pointer', fontSize:11, textDecoration:'underline', padding:0, marginLeft:4 }}>
            Uitwerken →
          </button>
          <button onClick={dismissUitwerkBar} aria-label="SMART-melding wegklikken"
            title="Wegklikken — komt terug zodra er een nieuw doel of project bijkomt"
            style={{ marginLeft:'auto', background:'none', border:'none', color:'#5b4a8a', cursor:'pointer', fontSize:15, lineHeight:1, padding:'8px 12px', flexShrink:0, borderRadius:6 }}>
            ✕
          </button>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

        {/* Het project-sidebar is niet relevant op tabs die hun eigen linker
            menukolom hebben (Wins/Overige/Visie/Week), en op mobiel is een
            aparte categorie-sidebar sowieso overbodige clutter (Jordan:
            "zo'n menu aan de linkerkant niet handig") — daar zie je de
            categorieën toch al inline in de tab zelf. */}
        {!isMobile && !['achievements','overige','visie','week'].includes(activeTab) && (
          <>
            {/* Sidebar */}
            <div style={{ width:188, flexShrink:0, background:'var(--bg2)', borderRight:'1px solid var(--border)', overflowY:'auto', padding:'6px 0' }}>
              {byCat.map(cat => (
                <div key={cat.id}>
                  <div style={{ padding:'8px 12px 4px', fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'var(--dim)' }}>{cat.name}</div>
                  {cat.projects.map(p => {
                    const ptasks   = projectTasks(p.id)
                    const open     = ptasks.filter(t => t.status !== 'done').length
                    const isUrgent = ptasks.some(t => t.urgent && t.status !== 'done')
                    const active   = selectedProject?.id === p.id
                    return (
                      <div key={p.id} onClick={() => { setSelectedProject(active ? null : p); setActiveTab('projects') }}
                        style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:500, color:active?'var(--text)':'var(--muted)', borderLeft:`2px solid ${active?'#6366f1':isUrgent?'#f85149':'transparent'}`, background:active?'rgba(99,102,241,0.08)':'transparent', transition:'all .1s' }}>
                        <span>{p.emoji}</span>
                        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name.split('—')[0].trim()}</span>
                        {open > 0 && <span style={{ fontSize:10, background:isUrgent?'rgba(248,81,73,0.15)':'var(--bg)', border:`1px solid ${isUrgent?'#f85149':'var(--border)'}`, padding:'1px 5px', borderRadius:6, color:isUrgent?'#f85149':'var(--dim)', flexShrink:0 }}>{open}</span>}
                      </div>
                    )
                  })}
                  <div style={{ height:1, background:'var(--border)', margin:'4px 10px' }} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Week heeft een eigen linker menukolom: geen projectenboom (die hoort
            bij Projecten/Dag/Taken/Doelen), maar een snelkoppeling naar het
            splitscherm (week + takenlijst naast elkaar, slepen om in te plannen)
            en het aantal openstaande items van eerder. Alleen op desktop —
            op mobiel toont WeekTab zelf de openstaande-van-eerder-melding
            bovenaan de inhoud, geen aparte menukolom nodig. */}
        {!isMobile && activeTab === 'week' && (
          <div style={{ width:188, flexShrink:0, background:'var(--bg2)', borderRight:'1px solid var(--border)', overflowY:'auto', padding:'6px 0' }}>
            <div style={{ padding:'8px 12px 4px', fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'var(--dim)' }}>Week</div>
            {weekOverdueCount > 0 && (
              <div style={{ margin:'2px 12px 8px', padding:'8px 10px', background:'#2d1a00', border:'1px solid #5c3400', borderRadius:8, fontSize:11, color:'#fb923c', display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#f97316', flexShrink:0 }} />
                <span><strong>{weekOverdueCount}</strong> openstaand van eerder</span>
              </div>
            )}
            <div onClick={() => setWeekSplit(s => !s)}
              title={weekSplit ? 'Splitscherm uit' : 'Week + takenlijst naast elkaar — sleep een taak naar een dag om in te plannen'}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:500,
                color: weekSplit ? '#818cf8' : 'var(--muted)',
                borderLeft:`2px solid ${weekSplit ? '#6366f1' : 'transparent'}`,
                background: weekSplit ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
              📥 Taken inplannen
            </div>
          </div>
        )}

        {/* Main content */}
        <div style={{ flex:1, overflowY: (['overige','achievements','visie'].includes(activeTab) || (weekSplit && weekViewMode==='week' && activeTab==='week' && !isMobile)) ? 'hidden' : 'auto', padding: (['overige','achievements','visie'].includes(activeTab) || (weekSplit && weekViewMode==='week' && activeTab==='week' && !isMobile)) ? 0 : (isMobile ? 8 : 16) }}>
          {activeTab === 'week' && (
            <ErrorBoundary label="Weekplanning">
              {weekSplit && weekViewMode === 'week' && !isMobile ? (
                /* ── Split view: week left + kanban right ─────────────── */
                <div ref={splitContainerRef} style={{ display:'flex', height:'100%' }}>
                  <div style={{ flex:`0 0 ${splitPos}%`, overflowY:'auto', padding:16, minWidth:0 }}>
                    <WeekTab items={weekItems}
                      onToggle={toggleWeekItem} onMove={moveWeekItem} onReorder={reorderWeekItems} onCtx={showCtx}
                      onAddItem={addWeekItem} onOpenRecurModal={() => setShowRecurModal(true)}
                      projects={projects}
                      onSwitchToMonth={() => setWeekViewMode('month')}
                      jumpDate={weekJumpDate}
                      onJumpHandled={() => setWeekJumpDate(null)}
                      gcalConnected={!!data.profile.google_calendar_connected}
                      onGcalSync={async () => {
                        const r = await fetch('/api/calendar/google'); const j = await r.json()
                        if (j.synced > 0 || j.timesAdded > 0) { router.refresh() }
                        return j
                      }}
                      onOpenDetail={(item, date, openAi) => {
                        if (item.text.toLowerCase().includes('plansessie')) { setPlanningOpen(true); return }
                        setDetailPanel({ item, date, openAi })
                      }}
                      onDeleteItem={deleteWeekItem} onToggleStar={toggleWeekItemStar}
                      onOpenRoutines={() => setShowRoutines(true)}
                      weekSplit={weekSplit} onToggleSplit={isMobile ? undefined : () => setWeekSplit(s => !s)}
                      onScheduleTask={(taskId, date) => { const t = tasks.find(x => x.id === taskId); if (t) scheduleTask(taskId, t.name, t.proj_id, date) }} />
                  </div>
                  {/* Draggable resize divider */}
                  <div
                    onMouseDown={onSplitMouseDown}
                    title="Sleep om formaat aan te passen"
                    style={{
                      width: 5, flexShrink: 0, cursor: 'col-resize',
                      background: 'var(--border)', transition: 'background .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#6366f1' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--border)' }}
                  />
                  <div style={{ flex:1, overflowY:'auto', padding:'16px 14px', minWidth:0 }}>
                    <TasksTab tasks={tasks} projects={projects} categories={categories}
                      onUpdate={updateTask} onTaskClick={t => setTaskModal(t)} onMoveHorizon={updateTaskHorizon} onReorder={reorderTasks}
                      plannedDates={plannedTaskDates(weekItems, todayStr)}
                      onDelete={deleteTask} onRestore={restoreTask} onPurge={purgeTask}
                      onAdd={async (name, status, projId) => { await addTask(name, status, projId) }}
                      onFeature={track}
                      isMobile={isMobile} />
                  </div>
                </div>
              ) : weekViewMode === 'week' ? (
                <WeekTab items={weekItems}
                  onToggle={toggleWeekItem} onMove={moveWeekItem} onReorder={reorderWeekItems} onCtx={showCtx}
                  onAddItem={addWeekItem} onOpenRecurModal={() => setShowRecurModal(true)}
                  projects={projects}
                  onSwitchToMonth={() => setWeekViewMode('month')}
                  jumpDate={weekJumpDate}
                  onJumpHandled={() => setWeekJumpDate(null)}
                  gcalConnected={!!data.profile.google_calendar_connected}
                  onGcalSync={async () => {
                    const r = await fetch('/api/calendar/google'); const j = await r.json()
                    if (j.synced > 0 || j.timesAdded > 0) { router.refresh() }
                    return j
                  }}
                  onOpenDetail={(item, date, openAi) => {
                    if (item.text.toLowerCase().includes('plansessie')) { setPlanningOpen(true); return }
                    setDetailPanel({ item, date, openAi })
                  }}
                  onDeleteItem={deleteWeekItem} onToggleStar={toggleWeekItemStar}
                  onOpenRoutines={() => setShowRoutines(true)}
                  weekSplit={weekSplit} onToggleSplit={isMobile ? undefined : () => setWeekSplit(s => !s)} />
              ) : (
                <MonthView items={weekItems}
                  onToggle={toggleWeekItem} onCtx={showCtx}
                  onAddItem={addWeekItem} onOpenRecurModal={() => setShowRecurModal(true)}
                  projects={projects}
                  onSwitchToWeek={(date) => { setWeekViewMode('week'); if (date) setWeekJumpDate(date) }} />
              )}
            </ErrorBoundary>
          )}
          {activeTab === 'projects' && (
            <ErrorBoundary label="Projecten">
              <ProjectsTab
                projects={projects} tasks={levendeTaken} categories={categories}
                onSelect={p => setSelectedProject(p)}
                onUpdateProjects={setProjects}
                onCreate={() => setShowCreateProject(true)}
              />
            </ErrorBoundary>
          )}
          {activeTab === 'dag' && (
            <ErrorBoundary label="Dag">
              {/* Het dagboek hoort bij je dag: ernaast als het venster breed
                  genoeg is, anders eronder. */}
              <div style={{ display:'flex', gap:18, alignItems:'flex-start', flexDirection: vw >= 1240 ? 'row' : 'column' }}>
                <div style={{ flex:'1 1 0', minWidth:0, width:'100%' }}>
                  <DagTab
                    today={todayStr}
                    weekItems={weekItems}
                    tasks={levendeTaken}
                    projects={projects}
                    recurringTasks={recurringTasks}
                    onToggle={toggleWeekItem}
                    onDelete={deleteWeekItem}
                    onAddItem={addWeekItem}
                    onSetTime={setWeekItemTime}
                    onTaskClick={t => setTaskModal(t)}
                  />
                </div>
                <div style={{ flex: vw >= 1240 ? '0 0 400px' : '1 1 auto', minWidth:0, width:'100%',
                  borderLeft: vw >= 1240 ? '1px solid var(--border)' : 'none', paddingLeft: vw >= 1240 ? 18 : 0 }}>
                  <DiaryTab entries={diaryEntries} today={todayStr} onAdd={addDiaryEntry}
                    moodEntries={moodEntries} onSaveMood={saveMoodEntry} onSuggestMood={suggestMoodFromDiary} compact={vw >= 1240} />
                </div>
              </div>
            </ErrorBoundary>
          )}
          {activeTab === 'tasks' && (
            <ErrorBoundary label="Taken">
              <TasksTab tasks={tasks} projects={projects} categories={categories}
                onUpdate={updateTask} onTaskClick={t => setTaskModal(t)} onMoveHorizon={updateTaskHorizon} onReorder={reorderTasks}
                      plannedDates={plannedTaskDates(weekItems, todayStr)}
                onDelete={deleteTask} onRestore={restoreTask} onPurge={purgeTask}
                onAdd={async (name, status, projId) => { await addTask(name, status, projId) }}
                onFeature={track}
                isMobile={isMobile} />
            </ErrorBoundary>
          )}
          {activeTab === 'goals' && (
            <ErrorBoundary label="Doelen">
              <GoalsTab goals={goals} categories={categories} onToggle={toggleGoal} onAddTask={(text) => addTask(text, 'backlog', null)}
                onAddGoal={addGoal} onFeature={track} onMove={moveGoal} onReorder={reorderGoals}
                onTrash={trashGoal} onRestore={restoreGoal} onPurge={purgeGoal}
                onOpenGoal={id => setSelectedGoal(goals.find(g => g.id === id) ?? null)} />
            </ErrorBoundary>
          )}
          {activeTab === 'achievements' && (
            <ErrorBoundary label="Achievements">
              <AchievementsTab
                achievements={achievements}
                categories={categories}
                userId={userId}
                onAdd={a => setAchievements(prev => [a, ...prev])}
              />
            </ErrorBoundary>
          )}
          {activeTab === 'visie' && (
            <ErrorBoundary label="Visie">
              <VisiTab categories={categories} goals={levendeDoelen} achievements={achievements} userId={userId} weekItems={weekItems} recurringTasks={recurringTasks.filter(r=>r.active)} projects={projects} focusCatId={visieFocusCat} onCreateCategory={createCategory} onDeleteCategory={deleteCategory}
                onOpenGoal={id => setSelectedGoal(levendeDoelen.find(g => g.id === id) ?? null)}
                onOpenAchievements={() => setActiveTab('achievements')} />
            </ErrorBoundary>
          )}
          {activeTab === 'overige' && (() => {
            // Op desktop bepaalt hidden_tabs wat je ziet; op mobiel is dit
            // scherm alleen bereikbaar via een item dat je zelf in Instellingen
            // weer hebt aangezet, dus daar telt mobile_hidden_features.
            const overigeHidden = isMobile ? mobileHiddenFeatures : hiddenTabs
            const overigeItems = ([
              { key:'graph',        icon:'📊', label:tc.tabs.inzicht },
              { key:'youtube',      icon:'📺', label:'YouTube' },
              { key:'mail',         icon:'✉️', label:'Mail' },
              { key:'voortgang',    icon:'⭐', label:tc.voortgang },
              { key:'plansessie',   icon:'🗓', label:tc.plansessie },
              { key:'weekreview',   icon:'📋', label:tc.weekreview },
              { key:'dagafsluiten', icon:'🌙', label:tc.dagAfsluitenKort },
              { key:'ai',           icon:'🤖', label:tc.albertAi },
            ] as { key: OverigeKey; icon: string; label: string }[]).filter(it => !overigeHidden.includes(it.key))
            const menuItem = (it: { key: OverigeKey; icon: string; label: string }) => {
              const active = (OVERIGE_VIEW_KEYS as string[]).includes(it.key) && overigeView === it.key
              return isMobile ? (
                <button key={it.key} onClick={() => pickOverige(it.key)}
                  style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500,
                    border:`1px solid ${active ? 'rgba(99,102,241,.5)' : 'var(--border)'}`,
                    color: active ? '#818cf8' : 'var(--muted)',
                    background: active ? 'rgba(99,102,241,0.12)' : 'var(--bg)' }}>
                  <span>{it.icon}</span><span>{it.label}</span>
                </button>
              ) : (
                <div key={it.key} onClick={() => pickOverige(it.key)}
                  style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:500,
                    color: active ? '#818cf8' : 'var(--muted)',
                    borderLeft:`2px solid ${active ? '#6366f1' : 'transparent'}`,
                    background: active ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                  <span>{it.icon}</span><span>{it.label}</span>
                </div>
              )
            }
            const chatLink = !overigeHidden.includes('chat') && (
              isMobile ? (
                <a key="chat" href="/chat"
                  style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:20, fontSize:12, fontWeight:500, color:'var(--muted)', textDecoration:'none', border:'1px solid var(--border)', background:'var(--bg)' }}>
                  <span>💬</span><span>{tc.aiChatKort}</span>
                </a>
              ) : (
                <a key="chat" href="/chat" style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', fontSize:12, fontWeight:500, color:'var(--muted)', textDecoration:'none' }}>
                  <span>💬</span><span>{tc.aiChatKort}</span>
                </a>
              )
            )
            return (
              <ErrorBoundary label="Overige">
                <div style={{ width:'100%', height:'100%', display:'flex', flexDirection: isMobile ? 'column' : 'row' }}>
                  {isMobile ? (
                    <div style={{ flexShrink:0, overflowX:'auto', padding:'8px 12px', display:'flex', gap:6, scrollbarWidth:'none', borderBottom:'1px solid var(--border)' }}>
                      {overigeItems.map(menuItem)}
                      {chatLink}
                    </div>
                  ) : (
                    <div style={{ width:188, flexShrink:0, background:'var(--bg2)', borderRight:'1px solid var(--border)', overflowY:'auto', padding:'6px 0' }}>
                      <div style={{ padding:'8px 12px 4px', fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'var(--dim)' }}>{tc.tabs.overige}</div>
                      {overigeItems.map(menuItem)}
                      {chatLink}
                    </div>
                  )}
                  <div style={{ flex:1, overflowY:'auto' }}>
                    {overigeView === 'graph' && !overigeHidden.includes('graph') && (
                      <GraphTab userId={userId} projects={projects} categories={categories} tasks={levendeTaken} weekItems={weekItems} achievements={achievements}
                        recurringTasks={recurringTasks} goals={levendeDoelen} moodEntries={moodEntries} today={todayStr} lang={lang}
                        lastCheck={lastCheck} onMarkChecked={markChecked} onFixItem={fixItem}
                        onFeature={track}
                        usage={{
                          events: usageEvents,
                          tabs: TABS as unknown as string[],
                          hiddenTabs, startTab: data.profile.start_tab ?? null, tracking,
                          onSetStartTab: setStartTab, onToggleHidden: toggleHiddenTab,
                          onSetTracking: setUsageTracking, onClear: clearUsage,
                          onOpen: loadUsage,
                        }}
                        onSelect={p => { setSelectedProject(p); setActiveTab('projects') }}
                        onSelectTask={t => setTaskModal(t)}
                        onAddTask={(name, projId) => addTask(name, 'backlog', projId)}
                        onDeleteTask={deleteTask}
                        onMarkTaskDone={id => updateTask(id, 'done')} />
                    )}
                    {overigeView === 'youtube' && !overigeHidden.includes('youtube') && <YouTubeTab />}
                    {overigeView === 'mail' && !overigeHidden.includes('mail') && <MailTab projects={projects} onCreateTask={createTaskFromMail} />}
                  </div>
                </div>
              </ErrorBoundary>
            )
          })()}
          {activeTab === 'month' && (
            <ErrorBoundary label="Maandoverzicht">
              <MonthView items={weekItems}
                onToggle={toggleWeekItem} onCtx={showCtx}
                onAddItem={addWeekItem} onOpenRecurModal={() => setShowRecurModal(true)}
                projects={projects}
                onSwitchToWeek={(date) => { setActiveTab('week'); setWeekViewMode('week'); if (date) setWeekJumpDate(date) }} />
            </ErrorBoundary>
          )}
        </div>

        {/* Project detail modal — rendered as fixed overlay */}
        {selectedProject && (
          <ProjectModal project={selectedProject} tasks={projectTasks(selectedProject.id)} allProjects={projects} onUpdateTask={updateTask}
            onOpenProject={p => setSelectedProject(p)}
            onSubCreated={p => { setProjects(prev => [...prev, p]); setSelectedProject(p) }}
            onUpdated={patch => {
              setProjects(prev => prev.map(p => p.id === patch.id ? { ...p, ...patch } : p))
              setSelectedProject(prev => prev && prev.id === patch.id ? { ...prev, ...patch } : prev)
            }}
            onDeleted={id => {
              setProjects(prev => prev.filter(p => p.id !== id))
              setTasks(prev => prev.map(t => t.proj_id === id ? { ...t, proj_id: null } : t))
              setWeekItems(prev => prev.map(w => w.proj_id === id ? { ...w, proj_id: null } : w))
              setSelectedProject(null)
            }}
            onClose={() => setSelectedProject(null)} />
        )}
        {/* Doel detail modal — rendered as fixed overlay, onafhankelijk van welke tab actief is */}
        {selectedGoal && (
          <GoalModal goal={selectedGoal} allGoals={levendeDoelen} categories={categories} projects={projects} userId={userId}
            onOpenGoal={g => setSelectedGoal(g)}
            onOpenProject={p => { setSelectedGoal(null); setSelectedProject(p); setActiveTab('projects') }}
            onUpdated={patch => {
              setGoals(prev => prev.map(g => g.id === patch.id ? { ...g, ...patch } : g))
              setSelectedGoal(prev => prev && prev.id === patch.id ? { ...prev, ...patch } : prev)
            }}
            onTrash={id => { trashGoal(id); setSelectedGoal(null) }}
            onClose={() => setSelectedGoal(null)} />
        )}
        {/* Nog-niet-SMART overzicht — zijpaneel, onafhankelijk van welke tab actief is */}
        {uitwerkPanelOpen && (
          <UitwerkPanel items={nietSmart} tasks={tasks}
            onOpenGoal={id => setSelectedGoal(goals.find(g => g.id === id) ?? null)}
            onOpenProject={p => { setSelectedProject(p); setActiveTab('projects') }}
            onClose={() => setUitwerkPanelOpen(false)} />
        )}
        {shoppingPanelOpen && (
          <ShoppingListPanel items={shoppingItems}
            onAdd={addShoppingItem} onToggle={toggleShoppingItem} onDelete={deleteShoppingItem}
            onClose={() => setShoppingPanelOpen(false)} />
        )}
        {/* Create project modal */}
        {showCreateProject && (
          <CreateProjectModal
            categories={categories} projects={projects} userId={userId}
            onClose={() => setShowCreateProject(false)}
            onCreated={p => { setProjects(prev => [...prev, p]); setSelectedProject(p); setShowCreateProject(false) }}
          />
        )}
      </div>

      {/* ── Mobiele bottom-nav ────────────────────────────────────────── */}
      {isMobile && (
        <div style={{ display:'flex', alignItems:'stretch', background:'var(--bg2)', borderTop:'1px solid var(--border)', flexShrink:0, paddingBottom:'env(safe-area-inset-bottom)' }}>
          {([
            ['dag',      '☀️', tc.tabs.dag],
            ['week',     '📅', tc.tabs.week],
            ['tasks',    '✅', tc.tabs.taken],
            ['projects', '🗂', tc.tabs.projecten],
          ] as [Tab, string, string][]).map(([tab, icon, label]) => {
            const active = activeTab === tab
            const badge  = tab === 'week' ? (mounted ? todayOpenItems : 0) : tab === 'tasks' ? activeTasks.length : 0
            return (
              <button key={tab} onClick={() => { setActiveTab(tab); setMobileMoreOpen(false) }} aria-label={label}
                style={{ flex:1, background:'none', border:'none', borderTop:`2px solid ${active ? '#6366f1' : 'transparent'}`, color:active ? 'var(--text)' : 'var(--muted)', cursor:'pointer', padding:'7px 0 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <span style={{ fontSize:19, lineHeight:1, position:'relative' }}>
                  {icon}
                  {badge > 0 && (
                    <span style={{ position:'absolute', top:-5, right:-13, fontSize:9, fontWeight:700, background:active ? '#6366f1' : 'var(--bg)', border:`1px solid ${active ? '#6366f1' : 'var(--border)'}`, color:active ? '#fff' : 'var(--dim)', borderRadius:8, padding:'1px 4px', minWidth:14, textAlign:'center', lineHeight:1.2 }}>
                      {badge}
                    </span>
                  )}
                </span>
                <span style={{ fontSize:10, fontWeight:600 }}>{label}</span>
              </button>
            )
          })}
          <button onClick={() => setMobileMoreOpen(o => !o)} aria-label={tc.meerTitel}
            style={{ flex:1, background:'none', border:'none', borderTop:`2px solid ${!['dag','week','tasks','projects'].includes(activeTab) ? '#6366f1' : 'transparent'}`, color:mobileMoreOpen || !['dag','week','tasks','projects'].includes(activeTab) ? 'var(--text)' : 'var(--muted)', cursor:'pointer', padding:'7px 0 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <span style={{ fontSize:19, lineHeight:1 }}>⋯</span>
            <span style={{ fontSize:10, fontWeight:600 }}>{tc.meer}</span>
          </button>
        </div>
      )}

      {/* ── Mobiel "Meer"-paneel (bottom sheet) ───────────────────────── */}
      {isMobile && mobileMoreOpen && (
        <div onClick={() => setMobileMoreOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:8500, background:'rgba(0,0,0,.55)', backdropFilter:'blur(2px)', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--bg2)', borderTop:'1px solid var(--border)', borderRadius:'16px 16px 0 0', padding:'10px 14px calc(16px + env(safe-area-inset-bottom))', boxShadow:'0 -12px 40px rgba(0,0,0,.5)', animation:'bubbleIn .18s ease' }}>
            <div style={{ width:36, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 12px' }} />
            {/* Hoofdmenu — zelfde tabs als de bovenbalk op desktop, zodat dit
                menu écht alles bevat (Dag/Week/Taken/Projecten staan al in de
                bottom-nav, maar horen hier ook voor volledigheid). */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
              {([
                ['dag',          '☀️', tc.tabs.dag],
                ['week',         '📅', tc.tabs.week],
                ['month',        '🗓', tc.tabs.maand],
                ['tasks',        '✅', tc.tabs.taken],
                ['projects',     '🗂', tc.tabs.projecten],
                ['goals',        '🎯', tc.tabs.doelen],
                ['achievements', '🏆', tc.tabs.wins],
                ['visie',        '🌟', tc.tabs.visie],
                ...(OVERIGE_ALL_KEYS.some(k => !mobileHiddenFeatures.includes(k)) ? [['overige', '⋯', tc.tabs.overige] as [Tab, string, string]] : []),
              ] as [Tab, string, string][]).map(([tab, icon, label]) => {
                const active = activeTab === tab
                return (
                  <button key={tab} onClick={() => { setActiveTab(tab); setMobileMoreOpen(false) }}
                    style={{ background:active ? 'rgba(99,102,241,.12)' : 'var(--bg)', border:`1px solid ${active ? 'rgba(99,102,241,.4)' : 'var(--border)'}`, borderRadius:10, padding:'12px 4px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5, color:active ? 'var(--text)' : 'var(--muted)' }}>
                    <span style={{ fontSize:21, lineHeight:1 }}>{icon}</span>
                    <span style={{ fontSize:10, fontWeight:600 }}>{label}</span>
                  </button>
                )
              })}
              <button onClick={() => { setJournalOpen(true); setMobileMoreOpen(false) }}
                style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 4px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5, color:'var(--muted)' }}>
                <span style={{ fontSize:21, lineHeight:1 }}>📓</span>
                <span style={{ fontSize:10, fontWeight:600 }}>{tc.dagboek}</span>
              </button>
              <button onClick={() => { setShoppingPanelOpen(true); setMobileMoreOpen(false) }}
                style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 4px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5, color:'var(--muted)' }}>
                <span style={{ fontSize:21, lineHeight:1 }}>🛒</span>
                <span style={{ fontSize:10, fontWeight:600 }}>{tc.boodschappenlijstje}</span>
              </button>
              <a href="/settings"
                style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 4px', textDecoration:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:5, color:'var(--muted)' }}>
                <span style={{ fontSize:21, lineHeight:1 }}>⚙️</span>
                <span style={{ fontSize:10, fontWeight:600 }}>{tc.instellingenKort}</span>
              </a>
            </div>
            {/* Overige-cluster losse acties: standaard leeg (alles staat uit
                op mobiel) — verschijnt hier pas als je iets in Instellingen
                weer aanzet (naast de "Overige"-tegel hierboven). */}
            {(() => {
              const enabled = (
                [
                  ['graph',        '📊', tc.tabs.inzicht],
                  ['youtube',      '📺', 'YouTube'],
                  ['mail',         '✉️', 'Mail'],
                  ['voortgang',    '⭐', tc.voortgang],
                  ['plansessie',   '🗓', tc.plansessie],
                  ['weekreview',   '📋', tc.weekreview],
                  ['dagafsluiten', '🌙', tc.dagAfsluitenKort],
                  ['ai',           '🤖', tc.albertAi],
                  ['chat',         '💬', tc.aiChatKort],
                ] as [OverigeKey, string, string][]
              ).filter(([key]) => !mobileHiddenFeatures.includes(key))
              if (!enabled.length) return null
              return (
                <>
                  <div style={{ height:1, background:'var(--border)', margin:'12px 0' }} />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
                    {enabled.map(([key, icon, label]) => key === 'chat' ? (
                      <a key={key} href="/chat" onClick={() => setMobileMoreOpen(false)}
                        style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 4px', textDecoration:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:5, color:'var(--muted)' }}>
                        <span style={{ fontSize:21, lineHeight:1 }}>{icon}</span>
                        <span style={{ fontSize:10, fontWeight:600 }}>{label}</span>
                      </a>
                    ) : (
                      <button key={key} onClick={() => { pickOverige(key); setMobileMoreOpen(false) }}
                        style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 4px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5, color:'var(--muted)' }}>
                        <span style={{ fontSize:21, lineHeight:1 }}>{icon}</span>
                        <span style={{ fontSize:10, fontWeight:600 }}>{label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Context menu ──────────────────────────────────────────────── */}
      {ctxMenu && (
        <div onClick={e => e.stopPropagation()} style={{
          position:'fixed', left:Math.min(ctxMenu.x, Math.max(8, window.innerWidth-372)), top:Math.min(ctxMenu.y, window.innerHeight-480), zIndex:9000,
          background:'#12172a', border:'1px solid rgba(99,102,241,.3)', borderRadius:12,
          boxShadow:'0 16px 48px rgba(0,0,0,.7)', minWidth:300, maxWidth:360, overflow:'hidden',
        }}>
          {/* Header */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,.06)', background:'rgba(99,102,241,.07)' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0', marginBottom:5, lineHeight:1.3 }}>
              {ctxMenu.item.text}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
              {(() => { const tp = ctxMenu.item.type; const wt = WEEK_TYPE[tp]??WEEK_TYPE.task; return <span style={{ padding:'1px 7px', borderRadius:4, background:wt.bg, border:`1px solid ${wt.border}`, color:wt.color }}>{wt.icon} {tp}</span> })()}
              {ctxMenu.item.done && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(63,185,80,.1)', border:'1px solid rgba(63,185,80,.3)', color:'#3fb950' }}>✓ gedaan</span>}
              {ctxMenu.item.recur_id && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(129,140,248,.1)', border:'1px solid rgba(129,140,248,.25)', color:'#818cf8' }}>↻ herhalend</span>}
            </div>
          </div>

          {/* RPM chain + goals */}
          {(ctxMenu.proj || ctxMenu.catObj) && (
            <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:'#6366f1', marginBottom:6 }}>RPM keten</div>
              {ctxMenu.proj && (
                <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:8 }}>
                  <div style={{ fontSize:16, flexShrink:0, marginTop:1 }}>{ctxMenu.proj.emoji}</div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:'#c7d2fe' }}>{ctxMenu.proj.name.split('—')[0].trim()}</div>
                    {ctxMenu.proj.description && <div style={{ fontSize:10, color:'#64748b', lineHeight:1.4, marginTop:1 }}>{ctxMenu.proj.description.slice(0,80)}{ctxMenu.proj.description.length>80?'…':''}</div>}
                  </div>
                </div>
              )}
              {ctxMenu.catObj && (
                <div style={{ borderLeft:'2px solid rgba(99,102,241,.3)', paddingLeft:10, marginBottom: ctxMenu.catGoals.length ? 8 : 0 }}>
                  <div style={{ fontSize:11, color:'#818cf8', fontWeight:600, marginBottom:2 }}>↑ {ctxMenu.catObj.name}</div>
                  {ctxMenu.catObj.vision && <div style={{ fontSize:10, color:'#475569', lineHeight:1.5 }}>{ctxMenu.catObj.vision.slice(0,140)}{ctxMenu.catObj.vision.length>140?'…':''}</div>}
                </div>
              )}
              {/* Jaar + kwartaal doelen */}
              {ctxMenu.catGoals.filter(g => g.horizon === 'jaar').slice(0,2).map(g => (
                <div key={g.id} style={{ fontSize:10, color:'#4ade80', padding:'4px 8px', marginBottom:3, background:'rgba(74,222,128,.06)', border:'1px solid rgba(74,222,128,.15)', borderRadius:5, lineHeight:1.45 }}>
                  📅 <strong>Jaar:</strong> {g.text.slice(0,90)}{g.text.length>90?'…':''}
                </div>
              ))}
              {ctxMenu.catGoals.filter(g => g.horizon === 'kwartaal').slice(0,1).map(g => (
                <div key={g.id} style={{ fontSize:10, color:'#a78bfa', padding:'4px 8px', marginBottom:3, background:'rgba(167,139,250,.06)', border:'1px solid rgba(167,139,250,.15)', borderRadius:5, lineHeight:1.45 }}>
                  🗓 <strong>Kwartaal:</strong> {g.text.slice(0,90)}{g.text.length>90?'…':''}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ padding:'4px 0' }}>
            <CtxItem label={ctxMenu.item.done ? '○ Markeer als open' : '✓ Markeer als klaar'} onClick={() => { toggleWeekItem(ctxMenu.item.id); setCtxMenu(null) }} />
            {/* Verwijderen kan nu ook hier — dus ook vanuit Maand en Dag. Bij een
                herhalende bezetting slaat dit alleen deze dag over (deleteWeekItem
                is daar zelf slim in) — het patroon blijft gewoon lopen. */}
            <CtxItem label="🗑 Verwijderen" sub={ctxMenu.item.recur_id ? 'slaat deze dag over — herhaling blijft' : 'ook uit week, maand en inzicht'}
              onClick={() => { deleteWeekItem(ctxMenu.item.id); setCtxMenu(null) }} />
            {ctxMenu.item.recur_id && (
              <CtxItem label="🗑 Herhaaltaak verwijderen" sub="stopt op alle dagen"
                onClick={() => { deleteRecurringTask(ctxMenu.item.recur_id!); setCtxMenu(null) }} />
            )}
            {ctxMenu.proj && (
              <CtxItem label="🗂 Ga naar project" sub={ctxMenu.proj.name.split('—')[0].trim()}
                onClick={() => { setSelectedProject(ctxMenu.proj!); setActiveTab('projects'); setCtxMenu(null) }} />
            )}
            {ctxMenu.catObj && (
              <CtxItem label="🌟 Bekijk Visie" sub={ctxMenu.catObj.name} onClick={() => { setActiveTab('visie'); setCtxMenu(null) }} />
            )}
            {ctxMenu.item.task_id && (() => {
              const t = tasks.find(tk => tk.id === parseInt(ctxMenu.item.task_id!))
              return t ? <CtxItem label="🔍 Bekijk taak details" onClick={() => { setTaskModal(t); setCtxMenu(null) }} /> : null
            })()}
          </div>
        </div>
      )}

      {/* ── Week item detail panel ───────────────────────────────────── */}
      {detailPanel && (
        <WeekItemDetailPanel
          panel={detailPanel}
          categories={categories}
          projects={projects}
          goals={levendeDoelen}
          recurringTasks={recurringTasks}
          tasks={levendeTaken}
          onClose={() => setDetailPanel(null)}
          onToggle={toggleWeekItem}
          onDeleteItem={deleteWeekItem}
          onDeleteRecur={deleteRecurringTask}
          onMakeOneTime={makeWeekItemOneTime}
          onMakeRecurring={makeWeekItemRecurring}
          onLinkCat={linkWeekItemToCat}
          onGotoVisie={gotoVisie}
          onAddSuggestion={async (text, date, projId) => !!(await addWeekItem(date, text, 'task', projId))}
          onToggleSubtask={updateTaskSubtasks}
          onSetTaskNotes={updateTaskNotes}
        />
      )}

      {/* ── Task detail modal (RPM chain) ─────────────────────────────── */}
      {taskModal && (
        <TaskModal
          task={tasks.find(t => t.id === taskModal.id) ?? taskModal}
          project={projects.find(p => p.id === taskModal.proj_id) ?? null}
          category={categories.find(c => c.id === projects.find(p => p.id === taskModal.proj_id)?.cat_id) ?? null}
          allProjects={projects}
          onClose={() => setTaskModal(null)}
          onUpdate={updateTask}
          onSetDuration={updateTaskDuration}
          onSetPriority={updateTaskPriority}
          onSetNotes={updateTaskNotes}
          onRename={renameTask}
          onSetSubtasks={updateTaskSubtasks}
          onSetDeadline={updateTaskDeadline}
          onAssignProject={updateTaskProject}
          onStartFocus={t => { setFocusTask(t); setTaskModal(null) }}
          onConvertToRecurring={convertTaskToRecurring}
        />
      )}

      {/* ── Recurring task modal ──────────────────────────────────────── */}
      {showRecurModal && (
        <RecurringTaskModal
          allTasks={recurringTasks}
          categories={categories}
          onToggle={toggleRecurTask}
          onDelete={deleteRecurringTask}
          onCreate={createRecurTask}
          onConvertToTask={convertRecurringToTask}
          onClose={() => setShowRecurModal(false)}
        />
      )}

      {/* ── Routine-weekoverzicht (ma→zo + urenbalans) ─────────────────── */}
      {showRoutines && (
        <RoutinesPanel
          tasks={recurringTasks}
          categories={categories}
          onToggle={toggleRecurTask}
          onSetDuration={setRecurDuration}
          onClose={() => setShowRoutines(false)}
        />
      )}

      {/* ── Planning session modal ────────────────────────────────────── */}
      {planningOpen && (
        <PlanningSessionModal
          profile={data.profile} userId={userId}
          onClose={() => setPlanningOpen(false)} onSaved={refreshFromDb}
          onGoToWeek={() => {
            setActiveTab('week')
            setWeekSplit(true)
          }}
          tasks={levendeTaken} projects={projects} weekItems={weekItems}
          achievements={achievements}
          onAddAchievement={a => setAchievements(prev => [a, ...prev])}
        />
      )}

      {/* ── Search overlay ────────────────────────────────────────────── */}
      {showSearch && (
        <SearchModal
          tasks={levendeTaken} projects={projects} categories={categories}
          weekItems={weekItems} achievements={achievements} goals={levendeDoelen}
          onClose={() => setShowSearch(false)}
          onTaskClick={t => { setTaskModal(t); setShowSearch(false) }}
          onProjectClick={p => { setSelectedProject(p); setActiveTab('projects'); setShowSearch(false) }}
          onTabSwitch={tab => { setActiveTab(tab as Tab); setShowSearch(false) }}
        />
      )}

      {/* ── Quick-add today (N) ───────────────────────────────────────── */}
      {showQuickAdd && (
        <QuickAddModal
          todayStr={todayStr}
          projects={projects}
          onAdd={async (text, type, projId) => {
            const p = parseQuickAdd(text, todayStr)
            await addWeekItem(p.date ?? todayStr, p.text, type, projId, p.timeBlock ?? undefined)
            setShowQuickAdd(false)
          }}
          onAddInbox={async (text) => {
            await addTask(text, 'backlog', null)
            setShowQuickAdd(false)
          }}
          onClose={() => setShowQuickAdd(false)}
        />
      )}

      {/* ── Floating Journal (achievements / magic / verbeter) ──────────
          Op telefoon én tablet (<1024px) geen los rondzwevend knopje meer —
          bereikbaar via ☰ Meer i.p.v. als eigen FAB dat in de weg zit
          (Jordan: "ik hou niet van dat kleine dagboekding"). */}
      {showFloatingFabs && (
        <div style={{ position:'fixed', bottom:24, right:90, zIndex:999 }}>
          <JournalWidget userId={userId} achievements={achievements} onAdd={a => setAchievements(prev => [a, ...prev])} />
        </div>
      )}
      {!showFloatingFabs && (
        <JournalWidget userId={userId} achievements={achievements} onAdd={a => setAchievements(prev => [a, ...prev])}
          hideFab open={journalOpen} onClose={() => setJournalOpen(false)} />
      )}

      {/* ── Floating Jarvis — zelfde tablet/telefoon-uitzondering (staat op
          mobiel sowieso standaard uit via mobile_hidden_features 'ai'). ── */}
      {(showFloatingFabs || !mobileHiddenFeatures.includes('ai')) && (
      <JarvisWidget tasks={levendeTaken} projects={projects} categories={categories} onTaskClick={t => setTaskModal(t)} onMutated={async (tabs) => {
          // (XP voor AI-mutaties wordt server-side in de tool-executor geregistreerd)
          await refreshFromDb()
          if (tabs?.length) {
            const tabMap: Record<string, { label: string; uiTab: Tab }> = {
              tasks:        { label: tc.tabs.taken,      uiTab: 'tasks' },
              week:         { label: tc.weekplanning,    uiTab: 'week' },
              achievements: { label: 'Achievements',     uiTab: 'achievements' },
              projects:     { label: tc.tabs.projecten,  uiTab: 'projects' },
              dagboek:      { label: tc.dagboek,         uiTab: 'dag' },
            }
            const mapped = tabs.map(t => tabMap[t]).filter(Boolean)
            if (mapped.length) {
              setActiveTab(mapped[0].uiTab)
              const label = mapped.map(m => m.label).join(' & ')
              setMutationToast({ message: label, tab: mapped[0].uiTab })
              setTimeout(() => setMutationToast(null), 4500)
            }
          }
        }} />
      )}

      {/* ── Onboarding rondleiding ────────────────────────────────────── */}
      {showTour && (
        <OnboardingTour
          categories={categories}
          onCreateGoal={createOnboardingGoal}
          onFinish={finishOnboarding}
          onClose={() => setShowTour(false)}
        />
      )}

      {/* ── Startgesprek voor nieuwe gebruikers ───────────────────────── */}
      {showSetup && (
        <SetupWizard
          categories={categories}
          aiToken={data.profile.ai_token}
          startStep={data.profile.setup_step ?? 0}
          onCreateAreas={setupCreateAreas}
          onCreateGoals={setupCreateGoals}
          onCreateRoutines={setupCreateRoutines}
          onSaveVisionLink={setupSaveVisionLink}
          onStepChange={setupSetStep}
          onFinish={finishSetup}
          onClose={() => setShowSetup(false)}
        />
      )}

      {/* ── Stats & skills sheet ──────────────────────────────────────── */}
      {showStats && (
        <StatsSheet events={xpEvents} categories={categories} onClose={() => setShowStats(false)} />
      )}

      {/* ── Level-up toast ────────────────────────────────────────────── */}
      {levelUpToast !== null && (
        <div style={{ position:'fixed', top:'22%', left:'50%', transform:'translateX(-50%)', zIndex:9600, background:'linear-gradient(135deg,#4338ca,#7c3aed)', border:'1px solid rgba(168,85,247,.5)', borderRadius:16, padding:'18px 28px', textAlign:'center', boxShadow:'0 24px 70px rgba(88,28,135,.6)', animation:'bubbleIn .35s cubic-bezier(.34,1.56,.64,1)' }}>
          <div style={{ fontSize:34, marginBottom:4 }}>⭐</div>
          <div style={{ fontSize:12, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'#e9d5ff' }}>Level up!</div>
          <div style={{ fontSize:22, fontWeight:900, color:'#fff' }}>Level {levelUpToast}</div>
        </div>
      )}

      {/* ── AI mutation toast ─────────────────────────────────────────── */}
      {mutationToast && (
        <div style={{ position:'fixed', bottom: isMobile ? 152 : 100, right: isMobile ? 16 : 88, zIndex:9200, background:'#0d1117', border:'1px solid rgba(74,222,128,.3)', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, boxShadow:'0 8px 32px rgba(0,0,0,.65)', animation:'bubbleIn .2s ease', fontSize:12, maxWidth: isMobile ? 'calc(100vw - 32px)' : 300 }}>
          <span style={{ color:'#4ade80', fontSize:16, flexShrink:0 }}>✓</span>
          <span style={{ color:'#e2e8f0', lineHeight:1.4, flex:1 }}>
            AI heeft <strong style={{ color:'#a5b4fc' }}>{mutationToast.message}</strong> bijgewerkt
          </span>
          <button onClick={() => { setActiveTab(mutationToast.tab); setMutationToast(null) }}
            style={{ fontSize:11, color:'#818cf8', background:'rgba(99,102,241,.15)', border:'1px solid rgba(99,102,241,.3)', cursor:'pointer', padding:'3px 10px', borderRadius:6, fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>
            Bekijk →
          </button>
          <button onClick={() => setMutationToast(null)}
            style={{ background:'none', border:'none', color:'#374151', cursor:'pointer', fontSize:16, lineHeight:1, flexShrink:0, padding:'0 2px' }}>
            ×
          </button>
        </div>
      )}

      {/* ── Delete / undo toast ──────────────────────────────────────── */}
      {goalTrashAsk && (
        <GoalTrashDialog
          goal={goalTrashAsk}
          linked={tasksForGoal(goalTrashAsk, levendeTaken, projects)}
          projects={projects}
          onCancel={() => setGoalTrashAsk(null)}
          onConfirm={keuzes => trashGoalWithTasks(goalTrashAsk, keuzes)}
        />
      )}

      {deleteToast && (
        <div style={{ position:'fixed', bottom: isMobile ? 90 : 24, left:'50%', transform:'translateX(-50%)', zIndex:9999, padding:'9px 16px', background:'#1a0d0d', border:'1px solid rgba(248,81,73,.35)', borderRadius:10, fontSize:12, color:'#e2e8f0', display:'flex', alignItems:'center', gap:10, boxShadow:'0 4px 24px rgba(0,0,0,.6)', whiteSpace:'nowrap', animation:'bubbleIn .2s ease' }}>
          <span style={{ color:'#f87171' }}>🗑</span>
          <span>{deleteToast}</span>
          <button onClick={undoDelete} style={{ background:'rgba(99,102,241,.2)', border:'1px solid rgba(99,102,241,.4)', borderRadius:5, color:'#a5b4fc', cursor:'pointer', fontSize:11, fontWeight:700, padding:'2px 9px' }}>
            Ctrl+Z
          </button>
        </div>
      )}

      {/* ── Week review modal ─────────────────────────────────────────────────── */}
      {weekReviewOpen && (
        <WeekReviewModal
          today={todayStr}
          weekItems={weekItems}
          achievements={achievements}
          tasks={levendeTaken}
          goals={levendeDoelen}
          onClose={() => setWeekReviewOpen(false)}
        />
      )}

      {/* ── Shutdown-ritueel ──────────────────────────────────────────────────── */}
      {shutdownOpen && (
        <ShutdownModal
          today={todayStr}
          weekItems={weekItems}
          achievements={achievements}
          onToggle={toggleWeekItem}
          onMove={moveWeekItem}
          onDelete={deleteWeekItem}
          onAddWin={addWinAchievement}
          onClose={() => setShutdownOpen(false)}
        />
      )}

      {/* ── Focus timer (Pomodoro) ─────────────────────────────────────────────── */}
      {focusTask && (
        <FocusTimer task={focusTask} onStop={() => setFocusTask(null)} onElapsed={min => addActualMin(focusTask.id, min)} />
      )}

      {/* ── Offline banner ────────────────────────────────────────────── */}
      {mounted && !isOnline && (
        <div style={{ position:'fixed', bottom: (deleteToast ? 72 : 24) + (isMobile ? 66 : 0), left:'50%', transform:'translateX(-50%)', zIndex:9999, padding:'8px 20px', background:'#1a0a0a', border:'1px solid rgba(248,81,73,.4)', borderRadius:99, fontSize:12, color:'#f87171', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 24px rgba(0,0,0,.6)', pointerEvents:'none', whiteSpace:'nowrap', transition:'bottom .2s ease' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#f87171', display:'inline-block', animation:'pulse 1.5s ease infinite' }} />
          {tc.geenInternet}
        </div>
      )}

    </div>
    </LangProvider>
  )
}


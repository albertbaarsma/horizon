import type { Lang } from './lang'

export type TaskStatus = 'backlog' | 'doing' | 'waiting' | 'done'
export type ProjectStatus = 'actief' | 'lopend' | 'urgent' | 'soon' | 'visie' | 'slapend' | 'onzeker' | 'love' | 'archief'
export type GoalHorizon = 'nu' | 'wk' | '6w' | 'kwartaal' | 'jaar' | '2-4jr' | '5-9jr' | '10jr+' | 'doorlopend' | 'ooit'
/** 'doel' telt mee in je voortgang, 'hobby' is voor de leuk — spel, lezen, uitzoeken. */
export type GoalKind = 'doel' | 'hobby'
export type AiProvider = 'anthropic' | 'ollama' | 'lmstudio' | 'openai'

export interface Profile {
  id: string
  display_name: string
  ai_token: string
  created_at: string
  google_calendar_connected?: boolean
  google_access_token?: string | null
  google_refresh_token?: string | null
  google_token_expires_at?: string | null
  ai_provider?: AiProvider | null
  ai_model?: string | null
  ai_base_url?: string | null
  ai_api_key?: string | null
  vision_text?: string | null
  planning_music_url?: string | null
  onboarding_done?: boolean
  setup_done?: boolean
  setup_step?: number
  onboarding_step?: number
  unlocked_features?: string[]
  /** Gebruik meten aan/uit — standaard aan, altijd uit te zetten. */
  usage_tracking?: boolean
  /** Waar de app opent, en welke tabs je uit de balk hebt gehaald. */
  start_tab?: string | null
  hidden_tabs?: string[]
  /** Zelfde soort lijst als hidden_tabs, maar dan voor wat je op mobiel uit hebt gezet — los bijgehouden omdat de standaard daar juist "alles uit" is. */
  mobile_hidden_features?: string[]
  /** Meldingsbalkjes (urgent/achterstallig/controle/niet-SMART) los bovenin tonen — standaard uit, dan zitten ze alleen onder het belletje. */
  show_alert_banners?: boolean
  /** Taal van het dashboard. Onbekend/null = Engels (nieuwe gebruikers); Jordan staat op 'nl'. */
  language?: Lang | null
}

export type XpSource = 'task' | 'achievement' | 'goal' | 'tutorial' | 'manual' | 'ai' | 'skill'

export interface XpEvent {
  id: number
  user_id: string
  amount: number
  reason: string
  cat_id: string | null
  source: XpSource
  /** Vrije vaardigheid waar deze XP naartoe gaat (sociaal, IT, muziek…). Los van cat_id. */
  skill?: string | null
  ref_id: string | null
  seen: boolean
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  vision?: string
  why?: string
  purpose?: string
  roles?: string
  three_to_thrive?: string
  resources?: string
  juicy_factor?: string
  rpm_1year?: string
  rpm_3month?: string
  /** Vrije notities bij dit levensgebied — losse gedachten die nergens anders in passen. */
  notes?: string | null
}

export interface Project {
  id: string
  user_id: string
  cat_id: string
  name: string
  emoji: string
  status: ProjectStatus
  description: string
  vision: string
  proj_type: 'project' | 'routine'
  notes: string | null
  html_content: string | null
  is_priority: boolean
  sort_order: number
  parent_id?: string | null   // sub-project: hangt onder dit hoofdproject
  /** Optionele tijdshorizon, zelfde schaal als een doel (GoalHorizon). Los van
   *  status — status is activiteit ("actief"/"slapend"), horizon is timing.
   *  null = nog niet ingedeeld. */
  horizon?: GoalHorizon | null
  /** Met een deadline stuurt die de horizon automatisch aan (zie
   *  lib/deadline-horizon.ts) — hoe dichterbij, hoe korter de horizon. */
  deadline?: string | null
  /** De allereerste ooit gezette deadline — blijft staan ook als de deadline
   *  daarna verschuift, zodat "verschoven t.o.v. wanneer" te zien blijft. */
  original_deadline?: string | null
  created_at: string
  updated_at: string
}

export interface Subtask {
  text: string
  done: boolean
}

export interface Task {
  id: number
  user_id: string
  proj_id: string | null   // null = 📥 inbox (nog geen project)
  name: string
  status: TaskStatus
  urgent: boolean
  /** 0 = geen prioriteit, 1-5 = hoe hoger hoe belangrijker. Puur een badge/filter — bepaalt de sortering in Dag, maar niet meer in Taken (daar is dat nu sort_order, zie hieronder). */
  priority: number
  duration_min?: number | null
  actual_min?: number | null
  notes?: string | null
  subtasks?: Subtask[] | null
  /** Prullenbak: gezet betekent weggegooid maar terug te halen. */
  deleted_at?: string | null
  /** Handmatige volgorde binnen zijn groep (Kanban-kolom/status, of horizon-
   *  kolom) — 0..n-1 per groep, niet globaal. Optioneel (i.p.v. verplicht
   *  zoals bij Project) om bestaande fixtures/rijen niet te breken — ontbreekt
   *  'ie, dan is 0 de aanname. Zie lib/reorder.ts. */
  sort_order?: number
  /** Optionele tijdshorizon, zelfde schaal als een project/doel (GoalHorizon).
   *  null = nog niet ingedeeld. */
  horizon?: GoalHorizon | null
  /** Met een deadline stuurt die de horizon automatisch aan (zie
   *  lib/deadline-horizon.ts) — hoe dichterbij, hoe korter de horizon. */
  deadline?: string | null
  /** De allereerste ooit gezette deadline — blijft staan ook als de deadline
   *  daarna verschuift, zodat "verschoven t.o.v. wanneer" te zien blijft. */
  original_deadline?: string | null
  created_at: string
  updated_at: string
}

export interface Goal {
  id: number
  user_id: string
  horizon: GoalHorizon
  text: string
  done: boolean
  cat_id: string | null
  deadline: string | null
  /** De allereerste ooit gezette deadline — zie Task.original_deadline. */
  original_deadline?: string | null
  deleted_at?: string | null
  /** Standaard 'doel'; hobbydoelen tellen niet mee in het voortgangscijfer. */
  kind?: GoalKind
  /** Wat is het gewenste resultaat — het R uit RPM (Result). */
  result?: string | null
  /** Waarom dit doel telt — het P uit RPM (Purpose). */
  why?: string | null
  /** Vrije notities / actieplan. */
  notes?: string | null
  /** Handmatige volgorde binnen zijn horizon-kolom (na de levensgebied-
   *  groepering) — 0..n-1 per kolom, niet globaal. Optioneel, zie Task.sort_order. */
  sort_order?: number
  /** Geplakte HTML — grafieken, afbeeldingen, tabellen. */
  html_content?: string | null
  /** Hoofddoel waar dit een sub-doel van is. */
  parent_id?: number | null
  created_at: string
}

export interface Achievement {
  id: number
  user_id: string
  date: string
  text: string
  cat_id: string
  emoji: string
  source?: string | null   // bv. 'goal' — waar dit achievement automatisch vandaan komt
  ref_id?: string | null   // id van de bron (bv. goal.id), voor dedup/koppeling
  label?: string | null    // bv. "Kwartaaldoel" — getoond als gekleurde chip
  created_at: string
}

export interface WeekItem {
  id: number
  user_id: string
  date: string
  type: 'task' | 'cal' | 'sport' | 'kids' | 'urgent'
  text: string
  done: boolean
  proj_id: string | null
  task_id: string | null
  recur_id: number | null
  time_block?: string | null
  postponed_count?: number
  starred?: boolean
  /** Bij een deze-week-verplaatste herhaling: de dag waar hij oorspronkelijk stond.
   *  Het herhaalpatroon zelf (recurring_tasks.days) verandert hier niet van. */
  moved_from?: string | null
  /** Handmatige volgorde binnen die ene dag — 0..n-1 per dag, niet globaal. Optioneel, zie Task.sort_order. */
  sort_order?: number
  created_at: string
}

export interface RecurringTask {
  id: number
  user_id: string
  name: string
  type: 'task' | 'sport' | 'cal' | 'kids' | 'urgent'
  days: string[]
  cat_id: string | null
  proj_id: string | null
  active: boolean
  /** Geschatte duur per keer in minuten — voor het uren-overzicht per week. */
  duration_min?: number | null
  /** Data (ISO) waarop deze herhaling bewust is overgeslagen. Het patroon
   *  zelf (days) verandert hier niet van. */
  skip_dates?: string[]
  created_at: string
}

export interface DiaryEntry {
  id: number
  user_id: string
  date: string
  text: string
  created_at: string
}

export type AttachmentEntityType = 'project' | 'goal' | 'task'

export interface Attachment {
  id: number
  user_id: string
  entity_type: AttachmentEntityType
  entity_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export interface MoodEntry {
  id: number
  user_id: string
  date: string
  /** -10 (zwaar omlaag) … 0 (neutraal) … +10 (sterk omhoog) */
  mood: number
  energy?: number | null
  sleep_hours?: number | null
  note?: string | null
  /** Wie de stemming heeft bepaald — 'ai' als hij overgenomen is uit een AI-inschatting op het dagboek. */
  source?: 'manual' | 'ai' | null
  created_at: string
}

export interface ShoppingItem {
  id: number
  user_id: string
  text: string
  done: boolean
  created_at: string
}

export interface LifeReport {
  id: number
  user_id: string
  kind: 'week' | 'month'
  period_start: string
  period_end: string
  content: string
  created_at: string
}

export interface FinanceEntry {
  id: number
  user_id: string
  person: string
  /** Signed: positief = deze persoon is jou dit schuldig, negatief = jij bent hem dit schuldig. */
  amount: number
  description: string
  /** De uitgeschreven berekening erachter — alleen gevuld bij uit tekst geëxtraheerde bedragen. */
  reasoning?: string | null
  date: string
  settled: boolean
  created_at: string
}

export interface Investment {
  id: number
  user_id: string
  asset_type: 'crypto' | 'aandeel'
  symbol: string
  name: string
  quantity: number
  /** Totaal betaald, in euro — niet per eenheid. */
  cost_basis: number
  /** Per eenheid, in euro. Voor crypto te verversen via CoinGecko; voor aandelen handmatig. */
  current_price: number | null
  price_updated_at: string | null
  notes: string
  date: string
  created_at: string
}

export interface FinanceTransaction {
  id: number
  user_id: string
  date: string
  description: string
  /** Signed: positief = inkomen, negatief = uitgave. */
  amount: number
  category: string
  source: string | null
  created_at: string
}

export interface AllowanceEntry {
  id: number
  user_id: string
  child: string
  /** Signed: positief = geld erbij (zakgeld, cadeau), negatief = uitgegeven. */
  amount: number
  description: string
  date: string
  created_at: string
}

export interface AllowanceGoal {
  id: number
  user_id: string
  child: string
  title: string
  url: string | null
  target_amount: number | null
  achieved: boolean
  created_at: string
}

export interface DashboardData {
  profile: Profile
  categories: Category[]
  projects: Project[]
  tasks: Task[]
  goals: Goal[]
  achievements: Achievement[]
  weekItems: WeekItem[]
  recurringTasks: RecurringTask[]
  xpEvents: XpEvent[]
  diaryEntries: DiaryEntry[]
  moodEntries: MoodEntry[]
  shoppingItems: ShoppingItem[]
}

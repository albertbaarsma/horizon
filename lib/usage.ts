// ─── Wat gebruik je echt? ─────────────────────────────────────────────────────
// Om de app te kunnen verbeteren moet je weten wat er blijft liggen. Deze module
// houdt bij welke tabs je opent (en hoe lang) en welke onderdelen je aanklikt.
//
// Bewust karig: alleen sleutels, nooit inhoud. Geen taaknamen, geen dagboek,
// geen IP, geen derde partij. Alles in je eigen database.

export type UsageKind = 'tab' | 'feature'

export interface UsageEvent {
  kind: UsageKind
  target: string
  seconds?: number | null
  created_at: string
}

/** Tabs zoals ze in de balk staan, met een leesbare naam voor het rapport. */
export const TAB_LABELS: Record<string, string> = {
  dag: 'Dag', week: 'Week', month: 'Maand', tasks: 'Taken', projects: 'Projecten',
  goals: 'Doelen', achievements: 'Wins', graph: 'Inzicht', visie: 'Visie',
  youtube: 'YouTube', mail: 'Mail',
}

/**
 * De onderdelen die we los meten. Wat hier staat en nooit voorkomt in de
 * gegevens, is een kandidaat om te vereenvoudigen of weg te halen — dat is de
 * hele reden dat deze lijst bestaat.
 */
export interface FeatureDef { key: string; label: string; tab: string }

export const TRACKED_FEATURES: FeatureDef[] = [
  { key: 'inzicht-2d',       label: '2D kaart',                 tab: 'graph' },
  { key: 'inzicht-3d',       label: '3D bol',                   tab: 'graph' },
  { key: 'inzicht-heatmap',  label: 'Heatmap',                  tab: 'graph' },
  { key: 'inzicht-controle', label: 'Controle',                 tab: 'graph' },
  { key: 'inzicht-gebruik',  label: 'Gebruik',                  tab: 'graph' },
  { key: 'kaart-nakijken',   label: 'Kaart bijwerken',          tab: 'graph' },
  { key: 'taak-afvinken',    label: 'Taak afvinken',            tab: 'tasks' },
  { key: 'taak-verwijderen', label: 'Taak verwijderen',         tab: 'tasks' },
  { key: 'taak-toevoegen',   label: 'Taak toevoegen',           tab: 'tasks' },
  { key: 'taak-prullenbak',  label: 'Takenprullenbak openen',   tab: 'tasks' },
  { key: 'doel-toevoegen',   label: 'Doel toevoegen',           tab: 'goals' },
  { key: 'doel-inklappen',   label: 'Kolom inklappen',          tab: 'goals' },
  { key: 'doel-afvinken',    label: 'Doel afvinken',            tab: 'goals' },
  { key: 'doel-weggooien',   label: 'Doel weggooien',           tab: 'goals' },
  { key: 'ai-stappen',       label: 'AI-stappen bij een doel',  tab: 'goals' },
  { key: 'dagboek-schrijven',label: 'Dagboek schrijven',        tab: 'dag' },
  { key: 'stemming-invullen',label: 'Stemming invullen',        tab: 'dag' },
  { key: 'week-ritme',       label: 'Week-ritme',               tab: 'week' },
  { key: 'jarvis',           label: 'Jarvis (AI-gesprek)',      tab: 'dag' },
  { key: 'zoeken',           label: 'Zoeken',                   tab: 'dag' },
  { key: 'focus-timer',      label: 'Focus-timer',              tab: 'dag' },
]

// ─── Verzamelen (browserkant) ─────────────────────────────────────────────────

type Rij = { kind: UsageKind; target: string; seconds?: number | null }

/**
 * Kleine buffer die zelf niets weet van Supabase — de aanroeper geeft een
 * verzendfunctie mee. Zo is dit te testen zonder netwerk.
 */
export class UsageTracker {
  private buffer: Rij[] = []
  private tabStart: number | null = null
  private huidigeTab: string | null = null

  constructor(
    private send: (rijen: Rij[]) => Promise<void> | void,
    private aan: () => boolean = () => true,
    private nu: () => number = () => Date.now(),
  ) {}

  /** Van tab wisselen: sluit de vorige af met zijn kijktijd. */
  tab(next: string) {
    if (this.huidigeTab === next) return
    this.sluitTab()
    this.huidigeTab = next
    this.tabStart = this.nu()
  }

  /** Onderdeel gebruikt. Eén regel per klik; te veel is hier niet erg. */
  feature(key: string) {
    if (!this.aan()) return
    this.buffer.push({ kind: 'feature', target: key })
  }

  /** Tab afsluiten zonder een nieuwe te openen (venster dicht, uitloggen). */
  sluitTab() {
    if (!this.huidigeTab || this.tabStart === null) return
    const seconden = Math.round((this.nu() - this.tabStart) / 1000)
    // Onder een seconde is een doorklik, geen bezoek
    if (this.aan() && seconden >= 1) {
      this.buffer.push({ kind: 'tab', target: this.huidigeTab, seconds: seconden })
    }
    this.huidigeTab = null
    this.tabStart = null
  }

  /** Wat er nu in de buffer staat, en de buffer leegmaken. */
  async flush() {
    this.sluitTab()
    if (this.buffer.length === 0) return
    const rijen = this.buffer
    this.buffer = []
    await this.send(rijen)
  }

  /** Voor tests en voor 'hoeveel staat er te wachten'. */
  get wachtrij(): readonly Rij[] { return this.buffer }
}

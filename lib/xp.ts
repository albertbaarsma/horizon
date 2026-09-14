// ─── XP / level-systeem — gedeelde logica ────────────────────────────────────
// Level-curve: totale XP nodig om level L te bereiken = 50 · (L-1) · L
//   Lvl 1 = 0 · Lvl 2 = 100 · Lvl 3 = 300 · Lvl 4 = 600 · Lvl 5 = 1000 · Lvl 6 = 1500 …

export const XP_AMOUNTS = {
  task:        10,
  taskUrgent:  15,
  achievement: 25,
  goal:        15,
  tutorial:    20,
  ai:          2,   // kleine registratie wanneer Horizon AI iets voor je aanpast
} as const

/** Totale XP die nodig is om (aan het begin van) een level te staan. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return 50 * (level - 1) * level
}

/** Welk level hoort bij een totale XP-stand. */
export function levelForXp(totalXp: number): number {
  if (totalXp <= 0) return 1
  return Math.floor(0.5 + Math.sqrt(0.25 + 0.02 * totalXp))
}

export interface LevelProgress {
  level:   number
  into:    number  // XP verdiend binnen het huidige level
  span:    number  // XP nodig van dit level naar het volgende
  toNext:  number  // XP nog te gaan tot volgend level
  pct:     number  // voortgang binnen level (0–100)
  total:   number
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelForXp(totalXp)
  const cur   = xpForLevel(level)
  const next  = xpForLevel(level + 1)
  const span  = next - cur
  const into  = totalXp - cur
  return {
    level,
    into,
    span,
    toNext: Math.max(0, next - totalXp),
    pct:    span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 100,
    total:  totalXp,
  }
}

/** Speelse titel per level-bereik. */
export function levelTitle(level: number): string {
  if (level >= 20) return 'Legende'
  if (level >= 15) return 'Meester'
  if (level >= 11) return 'Visionair'
  if (level >= 8)  return 'Bouwer'
  if (level >= 5)  return 'Doener'
  if (level >= 3)  return 'Ontdekker'
  return 'Starter'
}

// ─── Features die je unlockt naarmate je levelt ──────────────────────────────
export interface Feature {
  key:   string
  label: string
  icon:  string
  level: number
  desc:  string
}

export const FEATURES: Feature[] = [
  { key: 'goals',        label: 'Doelen',        icon: '🎯', level: 1, desc: 'Bepaal waar je heen wilt — de basis van alles.' },
  { key: 'week',         label: 'Weekplanning',  icon: '📅', level: 1, desc: 'Plan je dagen en week.' },
  { key: 'tasks',        label: 'Taken',         icon: '✅', level: 2, desc: 'Losse taken beheren en afvinken.' },
  { key: 'projects',     label: 'Projecten',     icon: '🗂', level: 2, desc: 'Groepeer je werk in projecten.' },
  { key: 'achievements', label: 'Wins',          icon: '🏆', level: 3, desc: 'Vier en log je overwinningen.' },
  { key: 'graph',        label: 'Inzicht',       icon: '📊', level: 4, desc: 'Statistieken en voortgang.' },
  { key: 'visie',        label: 'Visie',         icon: '🌟', level: 5, desc: 'Je levensvisie per categorie.' },
  { key: 'ai',           label: 'Horizon AI',     icon: '🤖', level: 5, desc: 'AI-assistent die je taken en planning aanstuurt.' },
  { key: 'youtube',      label: 'YouTube',       icon: '📺', level: 6, desc: 'Content-planning voor je kanalen.' },
]

export function isUnlocked(feature: Feature, level: number, unlocked: string[] = []): boolean {
  return unlocked.includes('*') || unlocked.includes(feature.key) || level >= feature.level
}

/** Features die op precies dit level vrijkomen (voor level-up meldingen). */
export function featuresUnlockedAt(level: number): Feature[] {
  return FEATURES.filter(f => f.level === level)
}

// ─── Skills (levens­categorieën met eigen level) ─────────────────────────────
// Een skill levelt op dezelfde curve als je hoofdlevel, maar op basis van de
// XP die in díe categorie is verdiend.
export const skillLevelForXp = levelForXp
export const skillProgress   = levelProgress

/** Kies een passend icoon voor een levensgebied op basis van de naam. */
export function categoryIcon(name: string): string {
  const n = name.toLowerCase()
  if (/(fit|fysiek|sport|gezond|lichaam|kracht)/.test(n)) return '💪'
  if (/(liefde|relatie|partner|romance|date)/.test(n))    return '❤️'
  if (/(kind|kids|zoë|zoe|nora|vader|ouder|gezin)/.test(n)) return '👧'
  if (/(muz|piano|artiest|nummer|song|optred)/.test(n))   return '🎵'
  if (/(geld|financ|inkomen|vermogen|zakelijk)/.test(n))  return '💰'
  if (/(thuis|huis|boerderij|woon|land|tuin)/.test(n))    return '🏡'
  if (/(vriend|sociaal|netwerk|community|bunder)/.test(n)) return '🥂'
  if (/(werk|ondernem|business|carrière|carriere)/.test(n)) return '💼'
  if (/(geest|spiritu|medita|rust|mindful|ziel)/.test(n)) return '🧘'
  if (/(leer|studie|kennis|groei|ontwikkel)/.test(n))     return '📚'
  if (/(avontuur|reis|vakantie|tour)/.test(n))            return '✈️'
  return '🌱'
}

// ─── Streak (aaneengesloten actieve dagen) ───────────────────────────────────
/** Bereken de huidige en langste reeks dagen met minimaal één XP-event. */
export function computeStreaks(isoDates: string[]): { current: number; best: number } {
  if (!isoDates.length) return { current: 0, best: 0 }
  const days = new Set(isoDates.map(d => d.slice(0, 10)))
  const sorted = [...days].sort()  // oplopend

  // Langste reeks
  let best = 1, run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00').getTime()
    const cur  = new Date(sorted[i]     + 'T12:00:00').getTime()
    const diff = Math.round((cur - prev) / 86400000)
    run = diff === 1 ? run + 1 : 1
    if (run > best) best = run
  }

  // Huidige reeks (moet vandaag of gisteren eindigen)
  const today = new Date(); today.setHours(12, 0, 0, 0)
  let current = 0
  for (let i = 0; ; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (days.has(key)) current++
    else if (i === 0) continue   // nog niets vandaag → kijk of gisteren telt
    else break
  }
  return { current, best: Math.max(best, current) }
}

// ─── XP-bronnen (voor de stats-uitsplitsing) ─────────────────────────────────
export interface XpSourceMeta { key: string; label: string; icon: string; color: string }

export const XP_SOURCE_META: Record<string, XpSourceMeta> = {
  task:        { key: 'task',        label: 'Taken',       icon: '✅', color: '#4ade80' },
  achievement: { key: 'achievement', label: 'Prestaties',  icon: '🏆', color: '#fbbf24' },
  goal:        { key: 'goal',        label: 'Doelen',      icon: '🎯', color: '#a855f7' },
  weekitem:    { key: 'weekitem',    label: 'Planning',    icon: '📅', color: '#58a6ff' },
  ai:          { key: 'ai',          label: 'AI-hulp',     icon: '🤖', color: '#818cf8' },
  tutorial:    { key: 'tutorial',    label: 'Rondleiding', icon: '🎓', color: '#f472b6' },
  manual:      { key: 'manual',      label: 'Overig',      icon: '✨', color: '#94a3b8' },
}

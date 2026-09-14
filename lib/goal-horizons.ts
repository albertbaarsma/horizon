// ─── Eén bron voor hoe een horizon heet en welke kleur hij heeft ─────────────
// Stond eerder drie keer los gedefinieerd (de Doelen-tab, de Visie-tab, de
// 3D-graaf) en liep daardoor uiteen — de Visie-tab noemde het kwartaaldoel nog
// "90-Dagen Doelen" terwijl de Doelen-tab allang "Kwartaal" zei. Voortaan hier,
// één keer.

import type { GoalHorizon } from '@/lib/types'

// 'doorlopend' staat bewust als een-na-laatste: het is geen gedateerde horizon
// (geen "over X tijd") maar een aparte, niet-tijdgebonden categorie, net als
// 'ooit' — die twee horen daarom samen aan het eind, na alle horizons die wél
// op afstand-in-tijd zijn opgebouwd (nu..10jr+).
export const HORIZON_ORDER: GoalHorizon[] = ['nu', 'wk', '6w', 'kwartaal', 'jaar', '2-4jr', '5-9jr', '10jr+', 'doorlopend', 'ooit']

export const HORIZON_META: Record<GoalHorizon, { label: string; icon: string; color: string }> = {
  nu:         { label: 'Nu',               icon: '🔥', color: '#f85149' },
  wk:         { label: 'Deze week',        icon: '📅', color: '#58a6ff' },
  '6w':       { label: '6 weken',          icon: '📆', color: '#d29922' },
  kwartaal:   { label: 'Kwartaal',         icon: '📊', color: '#bc8cff' },
  jaar:       { label: 'Dit jaar',         icon: '🗓', color: '#3fb950' },
  '2-4jr':    { label: '2-4 jaar',         icon: '🔭', color: '#6366f1' },
  '5-9jr':    { label: '5-9 jaar',         icon: '🌌', color: '#0891b2' },
  '10jr+':    { label: '10+ jaar',         icon: '🪐', color: '#ec4899' },
  /** Routines en doorlopende gewoontes zonder eindpunt — geen "nu"-urgentie,
   *  geen toekomstige horizon, gewoon altijd gaande. */
  doorlopend: { label: 'Doorlopend',       icon: '🔁', color: '#a3e635' },
  ooit:       { label: 'Ooit / misschien', icon: '💭', color: '#6b7280' },
}

/** "🗓 Dit jaar" — icoon plus label in één string, voor knoppen en kolomkoppen. */
export function horizonLabel(h: GoalHorizon): string {
  const m = HORIZON_META[h]
  return `${m.icon} ${m.label}`
}

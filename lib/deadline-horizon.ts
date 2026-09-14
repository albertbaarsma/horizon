// ─── Deadline-gedreven horizon ──────────────────────────────────────────────
// Voor taken/projecten/doelen mét een deadline bepaalt die deadline de horizon
// automatisch — hoe dichterbij, hoe korter de horizon (jaar → kwartaal → 6
// weken → nu). Zonder deadline blijft horizon volledig handmatig, zoals het
// al was. Slepen naar een andere horizon-kolom past bij een gedateerd item de
// deadline zelf aan (naar een representatieve datum in die horizon) i.p.v.
// het horizon-veld rechtstreeks te zetten — anders spreken horizon en
// deadline elkaar tegen. Slepen naar een langetermijn-kolom (2-4jr e.v., ooit,
// doorlopend) maakt het item weer los van zijn deadline.
import type { GoalHorizon } from './types'

/** Alle horizons die een deadline automatisch kan aansturen — de hele schaal
 *  op basis van dagen-tot, op 'wk' na (Jordan's eigen omschrijving springt
 *  bij een deadline direct van 6 weken naar Nu, "deze week" slaat hij over).
 *  Alleen 'doorlopend' (geen einddatum) en 'ooit' (bewust ongedateerd) doen
 *  nooit mee — die blijven altijd puur handmatig.
 *
 *  Bug gevonden 2026-09-06: dit stopte eerder bij 'jaar' ("alles voorbij een
 *  jaar blijft jaar") — een doel met een deadline over 3, 7 of 12 jaar (heel
 *  normaal voor 2-4jr/5-9jr/10jr+ doelen die al vóór deze feature een eigen
 *  deadline hadden) werd daardoor in "Dit jaar" gepropt in plaats van zijn
 *  eigen lange-termijn-kolom. */
export const DEADLINE_HORIZONS: GoalHorizon[] = ['nu', '6w', 'kwartaal', 'jaar', '2-4jr', '5-9jr', '10jr+']

function dagenTot(deadline: string, vandaag: string): number {
  const a = new Date(vandaag + 'T00:00:00Z').getTime()
  const b = new Date(deadline + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

/** Welke horizon een deadline op dit moment oplevert. Te laat telt als 'nu'. */
export function horizonFromDeadline(deadline: string, vandaag: string): GoalHorizon {
  const d = dagenTot(deadline, vandaag)
  if (d <= 7) return 'nu'
  if (d <= 42) return '6w'
  if (d <= 90) return 'kwartaal'
  if (d <= 365) return 'jaar'
  if (d <= 1460) return '2-4jr'    // ~4 jaar
  if (d <= 3285) return '5-9jr'    // ~9 jaar
  return '10jr+'
}

/** Representatieve datum voor een horizon-kolom — gebruikt als je een
 *  gedateerd item hierheen sleept. Ruim binnen de grens, met marge voordat
 *  het vanzelf weer naar de vorige horizon zou terugzakken. */
const REPRESENTATIEVE_DAGEN: Record<'nu' | '6w' | 'kwartaal' | 'jaar' | '2-4jr' | '5-9jr' | '10jr+', number> = {
  nu: 0, '6w': 28, kwartaal: 70, jaar: 182, '2-4jr': 1095, '5-9jr': 2555, '10jr+': 4380,
}

/** null = deze horizon wordt niet door een deadline aangestuurd (ooit/doorlopend). */
export function deadlineForBucket(bucket: GoalHorizon, vandaag: string): string | null {
  if (!DEADLINE_HORIZONS.includes(bucket)) return null
  const dagen = REPRESENTATIEVE_DAGEN[bucket as keyof typeof REPRESENTATIEVE_DAGEN]
  const t = new Date(vandaag + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + dagen)
  return t.toISOString().slice(0, 10)
}

/** De horizon die een item nu daadwerkelijk toont: bij een deadline wint die
 *  altijd van het handmatig opgeslagen horizon-veld. */
export function effectiveHorizon(item: { horizon?: GoalHorizon | null; deadline?: string | null }, vandaag: string): GoalHorizon | null {
  return item.deadline ? horizonFromDeadline(item.deadline, vandaag) : (item.horizon ?? null)
}

/** Wat een sleep-naar-horizon voor een item moet wegschrijven. Item zonder
 *  deadline: puur het horizon-veld, ongewijzigd gedrag. Item mét deadline: de
 *  deadline verschuift mee; sleep je het naar een langetermijn-kolom of terug
 *  naar "nog niet ingedeeld" (target null — alleen Projecten/Taken kennen die
 *  kolom), dan laat de deadline los (wordt weer een normaal handmatig item) —
 *  anders zou de deadline het net losgemaakte item meteen weer een horizon
 *  aanwijzen via effectiveHorizon(). */
type ItemMetDeadline = { horizon?: GoalHorizon | null; deadline?: string | null }
// Overloads: een niet-null target (elke horizon-kolom-drop) garandeert een
// niet-null horizon terug — alleen Projecten/Taken kennen ook een null-target
// ("nog niet ingedeeld"; Doelen kennen die kolom niet en geven altijd een
// echte horizon door).
export function resolveHorizonDrop(item: ItemMetDeadline, target: GoalHorizon, vandaag: string): { horizon: GoalHorizon; deadline?: string | null }
export function resolveHorizonDrop(item: ItemMetDeadline, target: GoalHorizon | null, vandaag: string): { horizon: GoalHorizon | null; deadline?: string | null }
export function resolveHorizonDrop(item: ItemMetDeadline, target: GoalHorizon | null, vandaag: string): { horizon: GoalHorizon | null; deadline?: string | null } {
  if (!item.deadline) return { horizon: target }
  if (target === null) return { horizon: null, deadline: null }
  return { horizon: target, deadline: deadlineForBucket(target, vandaag) }
}

/** True als de deadline is opgeschoven t.o.v. de oorspronkelijke — niet als
 *  'ie juist naar voren is gehaald (dat is geen "verschoven", dat is sneller). */
export function isDeadlinePostponed(item: { deadline?: string | null; original_deadline?: string | null }): boolean {
  return !!item.deadline && !!item.original_deadline && item.deadline > item.original_deadline
}

/** Als je voor het eerst een deadline zet (was leeg), moet original_deadline
 *  meteen meegaan — dit is de enige plek die dat vastlegt. Een latere
 *  wijziging raakt original_deadline niet meer aan, ook niet na een keer
 *  weer wissen — "de oorspronkelijke" blijft de allereerste ooit gezette. */
export function withOriginalDeadline(
  huidig: { deadline?: string | null; original_deadline?: string | null },
  nieuweDeadline: string | null
): { deadline: string | null; original_deadline?: string } {
  const patch: { deadline: string | null; original_deadline?: string } = { deadline: nieuweDeadline }
  if (nieuweDeadline && !huidig.original_deadline) patch.original_deadline = nieuweDeadline
  return patch
}

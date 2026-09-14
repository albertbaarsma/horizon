// Wegklikbare meldingen (urgent-balk, achterstallige items, niet-SMART doelen).
// Wegklikken onthoudt de huidige item-ids; de melding blijft weg tot er een
// NIEUW id opduikt dat nog niet eerder is weggeklikt.
//
// Generiek over string of number: taken/week-items hebben numerieke ids,
// projecten tekst-ids — een melding die beide soorten combineert (zoals
// "nog niet SMART") plakt er zelf een voorvoegsel voor (`g-1`, `p-tuinproject`)
// en gebruikt dan gewoon de string-vorm.

type Id = string | number

/** Toon de melding alleen als er ids zijn die nog niet zijn weggeklikt. */
export function hasUnseenIds<T extends Id>(current: T[], dismissed: T[]): boolean {
  return current.some(id => !dismissed.includes(id))
}

/** Houd alleen weggeklikte ids over die nu nog voorkomen — een item dat later
 *  opnieuw urgent wordt telt dan weer als nieuwe melding. */
export function pruneDismissed<T extends Id>(dismissed: T[], current: T[]): T[] {
  return dismissed.filter(id => current.includes(id))
}

export function loadDismissed(key: string): number[]
export function loadDismissed(key: string, kind: 'string'): string[]
export function loadDismissed(key: string, kind?: 'string'): Id[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(raw)) return []
    return kind === 'string'
      ? raw.filter((x): x is string => typeof x === 'string')
      : raw.filter((x): x is number => typeof x === 'number')
  } catch { return [] }
}

export function saveDismissed<T extends Id>(key: string, ids: T[]) {
  try { localStorage.setItem(key, JSON.stringify(ids)) } catch { /* private mode e.d. */ }
}

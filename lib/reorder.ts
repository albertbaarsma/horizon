// ─── Handmatige volgorde binnen een lijst ──────────────────────────────────
// Eén functie voor "sleep item A op de plek van item B, herindex sort_order"
// — gebruikt door Projecten (Secties én Horizon), Taken (Kanban/Lijst/
// Horizon), Doelen en Week (per dag), zodat ze allemaal precies hetzelfde
// gedrag hebben i.p.v. losse, licht-verschillende implementaties.
//
// Werkt altijd op de al-gefilterde/gegroepeerde lijst die je op het scherm
// ziet (bv. één horizon-kolom, één Kanban-kolom, één dag) — sort_order is per
// zo'n groep opnieuw 0..n-1, niet globaal over alle items van de gebruiker.

export function reorderList<T extends { id: number | string; sort_order?: number }>(
  list: T[], draggedId: number | string, targetId: number | string
): T[] {
  const fromIdx = list.findIndex(x => x.id === draggedId)
  const toIdx = list.findIndex(x => x.id === targetId)
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return list
  const copy = [...list]
  const [moved] = copy.splice(fromIdx, 1)
  copy.splice(toIdx, 0, moved)
  return copy.map((x, i) => ({ ...x, sort_order: i }))
}

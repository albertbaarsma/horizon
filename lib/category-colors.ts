// ─── Categoriekleuren — één bron voor de hele app ──────────────────────────────
// Vroeger had elke plek die een categorie een kleur gaf zijn eigen kopie van
// deze lijst (met een andere volgorde) — dezelfde categorie kon daardoor in
// Visie een andere kleur krijgen dan in Inzicht of Taken. Deze module is nu de
// enige bron: gebruik `categoryColorMap` gebouwd op de volledige, ongesorteerde
// `categories`-lijst zodat een categorie overal dezelfde kleur heeft, ongeacht
// hoe een tab lokaal sorteert of filtert.

export const CAT_COLORS = [
  '#818cf8', '#f472b6', '#34d399', '#fbbf24', '#60a5fa',
  '#a78bfa', '#f87171', '#2dd4bf', '#fb923c', '#e879f9',
]

export function categoryColor(index: number): string {
  return CAT_COLORS[index % CAT_COLORS.length]
}

/** Bouw op de volledige, ongefilterde categorielijst — niet op een lokaal gesorteerde/gefilterde subset. */
export function categoryColorMap(categories: { id: string }[]): Map<string, string> {
  return new Map(categories.map((c, i) => [c.id, categoryColor(i)]))
}

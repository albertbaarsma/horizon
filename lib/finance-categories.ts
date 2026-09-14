// ─── Vaste categorieën voor bank-transacties ───────────────────────────────────
// Eén gesloten lijst zodat AI-categorisatie (parse-statement) en de handmatige
// dropdown altijd dezelfde namen gebruiken — anders loopt de maandelijkse
// optelling per categorie uiteen door spellingsvarianten.

export const FINANCE_CATEGORIES = [
  'Inkomen',
  'Boodschappen',
  'Wonen',
  'Vaste lasten',
  'Vervoer',
  'Zorg',
  'Uitgaan & vrije tijd',
  'Sparen',
  'Overig',
] as const

export type FinanceCategory = typeof FINANCE_CATEGORIES[number]

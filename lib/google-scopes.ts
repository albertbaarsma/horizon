// ─── Google OAuth-scopes — één bron van waarheid ─────────────────────────────
// Deze scopes worden gevraagd bij het inloggen met Google (login-pagina én de
// "opnieuw verbinden"-knop in Instellingen). Vroeger stond deze lijst op twee
// plekken los ingebakken; dat liep uiteen en veroorzaakte een login-fout.
// Houd dit de enige plek. De tests bewaken dat de combinatie geldig blijft.

export const GOOGLE_OAUTH_SCOPES = [
  'email profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/youtube.readonly',
] as const

/** De scopes als één spatie-gescheiden string (formaat dat Supabase verwacht). */
export const GOOGLE_OAUTH_SCOPE_STRING = GOOGLE_OAUTH_SCOPES.join(' ')

// Scope-paren die Google NIET samen in één consent-verzoek toestaat. Als beide
// in de aanvraag zitten faalt de login met "invalid_request / scopes that cannot
// be requested together". Bekende gevallen — vul aan zodra Google er meer meldt.
export const INCOMPATIBLE_SCOPE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/youtube.readonly',
  ],
]

/** Splits scope-strings (incl. "email profile") in losse scopes. */
export function expandScopes(scopes: readonly string[]): string[] {
  return scopes.flatMap(s => s.trim().split(/\s+/)).filter(Boolean)
}

/**
 * Geeft de verboden combinaties terug die in `scopes` voorkomen.
 * Lege array = geldige combinatie.
 */
export function findScopeConflicts(scopes: readonly string[]): Array<readonly [string, string]> {
  const present = new Set(expandScopes(scopes))
  return INCOMPATIBLE_SCOPE_PAIRS.filter(([a, b]) => present.has(a) && present.has(b))
}

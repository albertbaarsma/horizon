import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  GOOGLE_OAUTH_SCOPES, GOOGLE_OAUTH_SCOPE_STRING,
  INCOMPATIBLE_SCOPE_PAIRS, findScopeConflicts, expandScopes,
} from '@/lib/google-scopes'

const DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file'
const YOUTUBE    = 'https://www.googleapis.com/auth/youtube.readonly'

describe('canonieke scope-lijst', () => {
  it('bevat geen enkele verboden combinatie', () => {
    expect(findScopeConflicts(GOOGLE_OAUTH_SCOPES)).toEqual([])
  })

  it('houdt youtube.readonly maar NIET drive.file (de bug-scope)', () => {
    const all = expandScopes(GOOGLE_OAUTH_SCOPES)
    expect(all).toContain(YOUTUBE)
    expect(all).not.toContain(DRIVE_FILE)
  })

  it('bevat de kern-scopes voor de app-features', () => {
    const all = expandScopes(GOOGLE_OAUTH_SCOPES)
    expect(all).toContain('https://www.googleapis.com/auth/calendar')
    expect(all).toContain('https://www.googleapis.com/auth/gmail.readonly')
    expect(all).toContain('email')
    expect(all).toContain('profile')
  })

  it('de string-vorm is spatie-gescheiden en zonder dubbele scopes', () => {
    const parts = GOOGLE_OAUTH_SCOPE_STRING.split(' ')
    expect(parts).toContain(YOUTUBE)
    expect(new Set(parts).size).toBe(parts.length)  // geen duplicaten
  })
})

describe('findScopeConflicts', () => {
  it('detecteert drive.file + youtube.readonly samen', () => {
    const conflicts = findScopeConflicts([...GOOGLE_OAUTH_SCOPES, DRIVE_FILE])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toEqual([DRIVE_FILE, YOUTUBE])
  })

  it('meldt niets als slechts één van het paar aanwezig is', () => {
    expect(findScopeConflicts(['email profile', DRIVE_FILE])).toEqual([])
    expect(findScopeConflicts(['email profile', YOUTUBE])).toEqual([])
  })

  it('werkt met een samengestelde "email profile"-string zonder valse treffers', () => {
    expect(findScopeConflicts(['email profile'])).toEqual([])
  })

  it('elke gedefinieerde incompatibele combinatie wordt ook echt herkend', () => {
    for (const [a, b] of INCOMPATIBLE_SCOPE_PAIRS) {
      expect(findScopeConflicts([a, b])).toContainEqual([a, b])
    }
  })
})

// Regressiebewaking op bronniveau: de scopes mogen niet opnieuw inline of
// dubbel worden gezet — dat was de oorspronkelijke oorzaak van de login-fout.
describe('sign-in componenten gebruiken de gedeelde bron', () => {
  const files = [
    join(process.cwd(), 'app', '(auth)', 'login', 'page.tsx'),
    join(process.cwd(), 'app', 'settings', 'SettingsClient.tsx'),
  ]

  for (const file of files) {
    const short = file.split(/[\\/]/).slice(-2).join('/')

    it(`${short} importeert de centrale scope-string`, () => {
      const src = readFileSync(file, 'utf-8')
      expect(src).toContain('GOOGLE_OAUTH_SCOPE_STRING')
    })

    it(`${short} zet scopes niet meer inline (geen losse scope-URLs)`, () => {
      const src = readFileSync(file, 'utf-8')
      expect(src).not.toContain('auth/drive.file')
      expect(src).not.toContain('auth/youtube.readonly')
      expect(src).not.toContain('auth/gmail.readonly')
    })
  }
})

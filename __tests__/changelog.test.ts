import { describe, it, expect } from 'vitest'
import { CHANGELOG, SOORT_META, datumNL, laatsteUpdate, aantalWijzigingen, type Release } from '@/lib/changelog'

describe('datumNL', () => {
  it('schrijft een ISO-datum uit in het Nederlands', () => {
    expect(datumNL('2026-08-13')).toBe('13 augustus 2026')
    expect(datumNL('2026-01-01')).toBe('1 januari 2026')
    expect(datumNL('2026-12-31')).toBe('31 december 2026')
  })

  it('laat onzin met rust in plaats van iets te verzinnen', () => {
    expect(datumNL('gisteren')).toBe('gisteren')
    expect(datumNL('2026-13-01')).toBe('2026-13-01')
    expect(datumNL('')).toBe('')
  })
})

describe('laatsteUpdate', () => {
  it('geeft de datum van de bovenste release', () => {
    const log: Release[] = [
      { datum: '2026-08-13', titel: 'Nieuw', wijzigingen: [] },
      { datum: '2026-08-01', titel: 'Ouder', wijzigingen: [] },
    ]
    expect(laatsteUpdate(log)).toBe('2026-08-13')
  })

  it('geeft null bij een leeg log in plaats van te struikelen', () => {
    expect(laatsteUpdate([])).toBeNull()
  })
})

describe('aantalWijzigingen', () => {
  it('telt over alle releases heen', () => {
    const log: Release[] = [
      { datum: '2026-08-13', titel: 'A', wijzigingen: [{ soort: 'nieuw', tekst: 'x' }, { soort: 'fix', tekst: 'y' }] },
      { datum: '2026-08-01', titel: 'B', wijzigingen: [{ soort: 'beter', tekst: 'z' }] },
    ]
    expect(aantalWijzigingen(log)).toBe(3)
  })

  it('is nul bij een leeg log', () => {
    expect(aantalWijzigingen([])).toBe(0)
  })
})

// Het log is handwerk — deze regels vangen een slordige nieuwe entry op
describe('het echte updatelog', () => {
  it('staat op nieuwste-eerst', () => {
    const datums = CHANGELOG.map(r => r.datum)
    expect(datums).toEqual([...datums].sort().reverse())
  })

  it('gebruikt overal een geldige ISO-datum', () => {
    for (const r of CHANGELOG) {
      expect(r.datum, r.titel).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(datumNL(r.datum), r.titel).not.toBe(r.datum)
    }
  })

  it('heeft per release een titel en minstens één wijziging', () => {
    for (const r of CHANGELOG) {
      expect(r.titel.trim().length, r.datum).toBeGreaterThan(0)
      expect(r.wijzigingen.length, r.datum).toBeGreaterThan(0)
    }
  })

  it('gebruikt alleen soorten die de pagina kan tonen', () => {
    const bekend = Object.keys(SOORT_META)
    for (const r of CHANGELOG) {
      for (const w of r.wijzigingen) {
        expect(bekend, `${r.datum}: ${w.tekst}`).toContain(w.soort)
        expect(w.tekst.trim().length).toBeGreaterThan(0)
      }
    }
  })

  // De pagina gebruikt de tekst als React-key binnen een release
  it('heeft binnen één release geen dubbele wijzigingen', () => {
    for (const r of CHANGELOG) {
      const teksten = r.wijzigingen.map(w => w.tekst)
      expect(new Set(teksten).size, r.datum).toBe(teksten.length)
    }
  })

  it('heeft geen dubbele releasedatums', () => {
    const datums = CHANGELOG.map(r => r.datum)
    expect(new Set(datums).size).toBe(datums.length)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { hasUnseenIds, pruneDismissed, loadDismissed, saveDismissed } from '@/lib/alerts'

describe('wegklikbare meldingen', () => {
  describe('hasUnseenIds', () => {
    it('toont de melding als er nog niets is weggeklikt', () => {
      expect(hasUnseenIds([1, 2], [])).toBe(true)
    })

    it('houdt de melding weg als alle ids zijn weggeklikt', () => {
      expect(hasUnseenIds([1, 2], [1, 2])).toBe(false)
    })

    it('laat de melding terugkomen zodra er een nieuw id bijkomt', () => {
      expect(hasUnseenIds([1, 2, 3], [1, 2])).toBe(true)
    })

    it('toont niets als er geen items zijn', () => {
      expect(hasUnseenIds([], [])).toBe(false)
      expect(hasUnseenIds([], [1])).toBe(false)
    })
  })

  describe('pruneDismissed', () => {
    it('verwijdert weggeklikte ids die niet meer voorkomen', () => {
      expect(pruneDismissed([1, 2, 3], [2])).toEqual([2])
    })

    it('laat alles staan als alle ids nog bestaan', () => {
      expect(pruneDismissed([1, 2], [1, 2, 3])).toEqual([1, 2])
    })

    it('een item dat niet meer urgent was en later opnieuw urgent wordt, telt weer als nieuw', () => {
      let dismissed = [7]
      // taak 7 is niet langer urgent → gesnoeid
      dismissed = pruneDismissed(dismissed, [])
      expect(dismissed).toEqual([])
      // taak 7 wordt later wéér urgent → melding komt terug
      expect(hasUnseenIds([7], dismissed)).toBe(true)
    })
  })

  describe('loadDismissed / saveDismissed', () => {
    beforeEach(() => localStorage.clear())

    it('bewaart en laadt ids via localStorage', () => {
      saveDismissed('test-weggeklikt', [4, 5])
      expect(loadDismissed('test-weggeklikt')).toEqual([4, 5])
    })

    it('geeft lege lijst bij ontbrekende key', () => {
      expect(loadDismissed('bestaat-niet')).toEqual([])
    })

    it('geeft lege lijst bij corrupte inhoud', () => {
      localStorage.setItem('kapot', '{niet json')
      expect(loadDismissed('kapot')).toEqual([])
    })

    it('filtert niet-numerieke waarden eruit', () => {
      localStorage.setItem('gemengd', JSON.stringify([1, 'x', null, 2]))
      expect(loadDismissed('gemengd')).toEqual([1, 2])
    })
  })
})

// Doel- en project-ids samen: doelen zijn getallen, projecten tekst — een
// melding die beide combineert (zoals "nog niet SMART") werkt met strings.
describe('wegklikbare meldingen — met tekst-ids (bijv. doel + project samen)', () => {
  it('werkt met strings net zo goed als met getallen', () => {
    expect(hasUnseenIds(['g-1', 'p-tuinproject'], [])).toBe(true)
    expect(hasUnseenIds(['g-1', 'p-tuinproject'], ['g-1', 'p-tuinproject'])).toBe(false)
    expect(pruneDismissed(['g-1', 'p-weg'], ['g-1'])).toEqual(['g-1'])
  })

  it('bewaart en laadt tekst-ids apart van getal-ids', () => {
    localStorage.clear()
    saveDismissed('test-tekst-weggeklikt', ['g-1', 'p-tuinproject'])
    expect(loadDismissed('test-tekst-weggeklikt', 'string')).toEqual(['g-1', 'p-tuinproject'])
  })

  it('filtert niet-tekstwaarden eruit bij de string-vorm', () => {
    localStorage.clear()
    localStorage.setItem('gemengd-tekst', JSON.stringify(['g-1', 2, null, 'p-a']))
    expect(loadDismissed('gemengd-tekst', 'string')).toEqual(['g-1', 'p-a'])
  })
})

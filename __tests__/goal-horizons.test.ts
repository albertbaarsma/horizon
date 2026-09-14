import { describe, it, expect } from 'vitest'
import { HORIZON_ORDER, HORIZON_META, horizonLabel } from '@/lib/goal-horizons'
import type { GoalHorizon } from '@/lib/types'

describe('goal-horizons — één bron voor labels', () => {
  it('kent alle tien horizonnen, van kort naar lang, met doorlopend als een-na-laatste', () => {
    // 'doorlopend' is geen gedateerde horizon (geen "over X tijd") — hoort
    // daarom achteraan, samen met 'ooit', na alle op afstand-in-tijd
    // opgebouwde horizons (nu..10jr+).
    expect(HORIZON_ORDER).toEqual(['nu', 'wk', '6w', 'kwartaal', 'jaar', '2-4jr', '5-9jr', '10jr+', 'doorlopend', 'ooit'])
  })

  it('heeft voor elke horizon een label, icoon en kleur', () => {
    for (const h of HORIZON_ORDER) {
      const m = HORIZON_META[h]
      expect(m.label.length, h).toBeGreaterThan(0)
      expect(m.icon.length, h).toBeGreaterThan(0)
      expect(m.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('gebruikt de kwartaal-naamgeving in plaats van "90 dagen"', () => {
    expect(HORIZON_META.kwartaal.label.toLowerCase()).toContain('kwartaal')
    expect(HORIZON_META.kwartaal.label.toLowerCase()).not.toContain('90')
  })

  it('heeft geen twee horizonnen met dezelfde kleur', () => {
    const kleuren = HORIZON_ORDER.map(h => HORIZON_META[h].color)
    expect(new Set(kleuren).size).toBe(kleuren.length)
  })

  it('horizonLabel zet icoon en label samen', () => {
    expect(horizonLabel('2-4jr')).toBe('🔭 2-4 jaar')
    expect(horizonLabel('kwartaal')).toBe('📊 Kwartaal')
  })

  it('is typesafe voor elke GoalHorizon', () => {
    // Compileert dit niet, dan mist er een sleutel in HORIZON_META — dat is de test.
    const alle: Record<GoalHorizon, string> = {
      nu: '', doorlopend: '', wk: '', '6w': '', kwartaal: '', jaar: '', '2-4jr': '', '5-9jr': '', '10jr+': '', ooit: '',
    }
    for (const h of Object.keys(alle) as GoalHorizon[]) expect(HORIZON_META[h]).toBeTruthy()
  })
})

import { describe, it, expect } from 'vitest'
import { haversineKm, rainValueMmPerHour, forecastEmoji, currentEmoji, BUIEN_EMOJI } from '@/lib/weather-utils'

describe('haversineKm', () => {
  it('returns 0 for same point', () => {
    expect(haversineKm(52.44, 6.75, 52.44, 6.75)).toBe(0)
  })

  it('returns ~21km between two nearby points', () => {
    // Second point is at ~52.27°N, 6.90°E
    const dist = haversineKm(52.4378, 6.7483, 52.2717, 6.8983)
    expect(dist).toBeGreaterThan(15)
    expect(dist).toBeLessThan(30)
  })

  it('is symmetric', () => {
    const ab = haversineKm(52, 6, 53, 7)
    const ba = haversineKm(53, 7, 52, 6)
    expect(Math.abs(ab - ba)).toBeLessThan(0.001)
  })

  it('returns positive distance for different points', () => {
    expect(haversineKm(0, 0, 1, 1)).toBeGreaterThan(0)
  })
})

describe('rainValueMmPerHour', () => {
  it('returns 0 for input 0', () => {
    expect(rainValueMmPerHour(0)).toBe(0)
  })

  it('returns ~1 mm/h for input 109', () => {
    expect(rainValueMmPerHour(109)).toBeCloseTo(1.0, 1)
  })

  it('returns more rain for higher values', () => {
    expect(rainValueMmPerHour(150)).toBeGreaterThan(rainValueMmPerHour(109))
  })

  it('returns less rain for lower values', () => {
    expect(rainValueMmPerHour(80)).toBeLessThan(rainValueMmPerHour(109))
  })
})

describe('BUIEN_EMOJI', () => {
  it('maps a → ☀️', () => expect(BUIEN_EMOJI['a']).toBe('☀️'))
  it('maps h → ⛈', () => expect(BUIEN_EMOJI['h']).toBe('⛈'))
  it('maps f → 🌧', () => expect(BUIEN_EMOJI['f']).toBe('🌧'))
  it('maps i → ❄️', () => expect(BUIEN_EMOJI['i']).toBe('❄️'))
})

describe('forecastEmoji', () => {
  it('returns ☀️ for iconCode "a"', () => expect(forecastEmoji('a')).toBe('☀️'))
  it('returns ⛈ for iconCode "h"', () => expect(forecastEmoji('h')).toBe('⛈'))
  it('returns ❄️ for iconCode "i"', () => expect(forecastEmoji('i')).toBe('❄️'))
  it('is case-insensitive for iconCode', () => expect(forecastEmoji('A')).toBe('☀️'))

  it('falls back to desc when iconCode empty — regen → 🌧', () => {
    expect(forecastEmoji('', 'Lichte regen')).toBe('🌧')
  })
  it('falls back to desc — onweer → ⛈', () => {
    expect(forecastEmoji('', 'Onweer verwacht')).toBe('⛈')
  })
  it('falls back to desc — helder → ☀️', () => {
    expect(forecastEmoji('', 'Helder')).toBe('☀️')
  })
  it('falls back to desc — mist → 🌫', () => {
    expect(forecastEmoji('', 'Mist')).toBe('🌫')
  })
  it('returns 🌤 for unknown iconCode and no desc', () => {
    expect(forecastEmoji('zzz')).toBe('🌤')
  })
})

describe('currentEmoji', () => {
  it('returns 🌧 when isRaining=true regardless of desc', () => {
    expect(currentEmoji('Helder', true)).toBe('🌧')
  })
  it('returns 🌧 when desc contains regen', () => {
    expect(currentEmoji('Lichte regen', false)).toBe('🌧')
  })
  it('returns ☀️ for heldere desc', () => {
    expect(currentEmoji('Helder en zonnig', false)).toBe('☀️')
  })
  it('returns ⛅ for bewolkt', () => {
    expect(currentEmoji('Bewolkt met opklaringen', false)).toBe('⛅')
  })
  it('returns ⛈ for onweer', () => {
    expect(currentEmoji('Onweer', false)).toBe('⛈')
  })
  it('returns ❄️ for sneeuw', () => {
    expect(currentEmoji('Sneeuwval', false)).toBe('❄️')
  })
  it('returns 🌫 for mist', () => {
    expect(currentEmoji('Dichte mist', false)).toBe('🌫')
  })
  it('returns 🌤 for unknown desc', () => {
    expect(currentEmoji('Wisselvallig', false)).toBe('🌤')
  })
})

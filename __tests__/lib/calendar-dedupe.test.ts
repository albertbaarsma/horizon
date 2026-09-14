import { describe, it, expect } from 'vitest'
import { normalizeEventText, isSameEvent } from '@/lib/calendar-dedupe'

describe('normalizeEventText', () => {
  it('lowercases and trims', () => {
    expect(normalizeEventText('  Pianoles Mio ')).toBe('pianoles mio')
  })

  it('strips emoji', () => {
    expect(normalizeEventText('🎹 Pianoles Mio')).toBe('pianoles mio')
    expect(normalizeEventText('🎂 Mamma JARIG!')).toBe('mamma jarig')
  })

  it('strips times', () => {
    expect(normalizeEventText('Pianoles Mio 09:30')).toBe('pianoles mio')
    expect(normalizeEventText('Jamsessie 20.15')).toBe('jamsessie')
  })

  it('strips punctuation and parentheses', () => {
    expect(normalizeEventText('Kids brengen (Lochem)')).toBe('kids brengen lochem')
    expect(normalizeEventText("mamma's birthday")).toBe('mamma s birthday')
  })

  it('keeps accented letters', () => {
    expect(normalizeEventText('Café bezoeken')).toBe('café bezoeken')
  })

  it('returns empty string for emoji-only input', () => {
    expect(normalizeEventText('🎹')).toBe('')
  })
})

describe('isSameEvent', () => {
  it('matches manual entry with emoji + time against plain gcal title', () => {
    expect(isSameEvent('🎹 Pianoles Mio 09:30', 'Pianoles Mio')).toBe(true)
  })

  it('matches when one title has extra filler words', () => {
    expect(isSameEvent('🎸 Jamsessie Zutphen 20:15', 'Jamsessie in Zutphen')).toBe(true)
  })

  it('matches parenthesized location variants', () => {
    expect(isSameEvent('👧 Kids brengen Lochem 16:00', 'Kids brengen (Lochem)')).toBe(true)
  })

  it('matches identical titles case-insensitively', () => {
    expect(isSameEvent('AFRIKA FESTIVAL', 'Afrika festival')).toBe(true)
  })

  it('does not match different events', () => {
    expect(isSameEvent('Pianoles Mio', 'Tandarts afspraak')).toBe(false)
  })

  it('does not match events sharing only some words', () => {
    expect(isSameEvent('Pianoles Mio', 'Pianoles Sara')).toBe(false)
  })

  it('does not match cross-language variants (different words)', () => {
    expect(isSameEvent("🎂 Mamma JARIG! (30 jun)", "mamma's birthday")).toBe(false)
  })

  it('never matches on empty/emoji-only titles', () => {
    expect(isSameEvent('🎹', 'Pianoles Mio')).toBe(false)
    expect(isSameEvent('', 'Pianoles Mio')).toBe(false)
  })
})

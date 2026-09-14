import { describe, it, expect } from 'vitest'
import { parseQuickAdd, describeParsed } from '@/lib/parse-quick-add'

// 2026-07-14 is een dinsdag
const TODAY = '2026-07-14'

describe('parseQuickAdd', () => {
  it('laat gewone tekst ongemoeid', () => {
    expect(parseQuickAdd('boodschappen doen', TODAY)).toEqual({ text: 'boodschappen doen', date: null, timeBlock: null })
  })

  it('parseert "morgen"', () => {
    expect(parseQuickAdd('morgen tandarts', TODAY)).toEqual({ text: 'tandarts', date: '2026-07-15', timeBlock: null })
  })

  it('parseert "vandaag"', () => {
    expect(parseQuickAdd('vandaag sporten', TODAY)).toEqual({ text: 'sporten', date: TODAY, timeBlock: null })
  })

  it('parseert "overmorgen"', () => {
    expect(parseQuickAdd('overmorgen mail sturen', TODAY)).toEqual({ text: 'mail sturen', date: '2026-07-16', timeBlock: null })
  })

  it('parseert volledige weekdag naar volgende voorkomen', () => {
    // vrijdag na di 14 jul = 17 jul
    expect(parseQuickAdd('vrijdag pianoles', TODAY)).toEqual({ text: 'pianoles', date: '2026-07-17', timeBlock: null })
  })

  it('parseert weekdag-afkorting', () => {
    expect(parseQuickAdd('vr pianoles Mio', TODAY)).toEqual({ text: 'pianoles Mio', date: '2026-07-17', timeBlock: null })
  })

  it('zelfde weekdag als vandaag springt naar volgende week', () => {
    // di terwijl vandaag dinsdag is → 21 jul
    expect(parseQuickAdd('di teamoverleg', TODAY)).toEqual({ text: 'teamoverleg', date: '2026-07-21', timeBlock: null })
  })

  it('parseert tijd HH:MM', () => {
    expect(parseQuickAdd('morgen 15:00 tandarts', TODAY)).toEqual({ text: 'tandarts', date: '2026-07-15', timeBlock: '15:00' })
  })

  it('parseert tijd met punt en enkelcijferig uur', () => {
    expect(parseQuickAdd('ma 9.30 les', TODAY)).toEqual({ text: 'les', date: '2026-07-20', timeBlock: '09:30' })
  })

  it('parseert tijd aan het einde', () => {
    expect(parseQuickAdd('vr pianoles 09:30', TODAY)).toEqual({ text: 'pianoles', date: '2026-07-17', timeBlock: '09:30' })
  })

  it('negeert ongeldige tijden', () => {
    const r = parseQuickAdd('scores 99:99 noteren', TODAY)
    expect(r.timeBlock).toBeNull()
    expect(r.text).toBe('scores 99:99 noteren')
  })

  it('parseert "morgen" NIET midden in een zin', () => {
    expect(parseQuickAdd('bel morgen Mika', TODAY)).toEqual({ text: 'bel morgen Mika', date: null, timeBlock: null })
  })

  it('parseert "wo" niet als het middenin staat', () => {
    expect(parseQuickAdd('kijk wo film', TODAY).date).toBeNull()
  })

  it('valt terug op originele invoer als alleen een datumwoord is getypt', () => {
    expect(parseQuickAdd('morgen', TODAY)).toEqual({ text: 'morgen', date: null, timeBlock: null })
  })

  it('is hoofdletterongevoelig voor datumwoorden', () => {
    expect(parseQuickAdd('Morgen tandarts', TODAY).date).toBe('2026-07-15')
    expect(parseQuickAdd('VR pianoles', TODAY).date).toBe('2026-07-17')
  })
})

describe('describeParsed', () => {
  it('geeft null zonder herkende datum/tijd', () => {
    expect(describeParsed({ text: 'x', date: null, timeBlock: null }, TODAY)).toBeNull()
  })

  it('beschrijft datum + tijd', () => {
    expect(describeParsed({ text: 'x', date: '2026-07-17', timeBlock: '15:00' }, TODAY)).toBe('→ vrijdag 17 jul om 15:00')
  })

  it('beschrijft "vandaag"', () => {
    expect(describeParsed({ text: 'x', date: TODAY, timeBlock: null }, TODAY)).toBe('→ vandaag')
  })

  it('beschrijft alleen tijd', () => {
    expect(describeParsed({ text: 'x', date: null, timeBlock: '09:30' }, TODAY)).toBe('→ om 09:30')
  })
})

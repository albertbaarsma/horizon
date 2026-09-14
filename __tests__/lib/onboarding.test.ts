import { describe, it, expect } from 'vitest'
import { parseRoutineLine, parseRoutineLines, parseGoalLines, guessType, STARTER_AREAS, SETUP_STEPS } from '@/lib/onboarding'

describe('parseRoutineLine — dagen', () => {
  it('pikt losse dagnamen op', () => {
    const r = parseRoutineLine('sportschool maandag en donderdag')!
    expect(r.days).toEqual(['monday', 'thursday'])
    expect(r.name).toBe('Sportschool')
  })

  it('begrijpt afkortingen', () => {
    expect(parseRoutineLine('was doen ma wo vr')!.days).toEqual(['monday', 'wednesday', 'friday'])
  })

  it('begrijpt "elke dag" en varianten', () => {
    expect(parseRoutineLine('mediteren elke dag')!.days).toHaveLength(7)
    expect(parseRoutineLine('dagelijks journaling')!.days).toHaveLength(7)
    expect(parseRoutineLine('iedere dag lezen')!.days).toHaveLength(7)
  })

  it('begrijpt werkdagen en weekend', () => {
    expect(parseRoutineLine('mail bijwerken werkdagen')!.days).toEqual(['monday','tuesday','wednesday','thursday','friday'])
    expect(parseRoutineLine('uitslapen weekend')!.days).toEqual(['saturday','sunday'])
  })

  it('houdt ma→zo volgorde aan, ongeacht de invoer', () => {
    expect(parseRoutineLine('klus zondag dinsdag')!.days).toEqual(['tuesday', 'sunday'])
  })

  it('laat dagen leeg als er geen genoemd zijn', () => {
    const r = parseRoutineLine('boodschappen doen')!
    expect(r.days).toEqual([])
    expect(r.name).toBe('Boodschappen doen')
  })

  it('verwart dagnamen in een woord niet met een dag', () => {
    // "mama" bevat "ma" maar is geen maandag
    expect(parseRoutineLine('mama bellen')!.days).toEqual([])
    expect(parseRoutineLine('mama bellen')!.name).toBe('Mama bellen')
  })
})

describe('parseRoutineLine — duur', () => {
  it('leest minuten', () => {
    expect(parseRoutineLine('sporten 45 min')!.duration_min).toBe(45)
    expect(parseRoutineLine('sporten 30m')!.duration_min).toBe(30)
    expect(parseRoutineLine('sporten 90 minuten')!.duration_min).toBe(90)
  })

  it('leest uren en rekent om naar minuten', () => {
    expect(parseRoutineLine('oefenen 1u')!.duration_min).toBe(60)
    expect(parseRoutineLine('oefenen 1.5 uur')!.duration_min).toBe(90)
    expect(parseRoutineLine('oefenen 1,5 uur')!.duration_min).toBe(90)
  })

  it('laat duur leeg als die niet genoemd is', () => {
    expect(parseRoutineLine('afwassen')!.duration_min).toBeNull()
  })

  it('haalt duur en dagen samen eruit en houdt een schone naam over', () => {
    const r = parseRoutineLine('sportschool maandag en donderdag 60m')!
    expect(r).toMatchObject({ name: 'Sportschool', days: ['monday','thursday'], duration_min: 60 })
  })
})

describe('parseRoutineLine — leeg en rommelig', () => {
  it('negeert lege regels', () => {
    expect(parseRoutineLine('')).toBeNull()
    expect(parseRoutineLine('   ')).toBeNull()
  })

  it('negeert een regel die alleen een dag is (geen taaknaam)', () => {
    expect(parseRoutineLine('maandag')).toBeNull()
  })
})

describe('guessType', () => {
  it('herkent sport, kids en agenda', () => {
    expect(guessType('Sportschool')).toBe('sport')
    expect(guessType('hardlopen in het bos')).toBe('sport')
    expect(guessType('Kinderen ophalen')).toBe('kids')
    expect(guessType('Overleg met Rein')).toBe('cal')
  })

  it('valt terug op een gewone taak', () => {
    expect(guessType('Was doen')).toBe('task')
  })
})

describe('parseRoutineLines', () => {
  it('verwerkt meerdere regels en slaat lege over', () => {
    const rs = parseRoutineLines('sportschool ma do 60m\n\nboodschappen zaterdag\n   \nmediteren elke dag 15m')
    expect(rs).toHaveLength(3)
    expect(rs[0].name).toBe('Sportschool')
    expect(rs[1].days).toEqual(['saturday'])
    expect(rs[2].duration_min).toBe(15)
  })
})

describe('parseGoalLines', () => {
  it('maakt van elke regel een doel', () => {
    const gs = parseGoalLines('10 optredens spelen\nEen album afmaken')
    expect(gs.map(g => g.text)).toEqual(['10 optredens spelen', 'Een album afmaken'])
    expect(gs[0].horizon).toBe('kwartaal')
  })

  it('haalt opsommingstekens weg', () => {
    const gs = parseGoalLines('- eerste doel\n• tweede doel\n* derde doel')
    expect(gs.map(g => g.text)).toEqual(['eerste doel', 'tweede doel', 'derde doel'])
  })

  it('respecteert een andere horizon', () => {
    expect(parseGoalLines('fitter worden', 'jaar')[0].horizon).toBe('jaar')
  })

  it('negeert lege regels', () => {
    expect(parseGoalLines('\n\n  \n')).toEqual([])
  })
})

describe('vaste onderdelen', () => {
  it('heeft startgebieden en stappen', () => {
    expect(STARTER_AREAS.length).toBeGreaterThanOrEqual(4)
    expect(SETUP_STEPS[0]).toBe('welkom')
    expect(SETUP_STEPS[SETUP_STEPS.length - 1]).toBe('klaar')
    expect(SETUP_STEPS).toContain('routines')
    expect(SETUP_STEPS).toContain('claude')
  })
})

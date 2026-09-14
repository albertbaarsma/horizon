import { describe, it, expect } from 'vitest'
import {
  XP_AMOUNTS, xpForLevel, levelForXp, levelProgress, levelTitle,
  computeStreaks, categoryIcon, isUnlocked, featuresUnlockedAt,
  skillLevelForXp, skillProgress, FEATURES, XP_SOURCE_META,
} from '@/lib/xp'

// Helper: bouwt een ISO-datum n dagen terug op exact dezelfde manier als
// computeStreaks intern doet (12:00 lokaal → UTC-datum), zodat de "current
// streak"-tests niet flaky worden door tijdzones.
function daysAgo(n: number): string {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

describe('xpForLevel — cumulatieve drempels', () => {
  it('level 1 begint op 0 XP', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(0)).toBe(0)   // onder 1 ook 0
  })
  it('volgt de curve 50·(L-1)·L', () => {
    expect(xpForLevel(2)).toBe(100)
    expect(xpForLevel(3)).toBe(300)
    expect(xpForLevel(4)).toBe(600)
    expect(xpForLevel(5)).toBe(1000)
    expect(xpForLevel(8)).toBe(2800)
  })
})

describe('levelForXp — XP terug naar level', () => {
  it('0 XP is level 1', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(-50)).toBe(1)
  })
  it('exacte drempels leveren het nieuwe level op', () => {
    expect(levelForXp(100)).toBe(2)
    expect(levelForXp(300)).toBe(3)
    expect(levelForXp(600)).toBe(4)
    expect(levelForXp(1000)).toBe(5)
  })
  it('net onder een drempel blijft op het vorige level', () => {
    expect(levelForXp(99)).toBe(1)
    expect(levelForXp(299)).toBe(2)
    expect(levelForXp(999)).toBe(4)
  })
  it('reproduceert Jordans live stand (2305 XP → level 7)', () => {
    expect(levelForXp(2305)).toBe(7)
  })
  it('is consistent met xpForLevel voor de eerste 30 levels', () => {
    for (let L = 1; L <= 30; L++) {
      expect(levelForXp(xpForLevel(L))).toBe(L)         // op de drempel
      expect(levelForXp(xpForLevel(L + 1) - 1)).toBe(L) // net eronder
    }
  })
})

describe('levelProgress', () => {
  it('geeft correcte voortgang binnen een level', () => {
    const p = levelProgress(150)          // level 2 (100..300)
    expect(p.level).toBe(2)
    expect(p.into).toBe(50)               // 150 - 100
    expect(p.span).toBe(200)              // 300 - 100
    expect(p.toNext).toBe(150)            // 300 - 150
    expect(p.pct).toBe(25)                // 50/200
    expect(p.total).toBe(150)
  })
  it('reproduceert "nog 495 tot Lvl 8" bij 2305 XP', () => {
    const p = levelProgress(2305)
    expect(p.level).toBe(7)
    expect(p.toNext).toBe(495)            // 2800 - 2305
  })
  it('pct blijft tussen 0 en 100', () => {
    for (const xp of [0, 1, 99, 100, 555, 2305, 99999]) {
      const p = levelProgress(xp)
      expect(p.pct).toBeGreaterThanOrEqual(0)
      expect(p.pct).toBeLessThanOrEqual(100)
    }
  })
})

describe('levelTitle', () => {
  it('geeft oplopende titels', () => {
    expect(levelTitle(1)).toBe('Starter')
    expect(levelTitle(3)).toBe('Ontdekker')
    expect(levelTitle(7)).toBe('Doener')
    expect(levelTitle(25)).toBe('Legende')
  })
})

describe('computeStreaks', () => {
  it('geeft 0 zonder events', () => {
    expect(computeStreaks([])).toEqual({ current: 0, best: 0 })
  })
  it('telt opeenvolgende dagen tot vandaag', () => {
    const { current } = computeStreaks([daysAgo(0), daysAgo(1), daysAgo(2)])
    expect(current).toBe(3)
  })
  it('breekt de huidige reeks bij een gemiste dag', () => {
    const { current } = computeStreaks([daysAgo(0), daysAgo(2)]) // gisteren gemist
    expect(current).toBe(1)
  })
  it('telt gisteren mee als vandaag nog leeg is', () => {
    const { current } = computeStreaks([daysAgo(1), daysAgo(2)])
    expect(current).toBe(2)
  })
  it('is 0 als noch vandaag noch gisteren activiteit heeft', () => {
    const { current } = computeStreaks([daysAgo(3), daysAgo(4)])
    expect(current).toBe(0)
  })
  it('negeert dubbele events op dezelfde dag', () => {
    const { current } = computeStreaks([daysAgo(0), daysAgo(0), daysAgo(1)])
    expect(current).toBe(2)
  })
  it('berekent de langste historische reeks', () => {
    // 5 opeenvolgende dagen ver in het verleden
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-09']
    expect(computeStreaks(dates).best).toBe(5)
  })
  it('best is minstens zo groot als current', () => {
    const r = computeStreaks([daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(3)])
    expect(r.best).toBeGreaterThanOrEqual(r.current)
    expect(r.current).toBe(4)
  })
  it('accepteert volledige ISO-timestamps', () => {
    const { best } = computeStreaks(['2026-03-01T08:00:00Z', '2026-03-02T20:00:00Z'])
    expect(best).toBe(2)
  })
})

describe('categoryIcon', () => {
  it('mapt levensgebieden op passende emoji', () => {
    expect(categoryIcon('Fysiek fit')).toBe('💪')
    expect(categoryIcon('Liefde')).toBe('❤️')
    expect(categoryIcon('Kinderen')).toBe('👧')
    expect(categoryIcon('Muzikant')).toBe('🎵')
    expect(categoryIcon('Thuis & Land')).toBe('🏡')
    expect(categoryIcon('Vrienden')).toBe('🥂')
  })
  it('valt terug op een neutraal icoon', () => {
    expect(categoryIcon('Iets heel anders xyz')).toBe('🌱')
  })
  it('is hoofdletterongevoelig', () => {
    expect(categoryIcon('SPORT')).toBe('💪')
  })
})

describe('isUnlocked / featuresUnlockedAt', () => {
  const goals = FEATURES.find(f => f.key === 'goals')!   // level 1
  const ai    = FEATURES.find(f => f.key === 'ai')!      // level 5

  it('ontgrendelt op basis van level', () => {
    expect(isUnlocked(goals, 1)).toBe(true)
    expect(isUnlocked(ai, 3)).toBe(false)
    expect(isUnlocked(ai, 5)).toBe(true)
  })
  it("respecteert de '*' override (Jordan heeft alles)", () => {
    expect(isUnlocked(ai, 1, ['*'])).toBe(true)
  })
  it('respecteert een expliciete feature-unlock', () => {
    expect(isUnlocked(ai, 1, ['ai'])).toBe(true)
    expect(isUnlocked(ai, 1, ['iets-anders'])).toBe(false)
  })
  it('featuresUnlockedAt geeft de features van precies dat level', () => {
    const atFive = featuresUnlockedAt(5).map(f => f.key)
    expect(atFive).toContain('ai')
    expect(atFive).toContain('visie')
    expect(featuresUnlockedAt(1).every(f => f.level === 1)).toBe(true)
  })
})

describe('skills delen de hoofd-curve', () => {
  it('skillLevelForXp is identiek aan levelForXp', () => {
    expect(skillLevelForXp(305)).toBe(levelForXp(305))
    expect(skillLevelForXp(305)).toBe(3)   // Jordans Muzikant-skill live
  })
  it('skillProgress geeft rest tot volgend skill-level', () => {
    const p = skillProgress(305)           // Muzikant: 305 XP
    expect(p.level).toBe(3)
    expect(p.toNext).toBe(295)             // 600 - 305
  })
})

describe('XP-constanten & bron-metadata', () => {
  it('urgent levert meer op dan een gewone taak', () => {
    expect(XP_AMOUNTS.taskUrgent).toBeGreaterThan(XP_AMOUNTS.task)
  })
  it('prestaties zijn de grootste standaardbron', () => {
    expect(XP_AMOUNTS.achievement).toBeGreaterThan(XP_AMOUNTS.goal)
    expect(XP_AMOUNTS.achievement).toBeGreaterThan(XP_AMOUNTS.task)
  })
  it('elke bron heeft leesbare metadata', () => {
    for (const key of ['task', 'achievement', 'goal', 'weekitem', 'ai', 'tutorial']) {
      expect(XP_SOURCE_META[key]).toBeTruthy()
      expect(XP_SOURCE_META[key].label.length).toBeGreaterThan(0)
    }
  })
})

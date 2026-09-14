import { describe, it, expect, vi } from 'vitest'
import { goalAchievementText, goalAchievementEmoji, syncGoalAchievement } from '@/lib/goal-achievement'
import type { Goal } from '@/lib/types'

// ── Supabase chain mock (zelfde patroon als __tests__/api/tool-executor.test.ts) ──

type MockChain = {
  select: ReturnType<typeof vi.fn>
  eq:     ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then:   (r: (v: unknown) => unknown, j?: (e: unknown) => unknown) => Promise<unknown>
}

function makeChain(finalValue: { data: unknown; error: null | { message: string } }): MockChain {
  const resolve = () => Promise.resolve(finalValue)
  const chain = {} as MockChain
  ;(['select', 'eq', 'update', 'insert', 'delete'] as const).forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain)
  })
  chain.single = vi.fn().mockResolvedValue(finalValue)
  chain.then = (r, j) => resolve().then(r).catch(j ?? (() => {}))
  return chain
}

const USER_ID = 'user-abc'

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 1, user_id: USER_ID, horizon: 'kwartaal', text: '10 optredens geboekt',
    done: true, cat_id: 'muzikant', deadline: null, created_at: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

// ── goalAchievementText / goalAchievementEmoji ────────────────────────────────

describe('goalAchievementText', () => {
  it('zet het horizon-label ervoor, per horizon', () => {
    expect(goalAchievementText(makeGoal({ horizon: 'nu',       text: 'X' }))).toBe('Focusdoel gehaald: X')
    expect(goalAchievementText(makeGoal({ horizon: 'wk',       text: 'X' }))).toBe('Weekdoel gehaald: X')
    expect(goalAchievementText(makeGoal({ horizon: '6w',       text: 'X' }))).toBe('Zesweken-doel gehaald: X')
    expect(goalAchievementText(makeGoal({ horizon: 'kwartaal', text: 'X' }))).toBe('Kwartaaldoel gehaald: X')
    expect(goalAchievementText(makeGoal({ horizon: 'jaar',     text: 'X' }))).toBe('Jaardoel gehaald: X')
  })

  it('is deterministisch — hetzelfde doel geeft altijd dezelfde tekst', () => {
    const goal = makeGoal()
    expect(goalAchievementText(goal)).toBe(goalAchievementText(goal))
  })
})

describe('goalAchievementEmoji', () => {
  it('geeft de horizon-emoji terug, consistent met de doelen-kolommen', () => {
    expect(goalAchievementEmoji(makeGoal({ horizon: 'nu' }))).toBe('🔥')
    expect(goalAchievementEmoji(makeGoal({ horizon: 'kwartaal' }))).toBe('📊')
    expect(goalAchievementEmoji(makeGoal({ horizon: 'jaar' }))).toBe('🗓')
  })
})

// ── syncGoalAchievement ────────────────────────────────────────────────────────

describe('syncGoalAchievement — afvinken', () => {
  it('maakt een prestatie aan met horizon-tekst, emoji, datum en cat_id van het doel', async () => {
    const insertedRow = { id: 99, user_id: USER_ID, text: 'Kwartaaldoel gehaald: 10 optredens geboekt', emoji: '📊', date: '2026-08-06', cat_id: 'muzikant' }
    const chain = makeChain({ data: insertedRow, error: null })
    const supabase = { from: vi.fn().mockReturnValue(chain) }

    const goal = makeGoal()
    const result = await syncGoalAchievement(supabase as any, USER_ID, goal, true, '2026-08-06')

    expect(supabase.from).toHaveBeenCalledWith('achievements')
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: USER_ID,
      text:    'Kwartaaldoel gehaald: 10 optredens geboekt',
      emoji:   '📊',
      date:    '2026-08-06',
      cat_id:  'muzikant',
    }))
    expect(result).toEqual(insertedRow)
  })

  it('geeft null terug als de insert niets oplevert', async () => {
    const chain = makeChain({ data: null, error: null })
    const supabase = { from: vi.fn().mockReturnValue(chain) }
    const result = await syncGoalAchievement(supabase as any, USER_ID, makeGoal(), true, '2026-08-06')
    expect(result).toBeNull()
  })
})

describe('syncGoalAchievement — ongedaan maken', () => {
  it('verwijdert de gekoppelde prestatie én de bijbehorende XP-events', async () => {
    const achievementsChain = makeChain({ data: [{ id: 42 }], error: null })
    const xpChain = makeChain({ data: null, error: null })
    const supabase = { from: vi.fn().mockReturnValueOnce(achievementsChain).mockReturnValueOnce(xpChain) }

    const goal = makeGoal()
    const result = await syncGoalAchievement(supabase as any, USER_ID, goal, false, '2026-08-06')

    // 1) prestatie verwijderd op exacte tekstmatch (zelfde tekst als bij afvinken)
    expect(achievementsChain.delete).toHaveBeenCalled()
    expect(achievementsChain.eq).toHaveBeenCalledWith('user_id', USER_ID)
    expect(achievementsChain.eq).toHaveBeenCalledWith('text', goalAchievementText(goal))

    // 2) bijbehorende xp_events verwijderd via source='achievement' + ref_id=prestatie-id
    expect(xpChain.delete).toHaveBeenCalled()
    expect(xpChain.eq).toHaveBeenCalledWith('source', 'achievement')
    expect(xpChain.eq).toHaveBeenCalledWith('ref_id', '42')

    expect(result).toBeNull()
  })

  it('verwijdert geen XP als er geen gekoppelde prestatie (meer) bestaat', async () => {
    const achievementsChain = makeChain({ data: [], error: null })
    const supabase = { from: vi.fn().mockReturnValue(achievementsChain) }

    await syncGoalAchievement(supabase as any, USER_ID, makeGoal(), false, '2026-08-06')

    // alleen de achievements-tabel aangeroepen, nooit xp_events
    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(supabase.from).toHaveBeenCalledWith('achievements')
  })

  it('verwijdert XP voor elke gekoppelde prestatie als er meerdere matchen', async () => {
    const achievementsChain = makeChain({ data: [{ id: 1 }, { id: 2 }], error: null })
    const xpChain1 = makeChain({ data: null, error: null })
    const xpChain2 = makeChain({ data: null, error: null })
    const supabase = { from: vi.fn().mockReturnValueOnce(achievementsChain).mockReturnValueOnce(xpChain1).mockReturnValueOnce(xpChain2) }

    await syncGoalAchievement(supabase as any, USER_ID, makeGoal(), false, '2026-08-06')

    expect(xpChain1.eq).toHaveBeenCalledWith('ref_id', '1')
    expect(xpChain2.eq).toHaveBeenCalledWith('ref_id', '2')
  })
})

describe('hobbydoelen', () => {
  it('zegt "gedaan" in plaats van "gehaald", zonder horizon ervoor', () => {
    const hobby = makeGoal({ kind: 'hobby', text: 'Chop Chop spelen' })
    expect(goalAchievementText(hobby)).toBe('Hobbydoel gedaan: Chop Chop spelen')
    expect(goalAchievementText(makeGoal({ text: 'Chop Chop spelen' }))).toBe('Kwartaaldoel gehaald: Chop Chop spelen')
  })

  it('krijgt de hobby-emoji, ongeacht de horizon', () => {
    expect(goalAchievementEmoji(makeGoal({ kind: 'hobby' }))).toBe('🎲')
    expect(goalAchievementEmoji(makeGoal({ kind: 'hobby', horizon: 'jaar' }))).toBe('🎲')
    expect(goalAchievementEmoji(makeGoal({ horizon: 'jaar' }))).not.toBe('🎲')
  })

  it('blijft deterministisch, zodat afvinken ongedaan maken de prestatie terugvindt', () => {
    const hobby = makeGoal({ kind: 'hobby', text: 'Hearthstone-collectie uitbreiden' })
    expect(goalAchievementText(hobby)).toBe(goalAchievementText({ ...hobby }))
  })
})

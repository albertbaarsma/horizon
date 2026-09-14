import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createToolExecutor } from '@/lib/tool-executor'

// ── Mock external services so tests stay offline ──────────────────────────────

vi.mock('@/lib/google-api', () => ({
  getGoogleToken:     vi.fn().mockResolvedValue(null),
  fetchGmailMessages: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/weather-fetcher', () => ({
  fetchWeatherData: vi.fn().mockResolvedValue({
    station: 'Almelo', distance: 12,
    current: { temperature: 18, description: 'Bewolkt', windDirection: 'ZW', windSpeed: 3 },
    rainForecast: [],
    forecast: [],
  }),
}))

vi.mock('fs/promises', () => ({
  default: {
    stat:    vi.fn().mockResolvedValue({ size: 100 }),
    readFile: vi.fn().mockResolvedValue('file content'),
    readdir: vi.fn().mockResolvedValue([]),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
}))

// ── Supabase chain mock ───────────────────────────────────────────────────────

type MockChain = {
  select:  ReturnType<typeof vi.fn>
  eq:      ReturnType<typeof vi.fn>
  neq:     ReturnType<typeof vi.fn>
  gte:     ReturnType<typeof vi.fn>
  lte:     ReturnType<typeof vi.fn>
  order:   ReturnType<typeof vi.fn>
  limit:   ReturnType<typeof vi.fn>
  update:  ReturnType<typeof vi.fn>
  insert:  ReturnType<typeof vi.fn>
  upsert:  ReturnType<typeof vi.fn>
  delete:  ReturnType<typeof vi.fn>
  single:  ReturnType<typeof vi.fn>
  then:    (r: (v: unknown) => unknown, j?: (e: unknown) => unknown) => Promise<unknown>
}

function makeChain(finalValue: { data: unknown; error: null | { message: string } }): MockChain {
  const resolve = () => Promise.resolve(finalValue)
  const chain = {} as MockChain
  ;(['select','eq','neq','gte','lte','order','limit','update','insert','upsert','delete'] as const).forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain)
  })
  chain.single = vi.fn().mockResolvedValue(finalValue)
  chain.then = (r, j) => resolve().then(r).catch(j ?? (() => {}))
  return chain
}

// ── Test helpers ──────────────────────────────────────────────────────────────

const USER_ID = 'user-abc'

function setup(chains: MockChain[]) {
  let idx = 0
  const supabase = { from: vi.fn().mockImplementation(() => chains[idx++] ?? makeChain({ data: null, error: null })) }
  const mutatedTabs: string[] = []
  const exec = createToolExecutor({ supabase, userId: USER_ID, projects: null, mutatedTabs })
  return { supabase, mutatedTabs, exec }
}

// ── Week items ────────────────────────────────────────────────────────────────

describe('tool-executor: week items', () => {
  it('add_week_item inserts and returns confirmation', async () => {
    const { exec, mutatedTabs } = setup([
      makeChain({ data: { id: 55, text: 'Tandarts 10:00', date: '2026-07-12', type: 'task' }, error: null }),
    ])
    const result = await exec('add_week_item', { date: '2026-07-12', text: 'Tandarts 10:00', type: 'task' })
    expect(result).toContain('Gepland')
    expect(result).toContain('Tandarts 10:00')
    expect(result).toContain('2026-07-12')
    expect(mutatedTabs).toContain('week')
  })

  it('add_week_item propagates DB error', async () => {
    const { exec } = setup([
      makeChain({ data: null, error: { message: 'violates not-null constraint' } }),
    ])
    const result = await exec('add_week_item', { date: '2026-07-12', text: 'Test' })
    expect(result).toContain('Fout bij aanmaken')
    expect(result).toContain('violates not-null constraint')
  })

  it('update_week_item updates text and marks week as mutated', async () => {
    const { exec, mutatedTabs } = setup([
      makeChain({ data: { text: 'Kinderen brengen 13:00', date: '2026-07-12', done: false }, error: null }),
    ])
    const result = await exec('update_week_item', { item_id: 42, text: 'Kinderen brengen 13:00' })
    expect(result).toContain('bijgewerkt')
    expect(result).toContain('Kinderen brengen 13:00')
    expect(result).toContain('2026-07-12')
    expect(mutatedTabs).toContain('week')
  })

  it('update_week_item: no fields → returns early error', async () => {
    const { exec, mutatedTabs } = setup([])
    const result = await exec('update_week_item', { item_id: 42 })
    expect(result).toContain('Fout')
    expect(mutatedTabs).not.toContain('week')
  })

  it('update_week_item propagates DB error without mutating tabs', async () => {
    const { exec, mutatedTabs } = setup([
      makeChain({ data: null, error: { message: 'Row not found' } }),
    ])
    const result = await exec('update_week_item', { item_id: 99, text: 'Test' })
    expect(result).toContain('Fout bij bijwerken')
    expect(mutatedTabs).not.toContain('week')
  })

  it('delete_week_item removes and confirms', async () => {
    const { exec, mutatedTabs } = setup([
      makeChain({ data: { text: 'Kinderen brengen 10:00' }, error: null }),
    ])
    const result = await exec('delete_week_item', { item_id: 42 })
    expect(result).toContain('verwijderd')
    expect(result).toContain('Kinderen brengen 10:00')
    expect(mutatedTabs).toContain('week')
  })

  it('get_week_items returns items with [ID] format so AI can reference them', async () => {
    const { exec } = setup([
      makeChain({
        data: [
          { id: 42, date: '2026-07-12', text: 'Kinderen brengen 10:00', type: 'task', done: false, proj_id: null },
          { id: 43, date: '2026-07-12', text: 'Vergadering Mika', type: 'meeting', done: false, proj_id: 'klussen' },
        ],
        error: null,
      }),
    ])
    const result = await exec('get_week_items', { from: '2026-07-12', to: '2026-07-19' })
    // Must contain item IDs in [id] format — AI needs these to call update_week_item
    expect(result).toContain('[42]')
    expect(result).toContain('[43]')
    expect(result).toContain('Kinderen brengen 10:00')
    expect(result).toContain('Vergadering Mika')
  })

  it('get_week_items returns empty message when no items', async () => {
    const { exec } = setup([
      makeChain({ data: [], error: null }),
    ])
    const result = await exec('get_week_items', { from: '2026-07-12', to: '2026-07-19' })
    expect(result).toContain('Geen items gepland')
  })
})

// ── Tasks ─────────────────────────────────────────────────────────────────────

describe('tool-executor: tasks', () => {
  it('add_task inserts and returns ID', async () => {
    const { exec, mutatedTabs } = setup([
      makeChain({ data: { id: 101, name: 'Website updaten', proj_id: 'acme-co' }, error: null }),
    ])
    const result = await exec('add_task', { name: 'Website updaten', proj_id: 'acme-co', status: 'backlog' })
    expect(result).toContain('Website updaten')
    expect(result).toContain('101')
    expect(mutatedTabs).toContain('tasks')
  })

  it('update_task updates status', async () => {
    const { exec, mutatedTabs } = setup([
      makeChain({ data: { name: 'Mika bellen', status: 'done' }, error: null }),
    ])
    const result = await exec('update_task', { task_id: 23, status: 'done' })
    expect(result).toContain('Mika bellen')
    expect(result).toContain('done')
    expect(mutatedTabs).toContain('tasks')
  })

  it('delete_task removes and confirms', async () => {
    const { exec, mutatedTabs } = setup([
      makeChain({ data: { name: 'Oude taak' }, error: null }),
    ])
    const result = await exec('delete_task', { task_id: 77 })
    expect(result).toContain('verwijderd')
    expect(result).toContain('Oude taak')
    expect(mutatedTabs).toContain('tasks')
  })

  it('get_tasks returns [ID] format', async () => {
    const { exec } = setup([
      makeChain({
        data: [
          { id: 23, proj_id: 'klussen', name: 'Mika bellen', status: 'doing', urgent: true },
        ],
        error: null,
      }),
    ])
    const result = await exec('get_tasks', {})
    expect(result).toContain('[23]')
    expect(result).toContain('Mika bellen')
    expect(result).toContain('urgent')
  })
})

// ── Recurring tasks ───────────────────────────────────────────────────────────

describe('tool-executor: recurring tasks', () => {
  it('add_recurring_task requires at least one day', async () => {
    const { exec, mutatedTabs } = setup([])
    const result = await exec('add_recurring_task', { name: 'Test', days: [] })
    expect(result).toContain('Fout')
    expect(mutatedTabs).not.toContain('week')
  })

  it('add_recurring_task translates day names to Dutch in confirmation', async () => {
    const { exec, mutatedTabs } = setup([
      makeChain({ data: { id: 5, name: 'Kinderen brengen', days: ['friday'], type: 'task' }, error: null }),
    ])
    const result = await exec('add_recurring_task', { name: 'Kinderen brengen', days: ['friday'] })
    expect(result).toContain('vrijdag')
    expect(result).toContain('Kinderen brengen')
    expect(mutatedTabs).toContain('week')
  })
})

// ── Achievements ──────────────────────────────────────────────────────────────

describe('tool-executor: achievements', () => {
  it('add_achievement saves and marks achievements as mutated', async () => {
    const { exec, mutatedTabs } = setup([
      makeChain({ data: { id: 9, text: 'Eerste optreden gespeeld', emoji: '🎸', date: '2026-07-11' }, error: null }),
    ])
    const result = await exec('add_achievement', { text: 'Eerste optreden gespeeld', emoji: '🎸' })
    expect(result).toContain('Eerste optreden gespeeld')
    expect(mutatedTabs).toContain('achievements')
  })
})

// ── Mood tracker ──────────────────────────────────────────────────────────────

describe('tool-executor: log_mood', () => {
  it('slaat een stemming binnen -10..+10 op zoals opgegeven', async () => {
    const { exec, mutatedTabs } = setup([
      makeChain({ data: { date: '2026-08-21', mood: -8, energy: null, sleep_hours: null }, error: null }),
    ])
    const result = await exec('log_mood', { mood: -8 })
    expect(result).toContain('-8')
    expect(mutatedTabs).toContain('dagboek')
  })

  it('begrenst een mood buiten -10..+10 tot de rand van de schaal', async () => {
    const chain = makeChain({ data: { date: '2026-08-21', mood: 10, energy: null, sleep_hours: null }, error: null })
    const { exec } = setup([chain])
    await exec('log_mood', { mood: 25 })
    const upsertCall = chain.upsert.mock.calls[0][0]
    expect(upsertCall.mood).toBe(10)
  })
})

// ── Boodschappenlijstje ──────────────────────────────────────────────────────

describe('tool-executor: boodschappenlijstje', () => {
  it('add_shopping_item zet een item op de lijst', async () => {
    const { exec, mutatedTabs } = setup([makeChain({ data: null, error: null })])
    const result = await exec('add_shopping_item', { text: 'Plakband houder' })
    expect(result).toContain('Plakband houder')
    expect(mutatedTabs).toContain('boodschappen')
  })

  it('get_shopping_list splitst open en gehaalde items', async () => {
    const { exec } = setup([
      makeChain({ data: [{ text: 'Melk', done: false }, { text: 'Kaas', done: true }], error: null }),
    ])
    const result = await exec('get_shopping_list', {})
    expect(result).toContain('Melk')
    expect(result).toContain('Kaas')
  })

  it('get_shopping_list meldt een lege lijst', async () => {
    const { exec } = setup([makeChain({ data: [], error: null })])
    const result = await exec('get_shopping_list', {})
    expect(result).toMatch(/leeg/i)
  })
})

// ── Financiën ────────────────────────────────────────────────────────────────

describe('tool-executor: financiën', () => {
  it('add_money_entry slaat een positief bedrag op bij owed_to_me', async () => {
    const chain = makeChain({ data: null, error: null })
    const { exec, mutatedTabs } = setup([chain])
    const result = await exec('add_money_entry', { person: 'Broer', amount: 125, direction: 'owed_to_me', description: 'Video edit' })
    expect(result).toContain('Broer')
    expect(mutatedTabs).toContain('financien')
    expect(chain.insert.mock.calls[0][0]).toMatchObject({ person: 'Broer', amount: 125 })
  })

  it('add_money_entry slaat een negatief bedrag op bij i_owe', async () => {
    const chain = makeChain({ data: null, error: null })
    const { exec } = setup([chain])
    await exec('add_money_entry', { person: 'Buurman', amount: 20, direction: 'i_owe' })
    expect(chain.insert.mock.calls[0][0]).toMatchObject({ person: 'Buurman', amount: -20 })
  })

  it('add_money_entry weigert een ongeldig bedrag', async () => {
    const { exec } = setup([])
    const result = await exec('add_money_entry', { person: 'Broer', amount: 0, direction: 'owed_to_me' })
    expect(result).toMatch(/fout/i)
  })

  it('get_money_overview toont de nettostand per persoon', async () => {
    const { exec } = setup([
      makeChain({ data: [{ person: 'Broer', amount: 125, settled: false }, { person: 'Broer', amount: -25, settled: false }], error: null }),
    ])
    const result = await exec('get_money_overview', {})
    expect(result).toContain('Broer')
    expect(result).toContain('100.00')
  })

  it('get_money_overview meldt niets bijgehouden', async () => {
    const { exec } = setup([makeChain({ data: [], error: null })])
    const result = await exec('get_money_overview', {})
    expect(result).toMatch(/niets bijgehouden/i)
  })
})

// ── Zakgeld ───────────────────────────────────────────────────────────────────

describe('tool-executor: zakgeld', () => {
  it('add_allowance_entry slaat een positief bedrag op', async () => {
    const chain = makeChain({ data: null, error: null })
    const { exec, mutatedTabs } = setup([chain])
    const result = await exec('add_allowance_entry', { child: 'Robin', amount: 1, description: 'weekgeld' })
    expect(result).toContain('Robin')
    expect(mutatedTabs).toContain('zakgeld')
    expect(chain.insert.mock.calls[0][0]).toMatchObject({ child: 'Robin', amount: 1, description: 'weekgeld' })
  })

  it('add_allowance_entry slaat een negatief bedrag op (uitgegeven)', async () => {
    const chain = makeChain({ data: null, error: null })
    const { exec } = setup([chain])
    await exec('add_allowance_entry', { child: 'Sam', amount: -2.5, description: 'ijsje' })
    expect(chain.insert.mock.calls[0][0]).toMatchObject({ child: 'Sam', amount: -2.5 })
  })

  it('add_allowance_entry weigert zonder kind of bedrag', async () => {
    const { exec } = setup([])
    expect(await exec('add_allowance_entry', { child: '', amount: 1 })).toMatch(/fout/i)
    expect(await exec('add_allowance_entry', { child: 'Robin', amount: 0 })).toMatch(/fout/i)
  })

  it('delete_allowance_entry verwijdert een entry', async () => {
    const chain = makeChain({ data: null, error: null })
    const { exec, mutatedTabs } = setup([chain])
    const result = await exec('delete_allowance_entry', { id: 5 })
    expect(result).toMatch(/^✓/)
    expect(mutatedTabs).toContain('zakgeld')
    expect(chain.delete).toHaveBeenCalled()
  })

  it('get_allowance_overview toont het saldo per kind en spaardoelen', async () => {
    const { exec } = setup([
      makeChain({ data: [{ child: 'Robin', amount: 1 }, { child: 'Robin', amount: -0.5 }, { child: 'Sam', amount: 2 }], error: null }),
      makeChain({ data: [{ id: 9, child: 'Robin', title: 'LEGO-set', target_amount: 30, achieved: false }], error: null }),
    ])
    const result = await exec('get_allowance_overview', {})
    expect(result).toContain('Robin: saldo €0.50')
    expect(result).toContain('Sam: saldo €2.00')
    expect(result).toContain('LEGO-set')
    expect(result).toContain('[9]')
  })

  it('get_allowance_overview meldt niets bijgehouden', async () => {
    const { exec } = setup([makeChain({ data: [], error: null }), makeChain({ data: [], error: null })])
    const result = await exec('get_allowance_overview', {})
    expect(result).toMatch(/nog geen zakgeld/i)
  })

  it('add_allowance_goal voegt een spaardoel toe', async () => {
    const chain = makeChain({ data: null, error: null })
    const { exec, mutatedTabs } = setup([chain])
    const result = await exec('add_allowance_goal', { child: 'Sam', title: 'Nieuwe fiets', target_amount: 150 })
    expect(result).toContain('Sam')
    expect(mutatedTabs).toContain('zakgeld')
    expect(chain.insert.mock.calls[0][0]).toMatchObject({ child: 'Sam', title: 'Nieuwe fiets', target_amount: 150 })
  })

  it('update_allowance_goal markeert een doel als gehaald', async () => {
    const chain = makeChain({ data: null, error: null })
    const { exec, mutatedTabs } = setup([chain])
    const result = await exec('update_allowance_goal', { id: 9, achieved: true })
    expect(result).toMatch(/^✓/)
    expect(mutatedTabs).toContain('zakgeld')
    expect(chain.update).toHaveBeenCalledWith({ achieved: true })
  })

  it('update_allowance_goal weigert zonder velden om te wijzigen', async () => {
    const { exec } = setup([])
    const result = await exec('update_allowance_goal', { id: 9 })
    expect(result).toMatch(/fout/i)
  })

  it('delete_allowance_goal verwijdert een spaardoel', async () => {
    const chain = makeChain({ data: null, error: null })
    const { exec, mutatedTabs } = setup([chain])
    const result = await exec('delete_allowance_goal', { id: 9 })
    expect(result).toMatch(/^✓/)
    expect(mutatedTabs).toContain('zakgeld')
    expect(chain.delete).toHaveBeenCalled()
  })
})

// ── Unknown tool ──────────────────────────────────────────────────────────────

describe('tool-executor: fallback', () => {
  it('returns "Onbekende tool" for unrecognized name', async () => {
    const { exec } = setup([])
    const result = await exec('nonexistent_tool', {})
    expect(result).toBe('Onbekende tool')
  })
})

// ── AI-mutaties registreren in de XP-log ──────────────────────────────────────

describe('tool-executor: AI-XP registratie', () => {
  it('logt een xp_events-regel (source ai, amount 2) bij een geslaagde mutatie', async () => {
    const taskChain = makeChain({ data: { id: 1, name: 'Nieuwe taak', proj_id: null }, error: null })
    const xpChain   = makeChain({ data: null, error: null })
    const { supabase, exec } = setup([taskChain, xpChain])

    const res = await exec('add_task', { name: 'Nieuwe taak' })
    expect(res).toMatch(/^✓/)
    expect(supabase.from).toHaveBeenCalledWith('xp_events')
    expect(xpChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: USER_ID, source: 'ai', amount: 2,
    }))
    // reden bevat een 🤖-prefix en een samenvatting van de mutatie
    const payload = xpChain.insert.mock.calls[0][0] as { reason: string }
    expect(payload.reason).toContain('🤖')
    expect(payload.reason).toContain('Nieuwe taak')
  })

  it('logt NIETS bij een lees-tool', async () => {
    const chain = makeChain({ data: [{ id: 1, proj_id: 'p', name: 'T', status: 'doing', urgent: false }], error: null })
    const { supabase, exec } = setup([chain])
    await exec('get_tasks', {})
    expect(supabase.from).not.toHaveBeenCalledWith('xp_events')
  })

  it('logt NIETS als de mutatie mislukt', async () => {
    const chain = makeChain({ data: null, error: { message: 'boom' } })
    const { supabase, exec } = setup([chain])
    const res = await exec('add_task', { name: 'X' })
    expect(res).toMatch(/^Fout/)
    expect(supabase.from).not.toHaveBeenCalledWith('xp_events')
  })

  it('laat de tool gewoon slagen als de xp_events-insert faalt (migratie nog niet gedraaid)', async () => {
    const taskChain = makeChain({ data: { id: 2, name: 'Taak', proj_id: null }, error: null })
    const xpChain   = makeChain({ data: null, error: { message: 'relation "xp_events" does not exist' } })
    const { exec } = setup([taskChain, xpChain])
    const res = await exec('add_task', { name: 'Taak' })
    expect(res).toMatch(/^✓/)  // mutatie zelf blijft geslaagd, ondanks xp-fout
  })
})

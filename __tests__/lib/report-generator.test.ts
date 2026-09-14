import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { periodRange, generateLifeReport } from '@/lib/report-generator'

describe('periodRange', () => {
  it('week = de 7 dagen tot en met vandaag', () => {
    const { start, end } = periodRange('week', new Date('2026-08-27T12:00:00Z'))
    expect(end).toBe('2026-08-27')
    expect(start).toBe('2026-08-21')
  })

  it('month = de vorige volledige kalendermaand', () => {
    const { start, end } = periodRange('month', new Date('2026-09-01T12:00:00Z'))
    expect(start).toBe('2026-08-01')
    expect(end).toBe('2026-08-31')
  })

  it('month werkt ook midden in de maand (blijft de vórige maand, niet "tot nu")', () => {
    const { start, end } = periodRange('month', new Date('2026-08-15T12:00:00Z'))
    expect(start).toBe('2026-07-01')
    expect(end).toBe('2026-07-31')
  })

  it('month over een jaarwisseling', () => {
    const { start, end } = periodRange('month', new Date('2026-01-05T12:00:00Z'))
    expect(start).toBe('2025-12-01')
    expect(end).toBe('2025-12-31')
  })
})

// ── generateLifeReport ──────────────────────────────────────────────────────

function makeChain(data: unknown) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  for (const m of ['select', 'eq', 'gte', 'lte', 'lt', 'order', 'is']) chain[m] = vi.fn(self)
  chain.single = vi.fn().mockResolvedValue({ data, error: null })
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve)
  return chain
}

function makeSupabase(tableData: Record<string, unknown>, insertOverride?: { data: unknown; error: unknown }) {
  const insertMock = vi.fn().mockImplementation((payload: object) => ({
    select: () => ({ single: () => Promise.resolve(insertOverride ?? { data: { id: 1, ...payload }, error: null }) }),
  }))
  return {
    from: (table: string) => {
      if (table === 'life_reports') return { insert: insertMock }
      return makeChain(tableData[table] ?? [])
    },
    _insertMock: insertMock,
  }
}

describe('generateLifeReport', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('verzamelt data, schrijft naar Anthropic en slaat het rapport op', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: 'Dit is je weekrapport, Jordan.' }] }),
    })
    const supabase = makeSupabase({
      mood_entries: [{ date: '2026-08-25', mood: 3, energy: 4, sleep_hours: 7.5, note: 'goede dag' }],
      diary_entries: [],
      achievements: [{ date: '2026-08-24', text: 'Weekdoel gehaald: 3 nieuwe leerlingen', emoji: '📅' }],
      tasks: [{ name: 'Factuur sturen', proj_id: 'p1' }],
      goals: [{ horizon: 'nu', text: 'Rijbewijs halen', deadline: '2026-09-01', cat_id: 'c1' }],
      categories: [{ id: 'c1', name: 'Mobiliteit' }],
      projects: [{ id: 'p1', name: 'Administratie', cat_id: 'c1' }],
    })

    const result = await generateLifeReport(supabase, 'u1', 'week', 'test-key')
    expect('report' in result).toBe(true)
    if (!('report' in result)) throw new Error('expected report')
    expect(result.report.content).toBe('Dit is je weekrapport, Jordan.')

    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('api.anthropic.com')
    const body = JSON.parse(options.body as string)
    expect(body.model).toBe('claude-sonnet-5')
    expect(body.messages[0].content).toContain('Rijbewijs halen')
    expect(body.messages[0].content).toContain('Weekdoel gehaald')
    expect(body.messages[0].content).toContain('Administratie')
    expect(body.system).toContain('Tony Robbins')

    expect(supabase._insertMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', kind: 'week', content: 'Dit is je weekrapport, Jordan.',
    }))
  })

  it('meldt eerlijk als er geen data is voor een periode, i.p.v. te verzinnen', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: () => Promise.resolve({ content: [{ type: 'text', text: 'Rustige week.' }] }),
    })
    const supabase = makeSupabase({
      mood_entries: [], diary_entries: [], achievements: [], tasks: [], goals: [], categories: [], projects: [],
    })
    await generateLifeReport(supabase, 'u1', 'week', 'test-key')
    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.messages[0].content).toContain('Geen mood-metingen deze periode.')
    expect(body.messages[0].content).toContain('Geen actieve doelen.')
  })

  it('vindt het tekstblok ook als er eerst een thinking-blok staat (adaptive thinking, Sonnet 5)', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [
        { type: 'thinking', thinking: 'laat me de data even doornemen...' },
        { type: 'text', text: 'Het echte rapport staat hier.' },
      ] }),
    })
    const supabase = makeSupabase({ mood_entries: [], diary_entries: [], achievements: [], tasks: [], goals: [], categories: [], projects: [] })
    const result = await generateLifeReport(supabase, 'u1', 'week', 'test-key')
    expect('report' in result).toBe(true)
    if ('report' in result) expect(result.report.content).toBe('Het echte rapport staat hier.')
  })

  it('geeft een fout terug als de Anthropic-call faalt', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, text: () => Promise.resolve('boom') })
    const supabase = makeSupabase({ mood_entries: [], diary_entries: [], achievements: [], tasks: [], goals: [], categories: [], projects: [] })
    const result = await generateLifeReport(supabase, 'u1', 'week', 'test-key')
    expect('error' in result).toBe(true)
  })

  it('geeft een fout terug als opslaan mislukt', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: () => Promise.resolve({ content: [{ type: 'text', text: 'Tekst.' }] }),
    })
    const supabase = makeSupabase(
      { mood_entries: [], diary_entries: [], achievements: [], tasks: [], goals: [], categories: [], projects: [] },
      { data: null, error: { message: 'db weg' } },
    )
    const result = await generateLifeReport(supabase, 'u1', 'week', 'test-key')
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toContain('db weg')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGenerate = vi.fn()
const mockProfilesSelect = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    from: (table: string) => {
      if (table === 'profiles') return { select: () => mockProfilesSelect() }
      throw new Error(`unexpected table ${table}`)
    },
  })),
}))
vi.mock('@/lib/report-generator', () => ({ generateLifeReport: mockGenerate }))

const { GET } = await import('@/app/api/reports/cron/route')

function makeReq(kind: string | null, secret: string | null) {
  const url = new URL(`http://localhost/api/reports/cron${kind ? `?kind=${kind}` : ''}`)
  return {
    headers: { get: (name: string) => name === 'authorization' && secret ? `Bearer ${secret}` : null },
    nextUrl: url,
  } as unknown as Parameters<typeof GET>[0]
}

describe('GET /api/reports/cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'sekrit')
    vi.stubEnv('ANTHROPIC_API_KEY', 'fallback-key')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('returns 401 without the correct bearer secret', async () => {
    const res = await GET(makeReq('week', 'wrong'))
    expect(res.status).toBe(401)
  })

  it('returns 401 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const res = await GET(makeReq('week', 'anything'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for a missing/invalid kind', async () => {
    const res = await GET(makeReq('year', 'sekrit'))
    expect(res.status).toBe(400)
  })

  it('generates a report per profile, using each profile\'s own key when set', async () => {
    mockProfilesSelect.mockResolvedValue({ data: [{ id: 'u1', ai_api_key: 'own-key' }, { id: 'u2', ai_api_key: null }] })
    mockGenerate.mockResolvedValue({ report: { id: 1 } })
    const res = await GET(makeReq('week', 'sekrit'))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.results).toEqual({ u1: 'ok', u2: 'ok' })
    expect(mockGenerate).toHaveBeenCalledWith(expect.anything(), 'u1', 'week', 'own-key')
    expect(mockGenerate).toHaveBeenCalledWith(expect.anything(), 'u2', 'week', 'fallback-key')
  })

  it('records a per-user error without failing the whole run', async () => {
    mockProfilesSelect.mockResolvedValue({ data: [{ id: 'u1', ai_api_key: null }] })
    mockGenerate.mockResolvedValue({ error: 'AI-fout' })
    const res = await GET(makeReq('month', 'sekrit'))
    const j = await res.json()
    expect(j.results.u1).toContain('AI-fout')
  })
})

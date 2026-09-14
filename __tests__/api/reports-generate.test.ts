import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetUser = vi.fn()
const mockProfile  = vi.fn()
const mockGenerate = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({ select: () => ({ eq: () => ({ single: () => mockProfile() }) }) }),
  })),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }) }))
vi.mock('@/lib/report-generator', () => ({ generateLifeReport: mockGenerate }))

const { POST } = await import('@/app/api/reports/generate/route')

function makeReq(body: unknown) {
  return { json: () => Promise.resolve(body) } as Parameters<typeof POST>[0]
}

describe('POST /api/reports/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } } })
    mockProfile.mockResolvedValue({ data: { ai_api_key: 'test-key' } })
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('returns 401 when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeReq({ kind: 'week' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid kind', async () => {
    const res = await POST(makeReq({ kind: 'year' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when no API key is configured', async () => {
    mockProfile.mockResolvedValue({ data: { ai_api_key: null } })
    const res = await POST(makeReq({ kind: 'week' }))
    expect(res.status).toBe(400)
  })

  it('generates and returns the report on success', async () => {
    mockGenerate.mockResolvedValue({ report: { id: 5, kind: 'week', content: 'Hoi Jordan.' } })
    const res = await POST(makeReq({ kind: 'week' }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.report).toEqual({ id: 5, kind: 'week', content: 'Hoi Jordan.' })
    expect(mockGenerate).toHaveBeenCalledWith(expect.anything(), 'uid1', 'week', 'test-key')
  })

  it('returns 502 when generation fails', async () => {
    mockGenerate.mockResolvedValue({ error: 'AI-fout' })
    const res = await POST(makeReq({ kind: 'month' }))
    expect(res.status).toBe(502)
  })
})

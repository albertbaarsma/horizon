import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockReportsSelect = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'life_reports') {
        return { select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit: () => mockReportsSelect() }) }) }) }) }
      }
      throw new Error(`unexpected table ${table}`)
    },
  })),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }) }))

const { GET } = await import('@/app/api/reports/route')

describe('GET /api/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } } })
  })

  it('returns 401 when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns the reports list', async () => {
    mockReportsSelect.mockResolvedValue({ data: [{ id: 1, kind: 'week' }] })
    const res = await GET()
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.reports).toEqual([{ id: 1, kind: 'week' }])
  })

  it('returns an empty list when there are none yet', async () => {
    mockReportsSelect.mockResolvedValue({ data: null })
    const res = await GET()
    const j = await res.json()
    expect(j.reports).toEqual([])
  })
})

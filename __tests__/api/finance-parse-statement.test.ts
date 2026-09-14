import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetUser = vi.fn()
const mockProfile  = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => mockProfile() }) }),
    }),
  })),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }) }))

const { POST } = await import('@/app/api/finance/parse-statement/route')

function makeReq(file: File | null) {
  const form = new FormData()
  if (file) form.append('file', file)
  return { formData: () => Promise.resolve(form) } as Parameters<typeof POST>[0]
}

function pdfFile(bytes = 100) {
  return new File([new Uint8Array(bytes)], 'afschrift.pdf', { type: 'application/pdf' })
}

describe('POST /api/finance/parse-statement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } } })
    mockProfile.mockResolvedValue({ data: { ai_api_key: 'test-key' } })
  })

  afterEach(() => { vi.unstubAllEnvs() })

  it('returns 401 when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeReq(pdfFile()))
    expect(res.status).toBe(401)
  })

  it('returns 400 when no file is attached', async () => {
    const res = await POST(makeReq(null))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a non-PDF file', async () => {
    const res = await POST(makeReq(new File(['x'], 'foto.png', { type: 'image/png' })))
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.error).toMatch(/PDF/i)
  })

  it('returns 400 for an oversized PDF', async () => {
    const res = await POST(makeReq(pdfFile(8 * 1024 * 1024 + 1)))
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.error).toMatch(/groot/i)
  })

  it('returns 400 when no API key is configured', async () => {
    mockProfile.mockResolvedValue({ data: { ai_api_key: null } })
    const res = await POST(makeReq(pdfFile()))
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.error).toMatch(/API key/i)
  })

  it('returns parsed transactions on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: '[{"date":"2026-08-03","description":"Albert Heijn","amount":-23.45,"category":"Boodschappen"}]' }],
      }),
    }))
    const res = await POST(makeReq(pdfFile()))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.transactions).toEqual([{ date: '2026-08-03', description: 'Albert Heijn', amount: -23.45, category: 'Boodschappen' }])
  })

  it('sends the PDF as a base64 document content block to Anthropic', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ content: [{ type: 'text', text: '[]' }] }) })
    vi.stubGlobal('fetch', fetchMock)
    await POST(makeReq(pdfFile()))
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('api.anthropic.com')
    const body = JSON.parse(options.body as string)
    expect(body.messages[0].content[0]).toMatchObject({ type: 'document', source: { type: 'base64', media_type: 'application/pdf' } })
  })

  it('returns 502 when the Anthropic call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('boom') }))
    const res = await POST(makeReq(pdfFile()))
    expect(res.status).toBe(502)
  })

  it('returns an empty list when the response has no JSON array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: 'Geen transacties gevonden.' }] }),
    }))
    const res = await POST(makeReq(pdfFile()))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.transactions).toEqual([])
  })
})

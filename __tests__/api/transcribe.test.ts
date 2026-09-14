import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _resetStore } from '@/lib/rate-limit'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { ai_token: null } }) }) }),
    }),
  })),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }) }))

const { POST } = await import('@/app/api/transcribe/route')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAudioReq(hasFile = true) {
  const form = new FormData()
  if (hasFile) {
    form.append('audio', new Blob(['fake audio data'], { type: 'audio/webm' }), 'recording.webm')
  }
  return { formData: () => Promise.resolve(form) } as Parameters<typeof POST>[0]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetStore()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } } })
  })

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('returns 401 when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeAudioReq())
    expect(res.status).toBe(401)
  })

  // ── Input validation ──────────────────────────────────────────────────────

  it('returns 400 when no audio file is attached', async () => {
    const res = await POST(makeAudioReq(false))
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.error).toBeTruthy()
  })

  // ── Rate limiting ─────────────────────────────────────────────────────────

  it('returns 429 after 20 requests in a minute', async () => {
    for (let i = 0; i < 20; i++) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ text: 'Transcriptie' }),
      }))
      await POST(makeAudioReq())
    }
    const res = await POST(makeAudioReq())
    expect(res.status).toBe(429)
    const j = await res.json()
    expect(j.error).toBeTruthy()
  })

  // ── Groq Whisper ──────────────────────────────────────────────────────────

  it('returns transcribed text on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: 'Hallo, dit is een test.' }),
    }))
    const res = await POST(makeAudioReq())
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.text).toBe('Hallo, dit is een test.')
  })

  it('returns 500 when Groq Whisper fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Whisper error'),
    }))
    const res = await POST(makeAudioReq())
    expect(res.status).toBe(500)
    const j = await res.json()
    expect(j.error).toMatch(/mislukt/i)
  })

  it('returns empty string when Groq returns no text field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }))
    const res = await POST(makeAudioReq())
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.text).toBe('')
  })

  it('sends audio/webm file to Groq with correct model', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: 'ok' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await POST(makeAudioReq())
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('groq.com')
    expect(url).toContain('audio/transcriptions')
    const body = options.body as FormData
    expect(body.get('model')).toBe('whisper-large-v3-turbo')
    expect(body.get('language')).toBe('nl')
  })
})

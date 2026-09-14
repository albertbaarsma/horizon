import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          google_calendar_connected: true,
          google_access_token: 'yt-tok',
          google_refresh_token: null,
          google_token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        },
      }),
      update: vi.fn().mockReturnThis(),
    }),
  }),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }) }))

const { GET } = await import('@/app/api/youtube/route')

// ── Helpers ─────────────────────────────────────────────────────────────────

const CHANNEL_RESP = {
  items: [{
    id: 'UCxxx',
    snippet: { title: 'Acme Co', description: 'Piano channel', thumbnails: { medium: { url: 'http://img' } } },
    statistics: { subscriberCount: '1000', viewCount: '50000', videoCount: '40' },
    contentDetails: { relatedPlaylists: { uploads: 'UUxxx' } },
  }],
}

const PLAYLIST_RESP = {
  items: [{
    snippet: { title: 'Video 1', thumbnails: { medium: { url: 'http://thumb' } }, publishedAt: '2026-06-01T00:00:00Z', resourceId: { videoId: 'vid1' } },
    contentDetails: { videoId: 'vid1', videoPublishedAt: '2026-06-01T00:00:00Z' },
  }],
}

const VIDEOS_RESP = {
  items: [{
    id: 'vid1',
    snippet: { title: 'Video 1', publishedAt: '2026-06-01T00:00:00Z', thumbnails: { medium: { url: 'http://thumb' } } },
    statistics: { viewCount: '1000', likeCount: '50', commentCount: '10' },
    status: { privacyStatus: 'public', publishAt: null },
  }],
}

function stubFetch(chanOk: boolean, playlistOk = true) {
  let callIdx = 0
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
    const idx = callIdx++
    if (idx === 0) {
      // channel call
      if (!chanOk) return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ error: { message: 'forbidden' } }) })
      return Promise.resolve({ ok: true, json: () => Promise.resolve(CHANNEL_RESP) })
    }
    if (idx === 1) {
      // playlist call
      if (!playlistOk) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: { message: 'not found' } }) })
      return Promise.resolve({ ok: true, json: () => Promise.resolve(PLAYLIST_RESP) })
    }
    // videos call
    return Promise.resolve({ ok: true, json: () => Promise.resolve(VIDEOS_RESP) })
  }))
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/youtube', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 400 when Google not connected', async () => {
    const { createClient } = await import('@/lib/supabase-server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'uid' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        update: vi.fn().mockReturnThis(),
      }),
    } as never)
    const res = await GET()
    expect(res.status).toBe(400)
  })

  it('returns error when channel fetch fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
    stubFetch(false)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 404 when channel not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    }))
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('returns error when playlist fetch fails (bug #1 regression)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
    stubFetch(true, false)
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('returns channel data and videos on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
    stubFetch(true, true)
    const res = await GET()
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.connected).toBe(true)
    expect(j.channel.name).toBe('Acme Co')
    expect(j.channel.subscribers).toBe(1000)
    expect(j.published).toHaveLength(1)
    expect(j.published[0].id).toBe('vid1')
  })

  it('classifies public videos correctly', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
    stubFetch(true, true)
    const res = await GET()
    const j = await res.json()
    expect(j.published[0].privacy).toBe('public')
    expect(j.scheduled).toHaveLength(0)
    expect(j.drafts).toHaveLength(0)
  })
})

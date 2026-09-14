import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getGoogleToken, fetchGmailMessages } from '@/lib/google-api'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSupabase(profile: Record<string, unknown> | null) {
  const single = vi.fn().mockResolvedValue({ data: profile })
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) })
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single,
      update,
    }),
  }
}

// ── getGoogleToken ───────────────────────────────────────────────────────────

describe('getGoogleToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when profile is null', async () => {
    const sb = makeSupabase(null)
    expect(await getGoogleToken(sb as never, 'uid')).toBeNull()
  })

  it('returns null when google_calendar_connected is false', async () => {
    const sb = makeSupabase({
      google_calendar_connected: false,
      google_access_token: 'tok',
      google_refresh_token: null,
      google_token_expires_at: null,
    })
    expect(await getGoogleToken(sb as never, 'uid')).toBeNull()
  })

  it('returns the token when not expired', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString()
    const sb = makeSupabase({
      google_calendar_connected: true,
      google_access_token: 'valid-token',
      google_refresh_token: 'refresh',
      google_token_expires_at: future,
    })
    expect(await getGoogleToken(sb as never, 'uid')).toBe('valid-token')
  })

  it('returns null when expired and no refresh token', async () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const sb = makeSupabase({
      google_calendar_connected: true,
      google_access_token: 'old',
      google_refresh_token: null,
      google_token_expires_at: past,
    })
    expect(await getGoogleToken(sb as never, 'uid')).toBeNull()
  })

  it('refreshes and returns new token when expired', async () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const sb = makeSupabase({
      google_calendar_connected: true,
      google_access_token: 'old',
      google_refresh_token: 'r-tok',
      google_token_expires_at: past,
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ access_token: 'new-token' }),
    }))

    const result = await getGoogleToken(sb as never, 'uid')
    expect(result).toBe('new-token')
  })

  it('returns null when refresh call fails (no access_token in response)', async () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const sb = makeSupabase({
      google_calendar_connected: true,
      google_access_token: 'old',
      google_refresh_token: 'r-tok',
      google_token_expires_at: past,
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ error: 'invalid_grant' }),
    }))

    expect(await getGoogleToken(sb as never, 'uid')).toBeNull()
  })
})

// ── fetchGmailMessages ───────────────────────────────────────────────────────

describe('fetchGmailMessages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws GMAIL_SCOPE_MISSING on 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    await expect(fetchGmailMessages('tok')).rejects.toThrow('GMAIL_SCOPE_MISSING')
  })

  it('throws GMAIL_TOKEN_INVALID on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(fetchGmailMessages('tok')).rejects.toThrow('GMAIL_TOKEN_INVALID')
  })

  it('throws GMAIL_API_N for other errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(fetchGmailMessages('tok')).rejects.toThrow('GMAIL_API_500')
  })

  it('returns empty array when no messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ messages: [] }),
    }))
    expect(await fetchGmailMessages('tok')).toEqual([])
  })

  it('fetches message details and returns structured list', async () => {
    const listResp = {
      ok: true,
      json: vi.fn().mockResolvedValue({ messages: [{ id: 'msg1' }] }),
    }
    const detailResp = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        payload: {
          headers: [
            { name: 'Subject', value: 'Hoi Jordan' },
            { name: 'From', value: 'Mika <erik@example.com>' },
            { name: 'Date', value: 'Mon, 30 Jun 2026 10:00:00 +0200' },
          ],
        },
        snippet: 'Korte preview',
        labelIds: ['INBOX', 'UNREAD'],
      }),
    }

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(listResp)
      .mockResolvedValueOnce(detailResp)
    )

    const msgs = await fetchGmailMessages('tok', 1)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].subject).toBe('Hoi Jordan')
    expect(msgs[0].from).toBe('Mika <erik@example.com>')
    expect(msgs[0].snippet).toBe('Korte preview')
    expect(msgs[0].labelIds).toContain('UNREAD')
  })

  it('filters out messages whose detail fetch fails', async () => {
    const listResp = {
      ok: true,
      json: vi.fn().mockResolvedValue({ messages: [{ id: 'msg1' }, { id: 'msg2' }] }),
    }

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(listResp)
      .mockResolvedValueOnce({ ok: false, status: 404 })  // msg1 detail fails
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          payload: { headers: [{ name: 'Subject', value: 'Msg2' }] },
          snippet: 'ok',
          labelIds: [],
        }),
      })
    )

    const msgs = await fetchGmailMessages('tok', 2)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].subject).toBe('Msg2')
  })
})

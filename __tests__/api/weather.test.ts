import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-server', () => ({ createClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }) }))

const { GET } = await import('@/app/api/weather/route')

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeFeedResponse(overrides: object = {}) {
  return {
    actual: {
      stationmeasurements: [
        {
          stationid: 391, stationname: 'Meetstation Twente',
          lat: 52.27, lon: 6.90, temperature: 19,
          weatherdescription: 'Onbewolkt', winddirection: 'ZW', windspeed: 3,
          precipitation: 0, humidity: 60, airpressure: 1013,
          iconurl: 'https://cdn.buienradar.nl/resources/images/icons/weather/30x30/a.png',
        },
        {
          stationid: 999, stationname: 'Ver station',
          lat: 10, lon: 10, temperature: 30,
          weatherdescription: 'Zon', winddirection: 'N', windspeed: 1,
          precipitation: 0, humidity: 50, airpressure: 1010,
          iconurl: 'https://cdn.buienradar.nl/resources/images/icons/weather/30x30/a.png',
        },
      ],
    },
    ...overrides,
  }
}

function makeMeteoResponse(overrides: object = {}) {
  return {
    daily: {
      time: ['2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06'],
      weathercode: [0, 1, 2, 3, 61, 80, 95],
      temperature_2m_max: [22, 23, 21, 19, 18, 20, 24],
      temperature_2m_min: [14, 15, 13, 12, 11, 13, 16],
      precipitation_probability_max: [10, 5, 20, 40, 70, 60, 30],
      windspeed_10m_max: [14.4, 10.8, 18, 7.2, 21.6, 25.2, 9],
      winddirection_10m_dominant: [225, 90, 0, 180, 270, 45, 315],
    },
    ...overrides,
  }
}

function stubFetch(feedOk: boolean, rainText = '0|10:00\n50|10:05', meteoOk = true) {
  vi.stubGlobal('fetch', vi.fn()
    .mockImplementation((url: string) => {
      if (url.includes('data.buienradar.nl')) {
        if (!feedOk) return Promise.resolve({ ok: false })
        return Promise.resolve({ ok: true, json: () => Promise.resolve(makeFeedResponse()) })
      }
      if (url.includes('api.open-meteo.com')) {
        if (!meteoOk) return Promise.resolve({ ok: false })
        return Promise.resolve({ ok: true, json: () => Promise.resolve(makeMeteoResponse()) })
      }
      // rain text endpoint
      return Promise.resolve({ ok: true, text: () => Promise.resolve(rainText) })
    })
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/weather', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 when Buienradar feed fails', async () => {
    stubFetch(false)
    const res = await GET()
    expect(res.status).toBe(500)
    const j = await res.json()
    expect(j.error).toBeTruthy()
  })

  it('returns weather data on success', async () => {
    stubFetch(true)
    const res = await GET()
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.station).toBeTruthy()
    expect(typeof j.current.temperature).toBe('number')
    expect(Array.isArray(j.forecast)).toBe(true)
    expect(Array.isArray(j.rainForecast)).toBe(true)
  })

  it('selects nearest station (Twente over far station)', async () => {
    stubFetch(true)
    const res = await GET()
    const j = await res.json()
    expect(j.station).toContain('Twente')
  })

  it('includes distance field', async () => {
    stubFetch(true)
    const res = await GET()
    const j = await res.json()
    expect(typeof j.distance).toBe('number')
    // Meetstation Twente is roughly 130-145km from the default (Amsterdam) location
    expect(j.distance).toBeGreaterThan(100)
    expect(j.distance).toBeLessThan(160)
  })

  it('parses at least a week of forecast days', async () => {
    stubFetch(true)
    const res = await GET()
    const j = await res.json()
    expect(j.forecast.length).toBeGreaterThanOrEqual(7)
    expect(j.forecast[0].maxTemp).toBe(22)
    expect(j.forecast[0].minTemp).toBe(14)
    expect(j.forecast[0].date).toBe('2026-06-30')
    expect(j.forecast[0].rainChance).toBe(10)
  })

  it('falls back to an empty forecast when Open-Meteo is unavailable', async () => {
    stubFetch(true, undefined, false)
    const res = await GET()
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.forecast).toEqual([])
  })

  it('sets isRaining=false when rain data is all zeros', async () => {
    stubFetch(true, '0|10:00\n0|10:05')
    const res = await GET()
    const j = await res.json()
    expect(j.isRaining).toBe(false)
  })

  it('sets isRaining=true when rain data has values', async () => {
    // rainValue(150) > 0.1 mm/h
    stubFetch(true, '150|10:00\n150|10:05')
    const res = await GET()
    const j = await res.json()
    expect(j.isRaining).toBe(true)
  })

  it('handles gracefully when rain endpoint is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementation((url: string) => {
        if (url.includes('data.buienradar.nl')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(makeFeedResponse()) })
        }
        return Promise.resolve({ ok: false })
      })
    )
    const res = await GET()
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.rainForecast).toEqual([])
  })
})

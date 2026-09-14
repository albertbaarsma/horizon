import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import type { WeatherData } from '@/app/dashboard/WeekTab'
import { todayLocal } from '@/lib/dates'

/** Elke aanroep van scrollIntoView, met het element waarop hij werd
 *  aangeroepen — zo kunnen we controleren dat precies de dagkaart van
 *  vandaag wordt gescrold, niet zomaar íets. */
let scrolled: { el: Element; opts: ScrollIntoViewOptions | boolean | undefined }[]

beforeEach(() => {
  vi.clearAllMocks()
  scrolled = []
  Element.prototype.scrollIntoView = vi.fn(function (this: Element, opts) {
    scrolled.push({ el: this, opts })
  })
})

const { WeekTab } = await import('@/app/dashboard/WeekTab')

/** De dagkaart van een datum. WeekTab rendert 6 weken, dus zoek altijd per datum. */
function dayCard(date: string): HTMLElement {
  const el = document.querySelector(`[data-date="${date}"]`)
  if (!el) throw new Error(`geen dagkaart voor ${date}`)
  return el as HTMLElement
}

function renderWeek(props: Partial<Parameters<typeof WeekTab>[0]> = {}) {
  render(
    <WeekTab
      items={[]} projects={[]}
      onToggle={vi.fn()} onMove={vi.fn()} onCtx={vi.fn()}
      onAddItem={vi.fn()} onOpenRecurModal={vi.fn()}
      onSwitchToMonth={vi.fn()} onOpenDetail={vi.fn()}
      {...props}
    />
  )
}

const weer: WeatherData = {
  station: 'Twente', distance: 21,
  current: { temperature: 15, description: 'Onbewolkt', windDirection: 'ZW', windSpeed: 3, precipitation: 0 },
  rainForecast: [], isRaining: false, forecast: [],
}

// Reproduceert het echte scenario: op productie duurt de /api/weather-fetch
// even, dus WeekTab rendert eerst zonder weerkaart en pas later mét — dat is
// precies het moment waarop "vandaag" buiten beeld kan schuiven als er niet
// opnieuw gescrold wordt.
function fetchThatResolvesTo(data: WeatherData) {
  let resolve!: (v: unknown) => void
  const promise = new Promise(r => { resolve = r })
  global.fetch = vi.fn(() => promise) as never
  return () => resolve({ json: async () => data })
}

describe('WeekTab — opent altijd bij vandaag, niet bij het begin van de lijst', () => {
  it('scrollt bij het laden direct naar de dagkaart van vandaag', () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as never
    renderWeek()
    expect(scrolled.map(s => s.el)).toContain(dayCard(todayLocal()))
  })

  it('gebruikt "auto" (direct), niet "smooth" — een smooth scroll leunt op ' +
     'requestAnimationFrame, dat een nog niet volledig actieve mobiele tab ' +
     'kan uitstellen of overslaan, waardoor "vandaag" alsnog buiten beeld blijft', () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as never
    renderWeek()
    const call = scrolled.find(s => s.el === dayCard(todayLocal()))
    expect(call?.opts).toMatchObject({ behavior: 'auto', block: 'start' })
  })

  it('scrollt ook op een smal (mobiel) scherm naar vandaag — WeekTab kent ' +
     'geen apart mobiel renderpad, dus dit moet identiek zijn aan desktop', () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as never
    const origWidth = window.innerWidth
    window.innerWidth = 375
    window.dispatchEvent(new Event('resize'))
    try {
      renderWeek()
      expect(scrolled.map(s => s.el)).toContain(dayCard(todayLocal()))
    } finally {
      window.innerWidth = origWidth
    }
  })

  it('scrollt opnieuw naar vandaag zodra het weer (async) binnenkomt, want dat schuift alle dagkaarten omlaag', async () => {
    const resolveWeather = fetchThatResolvesTo(weer)
    renderWeek()

    const scrollsVoorWeer = scrolled.length
    expect(scrollsVoorWeer).toBeGreaterThan(0) // meteen bij het laden al gescrold

    resolveWeather()

    await waitFor(() => expect(scrolled.length).toBeGreaterThan(scrollsVoorWeer))
    expect(scrolled[scrolled.length - 1].el).toBe(dayCard(todayLocal()))
  })
})

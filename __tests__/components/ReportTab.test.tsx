import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReportTab } from '@/app/dashboard/ReportTab'
import type { LifeReport } from '@/lib/types'

function report(overrides: Partial<LifeReport> = {}): LifeReport {
  return { id: 1, user_id: 'u', kind: 'week', period_start: '2026-08-21', period_end: '2026-08-27', content: 'Dit is je weekrapport, Jordan.', created_at: '', ...overrides }
}

let speakMock: ReturnType<typeof vi.fn>
let cancelMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  speakMock = vi.fn()
  cancelMock = vi.fn()
  Object.defineProperty(window, 'speechSynthesis', {
    value: { speak: speakMock, cancel: cancelMock },
    writable: true, configurable: true,
  })
  class FakeUtterance { text: string; lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null
    constructor(text: string) { this.text = text } }
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
})

describe('ReportTab — laden', () => {
  it('toont een laadstaat en dan de lege staat zonder rapporten', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ reports: [] }) }))
    render(<ReportTab />)
    expect(screen.getByText(/Rapporten laden/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Nog geen weekrapport/)).toBeInTheDocument())
    expect(screen.getByText(/Nog geen maandrapport/)).toBeInTheDocument()
  })

  it('toont de laatste week- en maandrapporten apart', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ reports: [report({ id: 1, kind: 'week', content: 'Weektekst' }), report({ id: 2, kind: 'month', content: 'Maandtekst' })] }),
    }))
    render(<ReportTab />)
    await waitFor(() => expect(screen.getByText('Weektekst')).toBeInTheDocument())
    expect(screen.getByText('Maandtekst')).toBeInTheDocument()
  })

  it('zet oudere rapporten van hetzelfde type in de geschiedenis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ reports: [
        report({ id: 2, kind: 'week', period_start: '2026-08-21', period_end: '2026-08-27', content: 'Nieuwste' }),
        report({ id: 1, kind: 'week', period_start: '2026-08-14', period_end: '2026-08-20', content: 'Oudste' }),
      ] }),
    }))
    render(<ReportTab />)
    await waitFor(() => expect(screen.getByText('Nieuwste')).toBeInTheDocument())
    expect(screen.getByText('Eerdere rapporten')).toBeInTheDocument()
    expect(screen.queryByText('Oudste')).not.toBeInTheDocument() // staat niet als volledige tekst, alleen in de geschiedenislijst
  })
})

describe('ReportTab — nu genereren', () => {
  it('roept de generate-endpoint aan en toont het nieuwe rapport', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ reports: [] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ report: report({ content: 'Vers rapport' }) }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<ReportTab />)
    await waitFor(() => expect(screen.getByText(/Nog geen weekrapport/)).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('↻ Nu genereren')[0])
    await waitFor(() => expect(screen.getByText('Vers rapport')).toBeInTheDocument())

    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe('/api/reports/generate')
    expect(JSON.parse(options.body as string)).toEqual({ kind: 'week' })
  })

  it('toont een foutmelding als genereren mislukt', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ reports: [] }) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'AI-fout' }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<ReportTab />)
    await waitFor(() => expect(screen.getAllByText('↻ Nu genereren').length).toBe(2))
    fireEvent.click(screen.getAllByText('↻ Nu genereren')[0])
    await waitFor(() => expect(screen.getByText('AI-fout')).toBeInTheDocument())
  })
})

describe('ReportTab — voorlezen', () => {
  it('start speechSynthesis met de rapporttekst', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ reports: [report()] }) }))
    render(<ReportTab />)
    await waitFor(() => expect(screen.getByText('Dit is je weekrapport, Jordan.')).toBeInTheDocument())
    fireEvent.click(screen.getByText('🎧 Voorlezen'))
    expect(cancelMock).toHaveBeenCalled()
    expect(speakMock).toHaveBeenCalledTimes(1)
    const utter = speakMock.mock.calls[0][0] as SpeechSynthesisUtterance
    expect(utter.text).toBe('Dit is je weekrapport, Jordan.')
    expect(utter.lang).toBe('nl-NL')
  })

  it('stopt bij een tweede klik i.p.v. opnieuw te starten', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ reports: [report()] }) }))
    render(<ReportTab />)
    await waitFor(() => expect(screen.getByText('🎧 Voorlezen')).toBeInTheDocument())
    fireEvent.click(screen.getByText('🎧 Voorlezen'))
    await waitFor(() => expect(screen.getByText('⏹ Stop')).toBeInTheDocument())
    fireEvent.click(screen.getByText('⏹ Stop'))
    expect(speakMock).toHaveBeenCalledTimes(1) // niet opnieuw gestart
    await waitFor(() => expect(screen.getByText('🎧 Voorlezen')).toBeInTheDocument())
  })
})

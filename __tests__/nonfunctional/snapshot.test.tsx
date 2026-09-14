/**
 * Snapshot tests — non-functional
 *
 * These tests capture the rendered HTML of key components and fail if the
 * output changes unexpectedly. They don't check behaviour; they protect
 * against accidental visual regressions (e.g. a class rename, a missing
 * wrapper div, a changed button label).
 *
 * To intentionally update a snapshot: npx vitest run --update-snapshots
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MailTab } from '@/app/dashboard/MailTab'

const PROJECTS = [
  { id: 'piano', name: 'Acme Co', emoji: '🎹', cat_id: 'c1', status: 'actief' as const, description: '', vision: '', proj_type: 'project' as const, notes: null, html_content: null, is_priority: false, sort_order: 0, user_id: 'u1', created_at: '', updated_at: '' },
]

const MAILS = [
  {
    id: 'm1', subject: 'Offerte gevraagd', from: 'klant@voorbeeld.nl', fromName: 'Klant',
    date: '2026-07-01T10:00:00.000Z',
    snippet: 'Hallo Jordan, graag een offerte.', priority: 'high' as const,
    actionRequired: true, category: 'werk' as const,
    oneLiner: 'Klant vraagt om offerte', suggestedTask: 'Stuur offerte',
  },
  {
    id: 'm2', subject: 'Nieuwsbrief', from: 'news@bar.nl', fromName: 'Bar News',
    date: '2026-06-30T08:00:00.000Z',
    snippet: 'Check onze aanbiedingen!', priority: 'low' as const,
    actionRequired: false, category: 'nieuwsbrief' as const,
    oneLiner: 'Reclame', suggestedTask: null,
  },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ messages: MAILS, connected: true }),
  }))
})

describe('MailTab snapshots', () => {
  it('loading state matches snapshot', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    const { container } = render(<MailTab projects={PROJECTS} onCreateTask={vi.fn()} />)
    expect(container).toMatchSnapshot()
  })

  it('error state matches snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ error: 'Google niet verbonden', connected: false }),
    }))
    const { container, findByText } = render(<MailTab projects={PROJECTS} onCreateTask={vi.fn()} />)
    await findByText(/Fout bij ophalen/i)
    expect(container).toMatchSnapshot()
  })

  it('mail list state matches snapshot', async () => {
    const { container, findByText } = render(<MailTab projects={PROJECTS} onCreateTask={vi.fn()} />)
    await findByText('Offerte gevraagd')
    expect(container).toMatchSnapshot()
  })
})

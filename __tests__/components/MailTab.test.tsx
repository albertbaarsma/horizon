import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MailTab } from '@/app/dashboard/MailTab'

const PROJECTS = [
  { id: 'proj1', name: 'Acme Co', emoji: '🎹', cat_id: 'cat1', status: 'actief' as const, description: '', vision: '', proj_type: 'project' as const, notes: null, html_content: null, is_priority: false, sort_order: 0, user_id: 'uid', created_at: '', updated_at: '' },
  { id: 'proj2', name: 'YouTube',     emoji: '📹', cat_id: 'cat2', status: 'actief' as const, description: '', vision: '', proj_type: 'project' as const, notes: null, html_content: null, is_priority: false, sort_order: 1, user_id: 'uid', created_at: '', updated_at: '' },
]

const SAMPLE_MAILS = [
  {
    id: 'm1', subject: 'Offerte gevraagd', from: 'klant@foo.nl', fromName: 'Klant Foo',
    date: new Date(Date.now() - 3_600_000).toISOString(),
    snippet: 'Hallo Jordan, graag een offerte.', priority: 'high' as const,
    actionRequired: true, category: 'werk' as const,
    oneLiner: 'Klant vraagt om offerte', suggestedTask: 'Stuur offerte naar Klant Foo',
  },
  {
    id: 'm2', subject: 'Nieuwsbrief', from: 'news@bar.nl', fromName: 'Bar News',
    date: new Date(Date.now() - 86_400_000).toISOString(),
    snippet: 'Check onze aanbiedingen!', priority: 'low' as const,
    actionRequired: false, category: 'nieuwsbrief' as const,
    oneLiner: 'Reclamemail van Bar News', suggestedTask: null,
  },
]

function stubFetch(response: object) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve(response),
  }))
}

const onCreateTask = vi.fn().mockResolvedValue(undefined)

describe('MailTab', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows loading state initially', () => {
    // fetch that never resolves
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    expect(screen.getByText(/Mails ophalen en analyseren/i)).toBeTruthy()
  })

  it('shows error when API returns error', async () => {
    stubFetch({ error: 'Gmail-scope niet toegestaan. Log opnieuw in met Google.', connected: false })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => {
      expect(screen.getByText(/Fout bij ophalen mails/i)).toBeTruthy()
    })
    expect(screen.getByText(/Gmail-scope niet toegestaan/i)).toBeTruthy()
  })

  it('shows reconnect link when error contains "verbonden"', async () => {
    stubFetch({ error: 'Google niet verbonden', connected: false })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => {
      expect(screen.getByText(/Opnieuw verbinden/i)).toBeTruthy()
    })
  })

  it('shows empty state when no mails', async () => {
    stubFetch({ messages: [], connected: true })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => {
      expect(screen.getByText(/Geen ongelezen mails/i)).toBeTruthy()
    })
  })

  it('shows mail list with subjects', async () => {
    stubFetch({ messages: SAMPLE_MAILS, connected: true })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => {
      expect(screen.getByText('Offerte gevraagd')).toBeTruthy()
      expect(screen.getByText('Nieuwsbrief')).toBeTruthy()
    })
  })

  it('shows inbox count in header', async () => {
    stubFetch({ messages: SAMPLE_MAILS, connected: true })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => {
      expect(screen.getByText(/2 ongelezen/i)).toBeTruthy()
    })
  })

  it('filters to actie-required mails only', async () => {
    stubFetch({ messages: SAMPLE_MAILS, connected: true })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => screen.getByText('Offerte gevraagd'))

    const actieButton = screen.getByText(/⚡ Actie/i)
    fireEvent.click(actieButton)

    expect(screen.getByText('Offerte gevraagd')).toBeTruthy()
    // Nieuwsbrief has actionRequired=false, should be hidden
    expect(screen.queryByText('Nieuwsbrief')).toBeNull()
  })

  it('filters to high-priority mails only', async () => {
    stubFetch({ messages: SAMPLE_MAILS, connected: true })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => screen.getByText('Offerte gevraagd'))

    const urgentButton = screen.getByText(/🔴 Urgent/i)
    fireEvent.click(urgentButton)

    expect(screen.getByText('Offerte gevraagd')).toBeTruthy()
    expect(screen.queryByText('Nieuwsbrief')).toBeNull()
  })

  it('expands mail on click and shows AI summary', async () => {
    stubFetch({ messages: SAMPLE_MAILS, connected: true })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => screen.getByText('Offerte gevraagd'))

    fireEvent.click(screen.getByText('Offerte gevraagd'))
    await waitFor(() => {
      expect(screen.getByText('AI SAMENVATTING')).toBeTruthy()
      expect(screen.getByText('Klant vraagt om offerte')).toBeTruthy()
    })
  })

  it('shows suggested task section when actionRequired and suggestedTask', async () => {
    stubFetch({ messages: SAMPLE_MAILS, connected: true })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => screen.getByText('Offerte gevraagd'))

    fireEvent.click(screen.getByText('Offerte gevraagd'))
    await waitFor(() => {
      expect(screen.getByText(/VOORGESTELDE TAAK/i)).toBeTruthy()
      expect(screen.getByText('Stuur offerte naar Klant Foo')).toBeTruthy()
    })
  })

  it('calls onCreateTask when taak aanmaken is clicked', async () => {
    stubFetch({ messages: [SAMPLE_MAILS[0]], connected: true })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => screen.getByText('Offerte gevraagd'))

    fireEvent.click(screen.getByText('Offerte gevraagd'))
    await waitFor(() => screen.getByText('＋ Taak aanmaken'))

    fireEvent.click(screen.getByText('＋ Taak aanmaken'))
    await waitFor(() => {
      expect(onCreateTask).toHaveBeenCalledWith('proj1', 'Stuur offerte naar Klant Foo')
    })
  })

  it('shows "Taak aangemaakt" confirmation after task creation', async () => {
    stubFetch({ messages: [SAMPLE_MAILS[0]], connected: true })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => screen.getByText('Offerte gevraagd'))

    fireEvent.click(screen.getByText('Offerte gevraagd'))
    await waitFor(() => screen.getByText('＋ Taak aanmaken'))

    fireEvent.click(screen.getByText('＋ Taak aanmaken'))
    await waitFor(() => {
      expect(screen.getByText(/✓ Taak aangemaakt/i)).toBeTruthy()
    })
  })

  it('shows "Geen mails in dit filter" when filter has no results', async () => {
    const onlyLow = [SAMPLE_MAILS[1]]
    stubFetch({ messages: onlyLow, connected: true })
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await waitFor(() => screen.getByText('Nieuwsbrief'))

    fireEvent.click(screen.getByText(/🔴 Urgent/i))
    expect(screen.getByText(/Geen mails in dit filter/i)).toBeTruthy()
  })
})

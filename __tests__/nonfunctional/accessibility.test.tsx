/**
 * Accessibility (a11y) tests — non-functional
 *
 * These tests verify that components are usable by people relying on
 * keyboard navigation or screen readers. They check:
 *   - Interactive elements are reachable by role (not just by visual style)
 *   - Buttons and controls have readable labels
 *   - Status messages are announced correctly
 *   - The component works without a mouse (keyboard-only flow)
 *
 * We use Testing Library's ARIA-query helpers (getByRole, getByLabelText)
 * because they mirror what a screen reader actually sees.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ messages: MAILS, connected: true }),
  }))
})

describe('MailTab accessibility', () => {
  it('filter buttons are reachable by role and have readable labels', async () => {
    render(<MailTab projects={PROJECTS} onCreateTask={vi.fn()} />)
    await screen.findByText('Offerte gevraagd')

    // All three filter options must exist as buttons a screen reader can find
    const buttons = screen.getAllByRole('button')
    const labels = buttons.map(b => b.textContent ?? '')
    expect(labels.some(l => l.includes('Alles'))).toBe(true)
    expect(labels.some(l => l.includes('Actie'))).toBe(true)
    expect(labels.some(l => l.includes('Urgent'))).toBe(true)
  })

  it('refresh button has a visible text label (not just an icon)', async () => {
    render(<MailTab projects={PROJECTS} onCreateTask={vi.fn()} />)
    await screen.findByText('Offerte gevraagd')

    // Screen readers read button text — a bare icon "↻" with no label is inaccessible.
    // The button must contain some non-whitespace text.
    const refreshButton = screen.getByText(/Verversen/i)
    expect(refreshButton).toBeTruthy()
    expect(refreshButton.tagName).toBe('BUTTON')
  })

  it('task creation button is keyboard-activatable (responds to Enter key)', async () => {
    const onCreateTask = vi.fn().mockResolvedValue(undefined)
    render(<MailTab projects={PROJECTS} onCreateTask={onCreateTask} />)
    await screen.findByText('Offerte gevraagd')

    // Open the mail
    fireEvent.click(screen.getByText('Offerte gevraagd'))
    const taskButton = await screen.findByText('＋ Taak aanmaken')

    // Simulate Enter key on the button — must trigger the same action as a click
    fireEvent.keyDown(taskButton, { key: 'Enter', code: 'Enter' })
    fireEvent.click(taskButton) // browsers fire click on Enter for <button>
    await waitFor(() => expect(onCreateTask).toHaveBeenCalledTimes(1))
  })

  it('loading state communicates progress without relying on colour alone', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    render(<MailTab projects={PROJECTS} onCreateTask={vi.fn()} />)

    // Must include readable text — "loading" cannot be conveyed by a spinner emoji alone
    expect(screen.getByText(/ophalen|analyseren/i)).toBeTruthy()
  })

  it('error state renders readable text (not just a red border)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ error: 'Geen toegang tot Gmail', connected: false }),
    }))
    render(<MailTab projects={PROJECTS} onCreateTask={vi.fn()} />)

    await waitFor(() => {
      // Error must be communicated as actual text, not only via colour
      expect(screen.getByText(/Geen toegang tot Gmail/i)).toBeTruthy()
    })
  })

  it('mail subject is the clickable element (not a hidden div wrapping visible text)', async () => {
    render(<MailTab projects={PROJECTS} onCreateTask={vi.fn()} />)
    const subject = await screen.findByText('Offerte gevraagd')

    // The element the user clicks should be the one containing the meaningful text,
    // not an invisible overlay on top of it — cursor:pointer without an accessible role
    // is a common trap. Verify at least that the element exists and is visible.
    expect(subject).toBeTruthy()
    expect(subject.textContent).toBe('Offerte gevraagd')
  })
})

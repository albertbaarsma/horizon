import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockEq = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (_table: string) => ({ update: mockUpdate }),
    auth: { signOut: vi.fn() },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockEq.mockResolvedValue({ error: null })
  mockUpdate.mockReturnValue({ eq: mockEq })
})

// ── Lazy import after mocks ───────────────────────────────────────────────────

const { default: SettingsClient } = await import('@/app/settings/SettingsClient')

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'uid', display_name: 'Jordan', ai_token: 'tok-123',
    ai_provider: 'anthropic', ai_model: null, ai_base_url: null, ai_api_key: null,
    google_calendar_connected: false, google_access_token: null, google_token_expires_at: null,
    hidden_tabs: [], mobile_hidden_features: [],
    ...overrides,
  } as Profile
}

function mobileColumn() {
  return screen.getByText('Op mobiel').parentElement as HTMLElement
}
function desktopColumn() {
  return screen.getByText('Op desktop').parentElement as HTMLElement
}

describe('SettingsClient — Onderdelen aan/uit', () => {
  it('shows both a mobile and a desktop toggle group with the 9 Overige items', () => {
    render(<SettingsClient profile={makeProfile()} userEmail="albert@example.com" />)
    expect(within(mobileColumn()).getAllByRole('checkbox')).toHaveLength(9)
    expect(within(desktopColumn()).getAllByRole('checkbox')).toHaveLength(9)
    expect(screen.getAllByText('📊 Inzicht')).toHaveLength(2)
    expect(screen.getAllByText('⭐ Voortgang')).toHaveLength(2)
  })

  it('defaults mobile checkboxes to unchecked when mobile_hidden_features lists everything', () => {
    render(<SettingsClient profile={makeProfile({ mobile_hidden_features: ['graph', 'youtube', 'mail', 'voortgang', 'plansessie', 'weekreview', 'dagafsluiten', 'ai', 'chat'] })} userEmail="albert@example.com" />)
    const boxes = within(mobileColumn()).getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes.every(cb => !cb.checked)).toBe(true)
  })

  it('desktop checkboxes reflect hidden_tabs — Mail/YouTube unchecked by default, the rest checked', () => {
    render(<SettingsClient profile={makeProfile({ hidden_tabs: ['youtube', 'mail'] })} userEmail="albert@example.com" />)
    const boxes = within(desktopColumn()).getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes.filter(cb => cb.checked).length).toBe(7) // 9 items - youtube - mail
  })

  it('toggling a mobile checkbox writes mobile_hidden_features via supabase', () => {
    render(<SettingsClient profile={makeProfile()} userEmail="albert@example.com" />)
    const boxes = within(mobileColumn()).getAllByRole('checkbox')
    fireEvent.click(boxes[0]) // eerste item ('Inzicht')
    expect(mockUpdate).toHaveBeenCalledWith({ mobile_hidden_features: ['graph'] })
    expect(mockEq).toHaveBeenCalledWith('id', 'uid')
  })

  it('toggling a desktop checkbox writes hidden_tabs via supabase', () => {
    render(<SettingsClient profile={makeProfile()} userEmail="albert@example.com" />)
    const boxes = within(desktopColumn()).getAllByRole('checkbox')
    fireEvent.click(boxes[0]) // eerste item ('Inzicht')
    expect(mockUpdate).toHaveBeenCalledWith({ hidden_tabs: ['graph'] })
  })
})

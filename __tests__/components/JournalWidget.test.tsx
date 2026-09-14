import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Achievement } from '@/lib/types'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (_table: string) => ({
      insert: mockInsert,
    }),
  }),
}))

// Chain: insert → select → single
beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: null, error: null })
  mockSelect.mockReturnValue({ single: mockSingle })
  mockInsert.mockReturnValue({ select: mockSelect })
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

function makeAchievement(overrides: Partial<Achievement> = {}): Achievement {
  return {
    id: 1, user_id: 'uid', date: TODAY, text: 'Test entry', emoji: '🏆',
    cat_id: '', created_at: '',
    ...overrides,
  }
}

const onAdd = vi.fn()

// ── Lazy import after mocks ───────────────────────────────────────────────────

const { JournalWidget } = await import('@/app/dashboard/JournalWidget')

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('JournalWidget', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders FAB with 📓 emoji when closed', () => {
    render(<JournalWidget userId="uid" achievements={[]} onAdd={onAdd} />)
    expect(screen.getByTitle(/Dagboek/i)).toBeTruthy()
    expect(screen.getByText('📓')).toBeTruthy()
  })

  it('opens panel on FAB click', () => {
    render(<JournalWidget userId="uid" achievements={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    expect(screen.getByText('📓 Dagboek')).toBeTruthy()
  })

  it('shows 3 tabs when open', () => {
    render(<JournalWidget userId="uid" achievements={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    expect(screen.getByRole('button', { name: /Achievement/ })).toBeTruthy()
    expect(screen.getByText(/Magic Moment/)).toBeTruthy()
    expect(screen.getByText(/Verbeterpunt/)).toBeTruthy()
  })

  it('shows empty state message when no entries for today', () => {
    render(<JournalWidget userId="uid" achievements={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    expect(screen.getByText(/Nog niets voor vandaag/i)).toBeTruthy()
  })

  it('shows achievement entries in achievement tab', () => {
    const achievement = makeAchievement({ emoji: '🏆', text: 'Mijn prestatie' })
    render(<JournalWidget userId="uid" achievements={[achievement]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    expect(screen.getByText('Mijn prestatie')).toBeTruthy()
  })

  it('does not show achievement entry in magic moment tab', () => {
    const achievement = makeAchievement({ emoji: '🏆', text: 'Mijn prestatie' })
    render(<JournalWidget userId="uid" achievements={[achievement]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    fireEvent.click(screen.getByText(/Magic Moment/))
    expect(screen.queryByText('Mijn prestatie')).toBeNull()
  })

  it('shows magic moment entries (✨) in magic tab only', () => {
    const magic = makeAchievement({ emoji: '✨', text: 'Bijzonder moment' })
    const trophy = makeAchievement({ id: 2, emoji: '🏆', text: 'Andere prestatie' })
    render(<JournalWidget userId="uid" achievements={[magic, trophy]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    // Start on achievement tab — only trophy visible
    expect(screen.queryByText('Bijzonder moment')).toBeNull()
    expect(screen.getByText('Andere prestatie')).toBeTruthy()
    // Switch to magic tab
    fireEvent.click(screen.getByText(/Magic Moment/))
    expect(screen.getByText('Bijzonder moment')).toBeTruthy()
    expect(screen.queryByText('Andere prestatie')).toBeNull()
  })

  it('shows verbeterpunt entries (💡) in verbeter tab only', () => {
    const verbeter = makeAchievement({ emoji: '💡', text: 'Dit kan beter' })
    render(<JournalWidget userId="uid" achievements={[verbeter]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    expect(screen.queryByText('Dit kan beter')).toBeNull()
    fireEvent.click(screen.getByText(/Verbeterpunt/))
    expect(screen.getByText('Dit kan beter')).toBeTruthy()
  })

  it('hides entries from yesterday', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const old = makeAchievement({ date: yesterday, text: 'Gisteren bereikt' })
    render(<JournalWidget userId="uid" achievements={[old]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    expect(screen.queryByText('Gisteren bereikt')).toBeNull()
  })

  it('shows item count in footer', () => {
    const items = [
      makeAchievement({ id: 1, emoji: '🏆' }),
      makeAchievement({ id: 2, emoji: '✨' }),
    ]
    render(<JournalWidget userId="uid" achievements={items} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    expect(screen.getByText(/2 items vandaag/i)).toBeTruthy()
  })

  it('inserts with 🏆 emoji when on achievement tab', async () => {
    const saved: Achievement = makeAchievement({ id: 99, text: 'Nieuw achievement' })
    mockSingle.mockResolvedValueOnce({ data: saved, error: null })

    render(<JournalWidget userId="uid" achievements={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))

    const input = screen.getByPlaceholderText(/Wat heb je bereikt vandaag/i)
    fireEvent.change(input, { target: { value: 'Nieuw achievement' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ emoji: '🏆', text: 'Nieuw achievement' }))
    })
    expect(onAdd).toHaveBeenCalledWith(saved)
  })

  it('inserts with ✨ emoji when on magic moment tab', async () => {
    const saved: Achievement = makeAchievement({ id: 100, emoji: '✨', text: 'Mooi moment' })
    mockSingle.mockResolvedValueOnce({ data: saved, error: null })

    render(<JournalWidget userId="uid" achievements={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    fireEvent.click(screen.getByText(/Magic Moment/))

    const input = screen.getByPlaceholderText(/Beschrijf het bijzondere moment/i)
    fireEvent.change(input, { target: { value: 'Mooi moment' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ emoji: '✨', text: 'Mooi moment' }))
    })
    expect(onAdd).toHaveBeenCalledWith(saved)
  })

  it('inserts with 💡 emoji when on verbeterpunt tab', async () => {
    const saved: Achievement = makeAchievement({ id: 101, emoji: '💡', text: 'Dit kan beter' })
    mockSingle.mockResolvedValueOnce({ data: saved, error: null })

    render(<JournalWidget userId="uid" achievements={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    fireEvent.click(screen.getByText(/Verbeterpunt/))

    const input = screen.getByPlaceholderText(/Wat kan er beter/i)
    fireEvent.change(input, { target: { value: 'Dit kan beter' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ emoji: '💡', text: 'Dit kan beter' }))
    })
    expect(onAdd).toHaveBeenCalledWith(saved)
  })

  it('does not call insert when input is empty', async () => {
    render(<JournalWidget userId="uid" achievements={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    const input = screen.getByPlaceholderText(/Wat heb je bereikt vandaag/i)
    fireEvent.keyDown(input, { key: 'Enter' })
    await new Promise(r => setTimeout(r, 50))
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('closes panel when ✕ FAB is clicked after open', () => {
    render(<JournalWidget userId="uid" achievements={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('📓'))
    expect(screen.getByText('📓 Dagboek')).toBeTruthy()
    fireEvent.click(screen.getByText('✕'))
    expect(screen.queryByText('📓 Dagboek')).toBeNull()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MoodTracker } from '@/app/dashboard/MoodTracker'
import type { MoodEntry } from '@/lib/types'

const TODAY = '2026-08-21'

function makeEntry(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return { id: 1, user_id: 'u', date: TODAY, mood: 0, created_at: '', ...overrides }
}

describe('MoodTracker — status', () => {
  it('toont "nog niet ingevuld" als er geen entry voor vandaag is', () => {
    render(<MoodTracker entries={[]} today={TODAY} onSave={vi.fn()} />)
    expect(screen.getByText(/nog niet ingevuld vandaag/)).toBeInTheDocument()
  })

  it('toont de ingevulde stemming van vandaag', () => {
    render(<MoodTracker entries={[makeEntry({ mood: -8 })]} today={TODAY} onSave={vi.fn()} />)
    expect(screen.getByText(/vandaag ingevuld.*zwaar omlaag/i)).toBeInTheDocument()
  })
})

describe('MoodTracker — invullen met de slider', () => {
  it('heeft een slider van -10 tot +10', () => {
    render(<MoodTracker entries={[]} today={TODAY} onSave={vi.fn()} />)
    fireEvent.click(screen.getByText('＋ Invullen'))
    const slider = screen.getByLabelText('Stemming') as HTMLInputElement
    expect(slider.min).toBe('-10')
    expect(slider.max).toBe('10')
  })

  it('slaat de gekozen stemming op via onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<MoodTracker entries={[]} today={TODAY} onSave={onSave} />)
    fireEvent.click(screen.getByText('＋ Invullen'))
    fireEvent.change(screen.getByLabelText('Stemming'), { target: { value: '-8' } })
    fireEvent.click(screen.getByRole('button', { name: /Opslaan/ }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ mood: -8, date: TODAY })))
  })

  it('kan een positieve stemming (richting manisch) opslaan', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<MoodTracker entries={[]} today={TODAY} onSave={onSave} />)
    fireEvent.click(screen.getByText('＋ Invullen'))
    fireEvent.change(screen.getByLabelText('Stemming'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: /Opslaan/ }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ mood: 9 })))
  })
})

describe('MoodTracker — 14-daagse strip', () => {
  it('rendert een balkje per entry binnen de laatste 14 dagen', () => {
    const entries = [makeEntry({ id: 1, date: '2026-08-20', mood: -5 }), makeEntry({ id: 2, date: '2026-08-21', mood: 3 })]
    render(<MoodTracker entries={entries} today={TODAY} onSave={vi.fn()} />)
    expect(screen.getByTitle(/2026-08-20: Laag/)).toBeInTheDocument()
  })
})

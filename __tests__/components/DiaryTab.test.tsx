import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DiaryTab } from '@/app/dashboard/DiaryTab'
import type { DiaryEntry, MoodEntry } from '@/lib/types'

const TODAY = '2026-08-06'

function makeEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return { id: 1, user_id: 'uid', date: TODAY, text: 'Test entry', created_at: '', ...overrides }
}

describe('DiaryTab — leeg', () => {
  it('toont een uitnodiging als er nog geen entries zijn', () => {
    render(<DiaryTab entries={[]} today={TODAY} onAdd={vi.fn()} />)
    expect(screen.getByText(/Nog geen dagboek-entries/)).toBeInTheDocument()
  })
})

describe('DiaryTab — entries tonen', () => {
  it('toont elke entry met tekst en leesbare datum', () => {
    render(<DiaryTab entries={[makeEntry({ text: 'Vandaag Mika uitgezwaaid.' })]} today={TODAY} onAdd={vi.fn()} />)
    expect(screen.getByText('Vandaag Mika uitgezwaaid.')).toBeInTheDocument()
    // 2026-08-06 is een donderdag
    expect(screen.getByText(/Donderdag 6 augustus 2026/)).toBeInTheDocument()
  })

  it('toont meerdere entries in de gegeven volgorde', () => {
    render(<DiaryTab
      entries={[makeEntry({ id: 1, text: 'Eerste' }), makeEntry({ id: 2, text: 'Tweede', date: '2026-08-05' })]}
      today={TODAY} onAdd={vi.fn()} />)
    const texts = screen.getAllByText(/Eerste|Tweede/).map(el => el.textContent)
    expect(texts).toEqual(['Eerste', 'Tweede'])
  })
})

describe('DiaryTab — nieuwe entry opslaan', () => {
  it('de opslaanknop is uitgeschakeld zolang het tekstveld leeg is', () => {
    render(<DiaryTab entries={[]} today={TODAY} onAdd={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Opslaan/ })).toBeDisabled()
  })

  it('roept onAdd aan met de getypte tekst en de standaarddatum (vandaag)', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<DiaryTab entries={[]} today={TODAY} onAdd={onAdd} />)

    fireEvent.change(screen.getByPlaceholderText(/Wat wil je vastleggen/), { target: { value: 'Mijn verhaal van vandaag' } })
    fireEvent.click(screen.getByRole('button', { name: /Opslaan/ }))

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('Mijn verhaal van vandaag', TODAY))
  })

  it('slaat op via Ctrl+Enter in het tekstveld', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<DiaryTab entries={[]} today={TODAY} onAdd={onAdd} />)

    const textarea = screen.getByPlaceholderText(/Wat wil je vastleggen/)
    fireEvent.change(textarea, { target: { value: 'Snel opgeslagen' } })
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('Snel opgeslagen', TODAY))
  })

  it('leegt het tekstveld en zet de datum terug op vandaag na opslaan', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<DiaryTab entries={[]} today={TODAY} onAdd={onAdd} />)

    const textarea = screen.getByPlaceholderText(/Wat wil je vastleggen/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Weg hierna' } })
    fireEvent.click(screen.getByRole('button', { name: /Opslaan/ }))

    await waitFor(() => expect(textarea.value).toBe(''))
  })

  it('trimt whitespace en slaat niets op bij een leeg/whitespace-only bericht', () => {
    const onAdd = vi.fn()
    render(<DiaryTab entries={[]} today={TODAY} onAdd={onAdd} />)

    fireEvent.change(screen.getByPlaceholderText(/Wat wil je vastleggen/), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: /Opslaan/ })).toBeDisabled()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('gebruikt de gekozen datum uit het datumveld i.p.v. altijd vandaag', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<DiaryTab entries={[]} today={TODAY} onAdd={onAdd} />)

    fireEvent.change(screen.getByDisplayValue(TODAY), { target: { value: '2026-07-20' } })
    fireEvent.change(screen.getByPlaceholderText(/Wat wil je vastleggen/), { target: { value: 'Met terugwerkende kracht' } })
    fireEvent.click(screen.getByRole('button', { name: /Opslaan/ }))

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('Met terugwerkende kracht', '2026-07-20'))
  })

  it('toont het aantal getypte tekens', () => {
    render(<DiaryTab entries={[]} today={TODAY} onAdd={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/Wat wil je vastleggen/), { target: { value: 'Hallo' } })
    expect(screen.getByText('5 tekens')).toBeInTheDocument()
  })
})

describe('DiaryTab — AI-inschatting van de stemming', () => {
  it('vraagt een suggestie na het opslaan als er nog geen stemming voor die dag is', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    const onSuggestMood = vi.fn().mockResolvedValue({ mood: -6, rationale: 'Klinkt somber.' })
    render(<DiaryTab entries={[]} today={TODAY} onAdd={onAdd} onSaveMood={vi.fn()} onSuggestMood={onSuggestMood} />)

    fireEvent.change(screen.getByPlaceholderText(/Wat wil je vastleggen/), { target: { value: 'Zware dag gehad.' } })
    fireEvent.click(screen.getByRole('button', { name: /Opslaan/ }))

    await waitFor(() => expect(onSuggestMood).toHaveBeenCalledWith('Zware dag gehad.', TODAY))
    expect(await screen.findByText(/-6/)).toBeInTheDocument()
    expect(screen.getByText(/Klinkt somber\./)).toBeInTheDocument()
  })

  it('vraagt geen suggestie als er al een stemming voor die dag staat', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    const onSuggestMood = vi.fn().mockResolvedValue({ mood: -6, rationale: 'x' })
    const existing: MoodEntry[] = [{ id: 1, user_id: 'u', date: TODAY, mood: 2, created_at: '' }]
    render(<DiaryTab entries={[]} today={TODAY} onAdd={onAdd} moodEntries={existing} onSaveMood={vi.fn()} onSuggestMood={onSuggestMood} />)

    fireEvent.change(screen.getByPlaceholderText(/Wat wil je vastleggen/), { target: { value: 'Nog een stukje.' } })
    fireEvent.click(screen.getByRole('button', { name: /Opslaan/ }))

    await waitFor(() => expect(onAdd).toHaveBeenCalled())
    expect(onSuggestMood).not.toHaveBeenCalled()
  })

  it('slaat de suggestie op met source "ai" via "Gebruiken"', async () => {
    const onSaveMood = vi.fn().mockResolvedValue(undefined)
    const onSuggestMood = vi.fn().mockResolvedValue({ mood: -6, rationale: 'Klinkt somber.' })
    render(<DiaryTab entries={[]} today={TODAY} onAdd={vi.fn().mockResolvedValue(undefined)} onSaveMood={onSaveMood} onSuggestMood={onSuggestMood} />)

    fireEvent.change(screen.getByPlaceholderText(/Wat wil je vastleggen/), { target: { value: 'Zware dag.' } })
    fireEvent.click(screen.getByRole('button', { name: /Opslaan/ }))
    fireEvent.click(await screen.findByText('Gebruiken'))

    await waitFor(() => expect(onSaveMood).toHaveBeenCalledWith(expect.objectContaining({ mood: -6, date: TODAY, source: 'ai' })))
    await waitFor(() => expect(screen.queryByText('Gebruiken')).not.toBeInTheDocument())
  })

  it('negeert de suggestie zonder iets op te slaan', async () => {
    const onSaveMood = vi.fn()
    const onSuggestMood = vi.fn().mockResolvedValue({ mood: -6, rationale: 'Klinkt somber.' })
    render(<DiaryTab entries={[]} today={TODAY} onAdd={vi.fn().mockResolvedValue(undefined)} onSaveMood={onSaveMood} onSuggestMood={onSuggestMood} />)

    fireEvent.change(screen.getByPlaceholderText(/Wat wil je vastleggen/), { target: { value: 'Zware dag.' } })
    fireEvent.click(screen.getByRole('button', { name: /Opslaan/ }))
    fireEvent.click(await screen.findByText('Negeren'))

    expect(onSaveMood).not.toHaveBeenCalled()
    expect(screen.queryByText('Negeren')).not.toBeInTheDocument()
  })
})

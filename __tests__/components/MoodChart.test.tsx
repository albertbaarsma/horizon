import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MoodChart } from '@/app/dashboard/MoodChart'
import type { MoodEntry } from '@/lib/types'

const TODAY = '2026-08-21'

function makeEntry(date: string, mood: number, overrides: Partial<MoodEntry> = {}): MoodEntry {
  return { id: Math.random(), user_id: 'u', date, mood, created_at: '', ...overrides }
}

describe('MoodChart', () => {
  it('rendert niets als er minder dan 3 registraties zijn', () => {
    const { container } = render(<MoodChart entries={[makeEntry('2026-08-20', 1), makeEntry('2026-08-21', 2)]} today={TODAY} />)
    expect(container.firstChild).toBeNull()
  })

  it('meldt te weinig data binnen een korte periode ook als er in totaal genoeg is', () => {
    const entries = [makeEntry('2026-01-01', 1), makeEntry('2026-01-02', -1), makeEntry('2026-08-21', 3)]
    render(<MoodChart entries={entries} today={TODAY} />)
    // standaard 90 dagen: alleen de laatste entry valt in het venster
    expect(screen.getByText(/Nog niet genoeg registraties/)).toBeInTheDocument()
  })

  it('tekent een lijn met een punt per registratie binnen het venster', () => {
    const entries = [
      makeEntry('2026-08-01', -8), makeEntry('2026-08-10', 0), makeEntry('2026-08-21', 6),
    ]
    const { container } = render(<MoodChart entries={entries} today={TODAY} />)
    expect(container.querySelectorAll('circle')).toHaveLength(3)
    expect(container.querySelector('path')).toBeInTheDocument()
  })

  it('wisselt van periode via de 30d/90d/1 jaar-knoppen', () => {
    const entries = [
      makeEntry('2025-09-01', -8), // > 90 dagen terug, alleen zichtbaar bij "1 jaar"
      makeEntry('2026-08-15', 0),
      makeEntry('2026-08-21', 6),
    ]
    const { container } = render(<MoodChart entries={entries} today={TODAY} />)
    expect(container.querySelectorAll('circle')).toHaveLength(2) // 90d: de oude entry valt erbuiten

    fireEvent.click(screen.getByText('1 jaar'))
    expect(container.querySelectorAll('circle')).toHaveLength(3)
  })

  it('markeert een AI-inschatting anders dan een zelf ingevulde registratie', () => {
    const entries = [
      makeEntry('2026-08-19', -4, { source: 'manual' }),
      makeEntry('2026-08-20', -5, { source: 'ai' }),
      makeEntry('2026-08-21', -3),
    ]
    const { container } = render(<MoodChart entries={entries} today={TODAY} />)
    const circles = Array.from(container.querySelectorAll('circle'))
    const aiCircle = circles.find(c => c.getAttribute('stroke-dasharray'))
    expect(aiCircle).toBeTruthy()
  })
})

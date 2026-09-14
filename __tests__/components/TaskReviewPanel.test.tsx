import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskReviewPanel } from '@/app/dashboard/TaskReviewPanel'
import type { Finding } from '@/lib/task-freshness'
import type { Task } from '@/lib/types'

function task(id: number, name: string): Task {
  return { id, user_id: 'u', proj_id: 'p', name, status: 'backlog', urgent: false, priority: 0, created_at: '', updated_at: '' }
}
const finding = (id: number, name: string, verdict: Finding['verdict'], confidence = 1): Finding =>
  ({ task: task(id, name), verdict, confidence, reason: `reden voor ${name}` })

function panel(findings: Finding[], handlers: Partial<React.ComponentProps<typeof TaskReviewPanel>> = {}) {
  const props = {
    findings,
    onMarkDone: vi.fn(), onDelete: vi.fn(), onIgnore: vi.fn(), onClose: vi.fn(),
    ...handlers,
  }
  render(<TaskReviewPanel {...props} />)
  return props
}

describe('TaskReviewPanel', () => {
  it('zegt hoeveel taken opvallen', () => {
    panel([finding(1, 'Was doen', 'klaar')])
    expect(screen.getByText(/1 taak valt op/)).toBeInTheDocument()
  })

  it('groepeert per soort bewijs, met het bewijs erbij', () => {
    panel([finding(1, 'Was doen', 'klaar'), finding(2, 'Schuur opruimen', 'mogelijk-klaar', 0.7)])
    expect(screen.getByText('Klaar volgens je week')).toBeInTheDocument()
    expect(screen.getByText('Mogelijk klaar')).toBeInTheDocument()
    expect(screen.getByText('reden voor Was doen')).toBeInTheDocument()
  })

  it('houdt de zwakste groep dichtgeklapt tot je hem opent', () => {
    panel([finding(9, 'Oude taak', 'oud', 0.2)])
    expect(screen.queryByText('Oude taak')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Lang stil'))
    expect(screen.getByText('Oude taak')).toBeInTheDocument()
  })

  it('vinkt een taak af', () => {
    const p = panel([finding(1, 'Was doen', 'klaar')])
    fireEvent.click(screen.getByRole('button', { name: '✓ Klaar' }))
    expect(p.onMarkDone).toHaveBeenCalledWith(1)
  })

  it('verwijdert een taak', () => {
    const p = panel([finding(1, 'Was doen', 'klaar')])
    fireEvent.click(screen.getByRole('button', { name: /Weg/ }))
    expect(p.onDelete).toHaveBeenCalledWith(1)
  })

  it('kan een taak met rust laten', () => {
    const p = panel([finding(1, 'Was doen', 'klaar')])
    fireEvent.click(screen.getByRole('button', { name: /Laat staan/ }))
    expect(p.onIgnore).toHaveBeenCalledWith(1)
  })

  it('biedt alles-tegelijk alleen bij hard bewijs', () => {
    panel([finding(1, 'A', 'klaar'), finding(2, 'B', 'klaar')])
    expect(screen.getByRole('button', { name: /Alle 2 afvinken/ })).toBeInTheDocument()
  })

  it('biedt geen alles-tegelijk bij een vermoeden', () => {
    panel([finding(1, 'A', 'mogelijk-klaar', 0.7), finding(2, 'B', 'mogelijk-klaar', 0.7)])
    expect(screen.queryByRole('button', { name: /Alle 2 afvinken/ })).not.toBeInTheDocument()
  })

  it('vinkt met één klik de hele zekere groep af', () => {
    const p = panel([finding(1, 'A', 'klaar'), finding(2, 'B', 'klaar')])
    fireEvent.click(screen.getByRole('button', { name: /Alle 2 afvinken/ }))
    expect(p.onMarkDone).toHaveBeenCalledWith(1)
    expect(p.onMarkDone).toHaveBeenCalledWith(2)
  })

  it('meldt het als er niets meer na te kijken is', () => {
    panel([])
    expect(screen.getByText(/Niets meer om na te kijken/)).toBeInTheDocument()
  })

  it('is te sluiten', () => {
    const p = panel([finding(1, 'A', 'klaar')])
    fireEvent.click(screen.getByLabelText('Bijwerken sluiten'))
    expect(p.onClose).toHaveBeenCalled()
  })
})

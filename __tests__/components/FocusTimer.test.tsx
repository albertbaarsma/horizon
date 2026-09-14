import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { Task } from '@/lib/types'

const { FocusTimer } = await import('@/app/dashboard/FocusTimer')

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1, user_id: 'uid', proj_id: 'p1', name: 'Focus taak', status: 'doing',
    urgent: false, priority: 0, created_at: '', updated_at: '',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FocusTimer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders with task name', () => {
    render(<FocusTimer task={makeTask({ name: 'Mijn focus taak' })} onStop={vi.fn()} />)
    expect(screen.getByText('Mijn focus taak')).toBeTruthy()
  })

  it('shows "Focus bezig" label on start', () => {
    render(<FocusTimer task={makeTask()} onStop={vi.fn()} />)
    expect(screen.getByText('Focus bezig')).toBeTruthy()
  })

  it('displays 25:00 for task without duration_min', () => {
    render(<FocusTimer task={makeTask()} onStop={vi.fn()} />)
    expect(screen.getByText('25:00')).toBeTruthy()
  })

  it('displays duration from task.duration_min', () => {
    render(<FocusTimer task={makeTask({ duration_min: 30 })} onStop={vi.fn()} />)
    expect(screen.getByText('30:00')).toBeTruthy()
  })

  it('has aria-label "Focus timer" and role "timer"', () => {
    render(<FocusTimer task={makeTask()} onStop={vi.fn()} />)
    expect(screen.getByRole('timer', { name: 'Focus timer' })).toBeTruthy()
  })

  it('shows pause button when running', () => {
    render(<FocusTimer task={makeTask()} onStop={vi.fn()} />)
    expect(screen.getByLabelText('Pauzeren')).toBeTruthy()
  })

  it('pauses timer on pause click', () => {
    render(<FocusTimer task={makeTask({ duration_min: 5 })} onStop={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Pauzeren'))
    expect(screen.getByText('Gepauzeerd')).toBeTruthy()
    expect(screen.getByLabelText('Hervatten')).toBeTruthy()
  })

  it('resumes timer after pause', () => {
    render(<FocusTimer task={makeTask()} onStop={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Pauzeren'))
    fireEvent.click(screen.getByLabelText('Hervatten'))
    expect(screen.getByText('Focus bezig')).toBeTruthy()
  })

  it('calls onStop when close button is clicked', () => {
    const onStop = vi.fn()
    render(<FocusTimer task={makeTask()} onStop={onStop} />)
    fireEvent.click(screen.getByLabelText('Sluiten'))
    expect(onStop).toHaveBeenCalled()
  })

  it('counts down timer each second', () => {
    render(<FocusTimer task={makeTask({ duration_min: 1 })} onStop={vi.fn()} />)
    expect(screen.getByText('01:00')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByText('00:55')).toBeTruthy()
  })

  it('paused timer does not count down', () => {
    render(<FocusTimer task={makeTask({ duration_min: 1 })} onStop={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Pauzeren'))
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText('01:00')).toBeTruthy()
  })

  it('shows done state when timer reaches zero', () => {
    render(<FocusTimer task={makeTask({ duration_min: 1 })} onStop={vi.fn()} />)
    act(() => { vi.advanceTimersByTime(60000) })
    expect(screen.getByText('Klaar!')).toBeTruthy()
    expect(screen.getByLabelText('Opnieuw')).toBeTruthy()
  })

  it('resets timer after clicking Opnieuw', () => {
    render(<FocusTimer task={makeTask({ duration_min: 1 })} onStop={vi.fn()} />)
    act(() => { vi.advanceTimersByTime(60000) })
    fireEvent.click(screen.getByLabelText('Opnieuw'))
    expect(screen.getByText('01:00')).toBeTruthy()
    expect(screen.getByText('Focus bezig')).toBeTruthy()
  })

  it('hides pause button when done', () => {
    render(<FocusTimer task={makeTask({ duration_min: 1 })} onStop={vi.fn()} />)
    act(() => { vi.advanceTimersByTime(60000) })
    expect(screen.queryByLabelText('Pauzeren')).toBeNull()
  })

  // ── onElapsed: werkelijke tijd rapporteren ──────────────────────────────────

  it('reports elapsed minutes on close', () => {
    const onElapsed = vi.fn()
    render(<FocusTimer task={makeTask({ duration_min: 10 })} onStop={vi.fn()} onElapsed={onElapsed} />)
    act(() => { vi.advanceTimersByTime(4 * 60 * 1000) })  // 4 min gewerkt
    fireEvent.click(screen.getByLabelText('Sluiten'))
    expect(onElapsed).toHaveBeenCalledWith(4)
  })

  it('reports full duration when timer completed', () => {
    const onElapsed = vi.fn()
    render(<FocusTimer task={makeTask({ duration_min: 1 })} onStop={vi.fn()} onElapsed={onElapsed} />)
    act(() => { vi.advanceTimersByTime(60000) })
    fireEvent.click(screen.getByLabelText('Sluiten'))
    expect(onElapsed).toHaveBeenCalledWith(1)
  })

  it('includes completed rounds after Opnieuw', () => {
    const onElapsed = vi.fn()
    render(<FocusTimer task={makeTask({ duration_min: 1 })} onStop={vi.fn()} onElapsed={onElapsed} />)
    act(() => { vi.advanceTimersByTime(60000) })          // ronde 1 vol
    fireEvent.click(screen.getByLabelText('Opnieuw'))
    act(() => { vi.advanceTimersByTime(60000) })          // ronde 2 vol
    fireEvent.click(screen.getByLabelText('Sluiten'))
    expect(onElapsed).toHaveBeenCalledWith(2)
  })

  it('does not report when under a minute elapsed', () => {
    const onElapsed = vi.fn()
    render(<FocusTimer task={makeTask({ duration_min: 10 })} onStop={vi.fn()} onElapsed={onElapsed} />)
    act(() => { vi.advanceTimersByTime(10000) })          // 10 sec
    fireEvent.click(screen.getByLabelText('Sluiten'))
    expect(onElapsed).not.toHaveBeenCalled()
  })

  it('still calls onStop when closing without onElapsed prop', () => {
    const onStop = vi.fn()
    render(<FocusTimer task={makeTask({ duration_min: 10 })} onStop={onStop} />)
    act(() => { vi.advanceTimersByTime(120000) })
    fireEvent.click(screen.getByLabelText('Sluiten'))
    expect(onStop).toHaveBeenCalled()
  })
})

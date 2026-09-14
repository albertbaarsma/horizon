import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { WeekItem, Achievement, Task, Goal } from '@/lib/types'

const { WeekReviewModal } = await import('@/app/dashboard/WeekReviewModal')

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Use a fixed Monday so week bounds are predictable
const TODAY = '2026-07-13' // a Monday

function makeWeekItem(overrides: Partial<WeekItem> = {}): WeekItem {
  return {
    id: 1, user_id: 'uid', date: TODAY, type: 'task',
    text: 'Test taak', done: false, proj_id: null, task_id: null,
    recur_id: null, created_at: '',
    ...overrides,
  }
}

function makeAchievement(overrides: Partial<Achievement> = {}): Achievement {
  return {
    id: 1, user_id: 'uid', date: TODAY, text: 'Prestatie', emoji: '🏆', cat_id: '', created_at: '',
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1, user_id: 'uid', proj_id: 'p1', name: 'Test taak', status: 'backlog',
    urgent: false, priority: 0, created_at: '', updated_at: '',
    ...overrides,
  }
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 1, user_id: 'uid', horizon: 'wk', text: 'Doel', done: false,
    cat_id: null, deadline: null, created_at: '',
    ...overrides,
  }
}

const BASE_PROPS = {
  today: TODAY,
  weekItems: [],
  achievements: [],
  tasks: [],
  goals: [],
  onClose: vi.fn(),
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WeekReviewModal', () => {
  it('renders weekreview header with date range', () => {
    render(<WeekReviewModal {...BASE_PROPS} />)
    expect(screen.getByText('Weekreview')).toBeTruthy()
    // The week of 2026-07-13 (Mon) → 13 jul – 19 jul (header shows both)
    expect(screen.getAllByText(/13 jul/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/19 jul/).length).toBeGreaterThan(0)
  })

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    render(<WeekReviewModal {...BASE_PROPS} onClose={onClose} />)
    // Click the backdrop (fixed overlay)
    const backdrop = document.querySelector('[style*="inset: 0"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when ✕ button is clicked', () => {
    const onClose = vi.fn()
    render(<WeekReviewModal {...BASE_PROPS} onClose={onClose} />)
    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows 0 completed and 0 open stats when no weekItems', () => {
    render(<WeekReviewModal {...BASE_PROPS} />)
    expect(screen.getByLabelText('Taken klaar')).toBeTruthy()
    expect(screen.getByLabelText('Openstaand')).toBeTruthy()
    const statValues = screen.getAllByRole('article').map(el => el.textContent)
    // First two stats should show "0"
    expect(statValues[0]).toContain('0')
    expect(statValues[1]).toContain('0')
  })

  it('counts done vs open task week items', () => {
    const done = makeWeekItem({ id: 1, done: true, text: 'Klaar item' })
    const open = makeWeekItem({ id: 2, done: false, text: 'Open item' })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[done, open]} />)
    // Stat cards: Taken klaar = 1, Openstaand = 1
    const stats = screen.getAllByRole('article')
    expect(stats[0].textContent).toContain('1') // done
    expect(stats[1].textContent).toContain('1') // open
  })

  it('counts achievements in stats', () => {
    const ach = makeAchievement({ id: 1, text: 'Goed gedaan' })
    render(<WeekReviewModal {...BASE_PROPS} achievements={[ach]} />)
    const stats = screen.getAllByRole('article')
    expect(stats[2].textContent).toContain('1') // achievements
  })

  it('calculates completion percentage', () => {
    const done = makeWeekItem({ id: 1, done: true })
    const open = makeWeekItem({ id: 2, done: false })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[done, open]} />)
    const stats = screen.getAllByRole('article')
    expect(stats[3].textContent).toContain('50%')
  })

  it('shows 100% completion when all done', () => {
    const item = makeWeekItem({ done: true })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[item]} />)
    const stats = screen.getAllByRole('article')
    expect(stats[3].textContent).toContain('100%')
  })

  it('shows day labels in per-day breakdown', () => {
    render(<WeekReviewModal {...BASE_PROPS} />)
    // Week starting Monday: Ma, Di, Wo, Do, Vr, Za, Zo
    expect(screen.getByText('Ma')).toBeTruthy()
    expect(screen.getByText('Vr')).toBeTruthy()
  })

  it('shows done task text in per-day breakdown', () => {
    const done = makeWeekItem({ done: true, text: 'Gedaan taak' })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[done]} />)
    expect(screen.getByText('Gedaan taak')).toBeTruthy()
  })

  it('shows "Niets gepland" for days without items', () => {
    render(<WeekReviewModal {...BASE_PROPS} />)
    // All 7 days have no items
    const empty = screen.getAllByText('Niets gepland')
    expect(empty.length).toBeGreaterThan(0)
  })

  it('renders achievements section when achievements exist this week', () => {
    const ach = makeAchievement({ text: 'Geweldig bereikt' })
    render(<WeekReviewModal {...BASE_PROPS} achievements={[ach]} />)
    // Achievement text appears in per-day breakdown AND achievements section
    expect(screen.getAllByText('Geweldig bereikt').length).toBeGreaterThan(0)
  })

  it('does not show achievements from previous week', () => {
    const lastWeek = makeAchievement({ date: '2026-07-06', text: 'Vorige week' })
    render(<WeekReviewModal {...BASE_PROPS} achievements={[lastWeek]} />)
    expect(screen.queryByText('Vorige week')).toBeNull()
  })

  it('shows done tasks chips section', () => {
    const done = makeWeekItem({ done: true, text: 'Voltooide taak' })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[done]} />)
    expect(screen.getAllByText('✓ Voltooide taak').length).toBeGreaterThan(0)
  })

  it('shows open tasks chips section', () => {
    const open = makeWeekItem({ done: false, text: 'Openstaande taak' })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[open]} />)
    expect(screen.getByText('○ Openstaande taak')).toBeTruthy()
  })

  it('shows duration summary when done tasks have duration_min', () => {
    const task = makeTask({ name: 'Taak met duur', duration_min: 45 })
    const done = makeWeekItem({ done: true, text: 'Taak met duur' })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[done]} tasks={[task]} />)
    expect(screen.getByText(/45m/)).toBeTruthy()
  })

  it('formats duration >= 60 as hours', () => {
    const task = makeTask({ name: 'Lang item', duration_min: 90 })
    const done = makeWeekItem({ done: true, text: 'Lang item' })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[done]} tasks={[task]} />)
    expect(screen.getByText(/1u 30m/)).toBeTruthy()
  })

  it('does not show duration section when no durations set', () => {
    const done = makeWeekItem({ done: true, text: 'Ongetimede taak' })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[done]} />)
    expect(screen.queryByText(/Geschatte tijd besteed/)).toBeNull()
  })

  it('shows werkelijk gewerkt when done tasks have actual_min', () => {
    const task = makeTask({ name: 'Getimede taak', actual_min: 50 })
    const done = makeWeekItem({ done: true, text: 'Getimede taak' })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[done]} tasks={[task]} />)
    expect(screen.getByText(/Werkelijk gewerkt/)).toBeTruthy()
    expect(screen.getByText(/50m/)).toBeTruthy()
  })

  it('flags when actual time exceeds the estimate', () => {
    const task = makeTask({ name: 'Uitgelopen taak', duration_min: 30, actual_min: 90 })
    const done = makeWeekItem({ done: true, text: 'Uitgelopen taak' })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[done]} tasks={[task]} />)
    expect(screen.getByText(/meer dan geschat/)).toBeTruthy()
  })

  it('does not flag when actual time stays within the estimate', () => {
    const task = makeTask({ name: 'Nette taak', duration_min: 60, actual_min: 45 })
    const done = makeWeekItem({ done: true, text: 'Nette taak' })
    render(<WeekReviewModal {...BASE_PROPS} weekItems={[done]} tasks={[task]} />)
    expect(screen.queryByText(/meer dan geschat/)).toBeNull()
  })

  it('renders note textarea', () => {
    render(<WeekReviewModal {...BASE_PROPS} />)
    expect(screen.getByLabelText('Weeknotitie')).toBeTruthy()
  })

  it('allows typing in note textarea', () => {
    render(<WeekReviewModal {...BASE_PROPS} />)
    const textarea = screen.getByLabelText('Weeknotitie') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Mijn weeknotitie' } })
    expect(textarea.value).toBe('Mijn weeknotitie')
  })

  it('shows week stats aria region', () => {
    render(<WeekReviewModal {...BASE_PROPS} />)
    expect(screen.getByRole('region', { name: 'Weekstatistieken' })).toBeTruthy()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { WeekItem, Achievement } from '@/lib/types'

const { ShutdownModal } = await import('@/app/dashboard/ShutdownModal')

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TODAY    = '2026-07-14'
const TOMORROW = '2026-07-15'

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
    id: 1, user_id: 'uid', date: TODAY, text: 'Win', emoji: '🏆', cat_id: '', created_at: '',
    ...overrides,
  }
}

const BASE_PROPS = {
  today: TODAY,
  weekItems: [] as WeekItem[],
  achievements: [] as Achievement[],
  onToggle: vi.fn(),
  onMove: vi.fn(),
  onDelete: vi.fn(),
  onAddWin: vi.fn(),
  onClose: vi.fn(),
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ShutdownModal', () => {
  it('renders header with date', () => {
    render(<ShutdownModal {...BASE_PROPS} />)
    expect(screen.getByText('🌙 Dag afsluiten')).toBeTruthy()
    expect(screen.getByText(/dinsdag 14 jul/)).toBeTruthy()
  })

  it('calls onClose via ✕ button', () => {
    const onClose = vi.fn()
    render(<ShutdownModal {...BASE_PROPS} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Sluiten'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows stats: done and open counts', () => {
    const items = [
      makeWeekItem({ id: 1, done: true }),
      makeWeekItem({ id: 2, done: false, text: 'Open taak' }),
      makeWeekItem({ id: 3, done: false, text: 'Open taak 2' }),
    ]
    render(<ShutdownModal {...BASE_PROPS} weekItems={items} />)
    const stats = screen.getAllByRole('article')
    expect(stats[0].textContent).toContain('1')  // klaar
    expect(stats[1].textContent).toContain('2')  // open
  })

  it('excludes calendar items from processing', () => {
    const cal = makeWeekItem({ id: 1, type: 'cal', text: 'Agenda-afspraak', done: false })
    render(<ShutdownModal {...BASE_PROPS} weekItems={[cal]} />)
    expect(screen.queryByText('Agenda-afspraak')).toBeNull()
    expect(screen.getByText('Niets gepland vandaag.')).toBeTruthy()
  })

  it('shows done items as chips', () => {
    const done = makeWeekItem({ done: true, text: 'Afgeronde taak' })
    render(<ShutdownModal {...BASE_PROPS} weekItems={[done]} />)
    expect(screen.getByText('✓ Afgeronde taak')).toBeTruthy()
  })

  it('moves an open item to tomorrow', () => {
    const onMove = vi.fn()
    const open = makeWeekItem({ id: 7, text: 'Doorschuiftaak' })
    render(<ShutdownModal {...BASE_PROPS} weekItems={[open]} onMove={onMove} />)
    fireEvent.click(screen.getByLabelText('Doorschuiftaak naar morgen'))
    expect(onMove).toHaveBeenCalledWith(7, TOMORROW)
  })

  it('marks an open item as done via the toggle circle', () => {
    const onToggle = vi.fn()
    const open = makeWeekItem({ id: 8, text: 'Vergeten taak' })
    render(<ShutdownModal {...BASE_PROPS} weekItems={[open]} onToggle={onToggle} />)
    fireEvent.click(screen.getByLabelText('Vergeten taak afvinken'))
    expect(onToggle).toHaveBeenCalledWith(8)
  })

  it('deletes an open item', () => {
    const onDelete = vi.fn()
    const open = makeWeekItem({ id: 9, text: 'Weggooitaak' })
    render(<ShutdownModal {...BASE_PROPS} weekItems={[open]} onDelete={onDelete} />)
    fireEvent.click(screen.getByLabelText('Weggooitaak verwijderen'))
    expect(onDelete).toHaveBeenCalledWith(9)
  })

  it('shows postpone badge when postponed_count >= 2', () => {
    const open = makeWeekItem({ text: 'Uitgestelde taak', postponed_count: 3 })
    render(<ShutdownModal {...BASE_PROPS} weekItems={[open]} />)
    expect(screen.getByText('↷3')).toBeTruthy()
  })

  it('hides postpone badge below 2', () => {
    const open = makeWeekItem({ text: 'Verse taak', postponed_count: 1 })
    render(<ShutdownModal {...BASE_PROPS} weekItems={[open]} />)
    expect(screen.queryByText('↷1')).toBeNull()
  })

  it('shows collapsed older-open section with count', () => {
    const older = makeWeekItem({ id: 5, date: '2026-07-10', text: 'Oude taak' })
    render(<ShutdownModal {...BASE_PROPS} weekItems={[older]} />)
    expect(screen.getByText(/1 oudere open items/)).toBeTruthy()
    expect(screen.queryByText('Oude taak')).toBeNull()  // collapsed
  })

  it('expands older-open section on click', () => {
    const older = makeWeekItem({ id: 5, date: '2026-07-10', text: 'Oude taak' })
    render(<ShutdownModal {...BASE_PROPS} weekItems={[older]} />)
    fireEvent.click(screen.getByText(/1 oudere open items/))
    expect(screen.getByText('Oude taak')).toBeTruthy()
  })

  it('saves a win via the input', () => {
    const onAddWin = vi.fn()
    render(<ShutdownModal {...BASE_PROPS} onAddWin={onAddWin} />)
    const input = screen.getByLabelText('Win van vandaag')
    fireEvent.change(input, { target: { value: 'Mooie dag gehad' } })
    fireEvent.click(screen.getByText('Bewaar'))
    expect(onAddWin).toHaveBeenCalledWith('Mooie dag gehad')
  })

  it('does not save an empty win', () => {
    const onAddWin = vi.fn()
    render(<ShutdownModal {...BASE_PROPS} onAddWin={onAddWin} />)
    fireEvent.click(screen.getByText('Bewaar'))
    expect(onAddWin).not.toHaveBeenCalled()
  })

  it('shows existing wins of today', () => {
    const win = makeAchievement({ text: 'Concert gespeeld' })
    render(<ShutdownModal {...BASE_PROPS} achievements={[win]} />)
    expect(screen.getByText(/Concert gespeeld/)).toBeTruthy()
  })

  it('hides wins from other days', () => {
    const oldWin = makeAchievement({ date: '2026-07-01', text: 'Oude win' })
    render(<ShutdownModal {...BASE_PROPS} achievements={[oldWin]} />)
    expect(screen.queryByText(/Oude win/)).toBeNull()
  })

  it('footer says "Klaar voor vandaag" when everything is processed', () => {
    const done = makeWeekItem({ done: true })
    render(<ShutdownModal {...BASE_PROPS} weekItems={[done]} />)
    expect(screen.getByText('🌙 Klaar voor vandaag')).toBeTruthy()
  })

  it('footer says "Later afmaken" while items are open', () => {
    const open = makeWeekItem({ done: false })
    render(<ShutdownModal {...BASE_PROPS} weekItems={[open]} />)
    expect(screen.getByText('Later afmaken')).toBeTruthy()
  })
})

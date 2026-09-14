import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WeekItem, Achievement } from '@/lib/types'

const { ProductivityHeatmap, heatColor, HEAT } = await import('@/app/dashboard/ProductivityHeatmap')

// ── Fixtures ──────────────────────────────────────────────────────────────────

// De heatmap rekent vanaf de echte klok — gebruik dus echte datums
function daysAgo(n: number): string {
  const d = new Date(); d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function makeWeekItem(overrides: Partial<WeekItem> = {}): WeekItem {
  return {
    id: 1, user_id: 'uid', date: daysAgo(0), type: 'task',
    text: 'Taak', done: true, proj_id: null, task_id: null,
    recur_id: null, created_at: '',
    ...overrides,
  }
}

function makeAchievement(overrides: Partial<Achievement> = {}): Achievement {
  return {
    id: 1, user_id: 'uid', date: daysAgo(0), text: 'Win', emoji: '🏆', cat_id: '', created_at: '',
    ...overrides,
  }
}

// ── heatColor ─────────────────────────────────────────────────────────────────

describe('heatColor', () => {
  it('maps counts to the five intensity buckets', () => {
    expect(heatColor(0)).toBe(HEAT[0])
    expect(heatColor(1)).toBe(HEAT[1])
    expect(heatColor(2)).toBe(HEAT[2])
    expect(heatColor(3)).toBe(HEAT[2])
    expect(heatColor(4)).toBe(HEAT[3])
    expect(heatColor(5)).toBe(HEAT[3])
    expect(heatColor(6)).toBe(HEAT[4])
    expect(heatColor(99)).toBe(HEAT[4])
  })
})

// ── ProductivityHeatmap ───────────────────────────────────────────────────────

describe('ProductivityHeatmap', () => {
  it('renders the stats region', () => {
    render(<ProductivityHeatmap weekItems={[]} achievements={[]} />)
    expect(screen.getByRole('region', { name: 'Productiviteitsstatistieken' })).toBeTruthy()
  })

  it('counts done tasks, active days and best day', () => {
    const items = [
      makeWeekItem({ id: 1, date: daysAgo(1) }),
      makeWeekItem({ id: 2, date: daysAgo(1) }),
      makeWeekItem({ id: 3, date: daysAgo(2) }),
      makeWeekItem({ id: 4, date: daysAgo(3), done: false }),  // telt niet mee
    ]
    render(<ProductivityHeatmap weekItems={items} achievements={[]} />)
    const stats = screen.getAllByRole('article').map(el => el.textContent)
    expect(stats[0]).toContain('3')  // taken gedaan
    expect(stats[1]).toContain('2')  // actieve dagen
    expect(stats[3]).toContain('2')  // beste dag
  })

  it('counts achievements', () => {
    render(<ProductivityHeatmap weekItems={[]} achievements={[makeAchievement()]} />)
    const stats = screen.getAllByRole('article').map(el => el.textContent)
    expect(stats[2]).toContain('1')
  })

  it('shows the legend', () => {
    render(<ProductivityHeatmap weekItems={[]} achievements={[]} />)
    expect(screen.getByText('Minder')).toBeTruthy()
    expect(screen.getByText('Meer')).toBeTruthy()
  })

  it('renders a tooltip with the task count on active cells', () => {
    const items = [
      makeWeekItem({ id: 1, date: daysAgo(1) }),
      makeWeekItem({ id: 2, date: daysAgo(1) }),
    ]
    const { container } = render(<ProductivityHeatmap weekItems={items} achievements={[]} />)
    expect(container.querySelector(`[title="${daysAgo(1)}: 2 taken"]`)).toBeTruthy()
  })

  it('marks achievement days with a trophy in the tooltip', () => {
    const { container } = render(
      <ProductivityHeatmap weekItems={[]} achievements={[makeAchievement({ date: daysAgo(2) })]} />
    )
    // jsdom's CSS-parser kan geen emoji in attribuutselectors aan — filter in JS
    const titles = Array.from(container.querySelectorAll('[title]')).map(el => el.getAttribute('title'))
    expect(titles).toContain(`${daysAgo(2)} 🏆`)
  })

  it('renders a cell for today', () => {
    const { container } = render(<ProductivityHeatmap weekItems={[]} achievements={[]} />)
    expect(container.querySelector(`[title="${daysAgo(0)}"]`)).toBeTruthy()
  })
})

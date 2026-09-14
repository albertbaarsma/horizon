import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { WeekItem } from '@/lib/types'
import { toLocalISODate, mondayOfWeek } from '@/lib/dates'

beforeEach(() => {
  vi.clearAllMocks()
  // geen weer in tests: laat de fetch falen, WeekTab vangt dat af
  global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as never
  Element.prototype.scrollIntoView = vi.fn()
})

const { WeekTab } = await import('@/app/dashboard/WeekTab')

/** Datum in het weekvenster dat WeekTab toont, relatief aan de maandag van deze week.
 *  Lokaal formatteren (net als WeekTab), anders klopt het net na middernacht niet. */
function dayInThisWeek(offsetDays: number): string {
  const d = mondayOfWeek(new Date())
  d.setDate(d.getDate() + offsetDays)
  return toLocalISODate(d)
}

/** De dagkaart van een datum. WeekTab rendert 6 weken, dus zoek altijd per datum. */
function dayCard(date: string): HTMLElement {
  const el = document.querySelector(`[data-date="${date}"]`)
  if (!el) throw new Error(`geen dagkaart voor ${date}`)
  return el as HTMLElement
}

function weekItem(overrides: Partial<WeekItem> = {}): WeekItem {
  return {
    id: 1, user_id: 'u', date: dayInThisWeek(0), type: 'task', text: 'Item',
    done: false, proj_id: null, task_id: null, recur_id: null, sort_order: 0, created_at: '',
    ...overrides,
  }
}

/** Een item op een datum, op zijn tekst gezocht. */
function itemIn(date: string, text: string): HTMLElement {
  const el = [...dayCard(date).querySelectorAll('div[draggable="true"]')].find(x => x.textContent?.includes(text))
  if (!el) throw new Error(`geen item "${text}" op ${date}`)
  return el as HTMLElement
}

function renderWeek(props: Partial<Parameters<typeof WeekTab>[0]> = {}) {
  render(
    <WeekTab
      items={[]} projects={[]}
      onToggle={vi.fn()} onMove={vi.fn()} onCtx={vi.fn()}
      onAddItem={vi.fn()} onOpenRecurModal={vi.fn()}
      onSwitchToMonth={vi.fn()} onOpenDetail={vi.fn()}
      {...props}
    />
  )
}

// Sinds herhalingen vooruit gematerialiseerd worden (lib/recurring.ts, zie
// __tests__/lib/recurring.test.ts) is een herhalende gelegenheid in WeekTab
// gewoon een week_item met recur_id gezet — geen apart "virtual"-rendering-
// pad meer, dus geen aparte sleep-/skip-/suppressie-logica hier te testen.
describe('WeekTab — een herhalend item is gewoon een normaal item', () => {
  it('toont het ↻-teken op een item met recur_id', () => {
    renderWeek({ items: [weekItem({ recur_id: 42, text: 'zz-Sporten' })] })
    const row = itemIn(dayInThisWeek(0), 'zz-Sporten')
    expect(row.textContent).toContain('↻')
  })

  it('toont geen ↻-teken op een gewoon item', () => {
    renderWeek({ items: [weekItem({ text: 'Losse taak' })] })
    const row = itemIn(dayInThisWeek(0), 'Losse taak')
    expect(row.textContent).not.toContain('↻')
  })

  it('is net als elk ander item sleepbaar naar een andere dag via het gewone onMove', () => {
    const monday = dayInThisWeek(0)
    const tuesday = dayInThisWeek(1)
    const onMove = vi.fn()
    const recur = weekItem({ id: 5, date: monday, recur_id: 42, text: 'zz-Sporten' })
    const other = weekItem({ id: 6, date: tuesday, text: 'Ander item' })
    renderWeek({ items: [recur, other], onMove })

    const dataTransfer = { effectAllowed: '' }
    fireEvent.dragStart(itemIn(monday, 'zz-Sporten'), { dataTransfer })
    fireEvent.dragOver(itemIn(tuesday, 'Ander item'), { dataTransfer })
    fireEvent.drop(itemIn(tuesday, 'Ander item'), { dataTransfer })

    expect(onMove).toHaveBeenCalledWith(5, tuesday)
  })

  it('de 🗑-knop roept gewoon onDeleteItem(id) aan, ook voor een herhalend item — die weet zelf hoe te skippen', () => {
    const onDeleteItem = vi.fn()
    renderWeek({ items: [weekItem({ id: 5, recur_id: 42, text: 'zz-Sporten' })], onDeleteItem })
    const row = itemIn(dayInThisWeek(0), 'zz-Sporten')
    fireEvent.click(row.querySelector('button[title="Verwijderen"]')!)
    expect(onDeleteItem).toHaveBeenCalledWith(5)
  })
})

describe('WeekTab — items binnen een dag herschikken', () => {
  it('slepen op een ander item binnen dezelfde dag herschikt (sort_order), verandert de datum niet', () => {
    const monday = dayInThisWeek(0)
    const onReorder = vi.fn()
    const a = weekItem({ id: 1, text: 'Item A', sort_order: 0 })
    const b = weekItem({ id: 2, text: 'Item B', sort_order: 1 })
    renderWeek({ items: [a, b], onReorder })

    const dataTransfer = { effectAllowed: '' }
    fireEvent.dragStart(itemIn(monday, 'Item A'), { dataTransfer })
    fireEvent.dragOver(itemIn(monday, 'Item B'), { dataTransfer })
    fireEvent.drop(itemIn(monday, 'Item B'), { dataTransfer })

    expect(onReorder).toHaveBeenCalledWith([{ id: 2, sort_order: 0 }, { id: 1, sort_order: 1 }])
  })

  it('slepen op een item van een ANDERE dag verplaatst het item (onMove), niet herschikken', () => {
    const monday = dayInThisWeek(0)
    const tuesday = dayInThisWeek(1)
    const onMove = vi.fn()
    const onReorder = vi.fn()
    const a = weekItem({ id: 1, date: monday, text: 'Item A' })
    const b = weekItem({ id: 2, date: tuesday, text: 'Item B' })
    renderWeek({ items: [a, b], onMove, onReorder })

    const dataTransfer = { effectAllowed: '' }
    fireEvent.dragStart(itemIn(monday, 'Item A'), { dataTransfer })
    fireEvent.dragOver(itemIn(tuesday, 'Item B'), { dataTransfer })
    fireEvent.drop(itemIn(tuesday, 'Item B'), { dataTransfer })

    expect(onMove).toHaveBeenCalledWith(1, tuesday)
    expect(onReorder).not.toHaveBeenCalled()
  })
})

describe('WeekTab — splitscherm-knop', () => {
  it('toont geen knop zonder onToggleSplit (gedrag blijft zoals voorheen)', () => {
    renderWeek()
    expect(screen.queryByRole('button', { name: /split/i })).toBeNull()
  })

  it('toont de knop met onToggleSplit, en roept die aan bij een klik', () => {
    const onToggleSplit = vi.fn()
    renderWeek({ onToggleSplit })
    fireEvent.click(screen.getByRole('button', { name: /split/i }))
    expect(onToggleSplit).toHaveBeenCalledTimes(1)
  })
})

describe('WeekTab — taak van buiten inplannen op een dag', () => {
  /** Zoals een echte browser-drag: de payload zit in dataTransfer, niet in lokale state. */
  function taakDataTransfer(taskId: number) {
    const store = new Map<string, string>([['application/x-albert-task', String(taskId)]])
    return {
      get types() { return [...store.keys()] },
      setData: (type: string, val: string) => { store.set(type, val) },
      getData: (type: string) => store.get(type) ?? '',
    }
  }

  it('roept onScheduleTask aan met (taskId, datum) bij een drop vanuit een ander component', () => {
    const onScheduleTask = vi.fn()
    renderWeek({ onScheduleTask })
    const monday = dayInThisWeek(0)
    const dataTransfer = taakDataTransfer(99)
    fireEvent.dragOver(dayCard(monday), { dataTransfer })
    fireEvent.drop(dayCard(monday), { dataTransfer })
    expect(onScheduleTask).toHaveBeenCalledWith(99, monday)
  })

  it('doet niets zonder onScheduleTask (gedrag blijft zoals voorheen)', () => {
    renderWeek()
    const monday = dayInThisWeek(0)
    const dataTransfer = taakDataTransfer(99)
    // Mag niet crashen, en er is niets om te verifiëren behalve dat dit geen error gooit
    expect(() => {
      fireEvent.dragOver(dayCard(monday), { dataTransfer })
      fireEvent.drop(dayCard(monday), { dataTransfer })
    }).not.toThrow()
  })
})

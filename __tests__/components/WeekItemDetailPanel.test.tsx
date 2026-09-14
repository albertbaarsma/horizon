import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { RecurringTask, WeekItem } from '@/lib/types'
import { WeekItemDetailPanel, type DetailPanelState } from '@/app/dashboard/WeekTab'

const rt: RecurringTask = {
  id: 42, user_id: 'u', name: 'zz-Sporten', type: 'sport',
  days: ['monday'], cat_id: null, proj_id: null, active: true, created_at: '',
}

function baseProps(panel: DetailPanelState) {
  return {
    panel,
    categories: [],
    projects: [],
    goals: [],
    recurringTasks: [rt],
    tasks: [],
    onClose: vi.fn(),
    onToggle: vi.fn(),
    onDeleteItem: vi.fn(),
    onDeleteRecur: vi.fn(),
    onMakeOneTime: vi.fn(),
    onMakeRecurring: vi.fn(),
    onLinkCat: vi.fn(),
    onGotoVisie: vi.fn(),
    onAddSuggestion: vi.fn().mockResolvedValue(true),
  }
}

function recurItem(overrides: Partial<WeekItem> = {}): WeekItem {
  return {
    id: 7, user_id: 'u', date: '2026-09-03', type: 'sport', text: 'zz-Sporten',
    done: false, proj_id: null, task_id: null, recur_id: 42, created_at: '',
    ...overrides,
  }
}

// Sinds herhalingen vooruit gematerialiseerd worden (lib/recurring.ts) is een
// "gelegenheid" altijd gewoon een echt week_item met recur_id gezet — er is
// geen apart 'virtual'-geval meer om te testen.
describe('WeekItemDetailPanel — herhaaltaak-beheer', () => {
  it('toont bij een herhalend item zowel "overslaan" als "hele herhaling verwijderen"', () => {
    const props = baseProps({ item: recurItem(), date: '2026-09-03' })
    const { getByText } = render(<WeekItemDetailPanel {...props} />)
    expect(getByText(/Deze dag overslaan/)).toBeTruthy()
    expect(getByText(/Verwijder herhaaltaak \(stopt alle herhaling\)/)).toBeTruthy()
  })

  it('"Deze dag overslaan" roept gewoon onDeleteItem(item.id) aan — die weet zelf dat het een herhaling is', () => {
    const props = baseProps({ item: recurItem(), date: '2026-09-03' })
    const { getByText } = render(<WeekItemDetailPanel {...props} />)
    fireEvent.click(getByText(/Deze dag overslaan/))
    expect(props.onDeleteItem).toHaveBeenCalledWith(7)
    expect(props.onClose).toHaveBeenCalled()
  })

  it('"Verwijder herhaaltaak" roept onDeleteRecur(recur_id) aan', () => {
    const props = baseProps({ item: recurItem(), date: '2026-09-03' })
    const { getByText } = render(<WeekItemDetailPanel {...props} />)
    fireEvent.click(getByText(/Verwijder herhaaltaak \(stopt alle herhaling\)/))
    expect(props.onDeleteRecur).toHaveBeenCalledWith(42)
    expect(props.onClose).toHaveBeenCalled()
  })

  it('toont geen herhaaltaak-beheer voor een gewoon (niet-herhalend) item, wel een "van herhaling maken"-optie', () => {
    const item: WeekItem = {
      id: 8, user_id: 'u', date: '2026-09-03', type: 'task', text: 'Losse taak',
      done: false, proj_id: null, task_id: null, recur_id: null, created_at: '',
    }
    const props = baseProps({ item, date: '2026-09-03' })
    const { queryByText, getByText } = render(<WeekItemDetailPanel {...props} />)
    expect(queryByText(/Deze dag overslaan/)).toBeNull()
    expect(queryByText(/HERHAALTAAK BEHEER/)).toBeNull()
    expect(getByText(/Van herhaling maken/)).toBeTruthy()
  })

  it('opent een dag-kiezer en roept onMakeRecurring(item, days) aan bij bevestigen', () => {
    const item: WeekItem = {
      id: 9, user_id: 'u', date: '2026-09-08', type: 'task', text: 'Losse taak', // 2026-09-08 is een dinsdag
      done: false, proj_id: null, task_id: null, recur_id: null, created_at: '',
    }
    const props = baseProps({ item, date: '2026-09-08' })
    const { getByText } = render(<WeekItemDetailPanel {...props} />)
    fireEvent.click(getByText(/Van herhaling maken/))
    fireEvent.click(getByText(/Maak herhalend/))
    expect(props.onMakeRecurring).toHaveBeenCalledWith(item, ['tuesday'])
  })
})

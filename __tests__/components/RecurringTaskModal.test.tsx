import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecurringTaskModal } from '@/app/dashboard/RecurringTaskModal'
import type { RecurringTask } from '@/lib/types'

function recur(overrides: Partial<RecurringTask> = {}): RecurringTask {
  return {
    id: 1, user_id: 'u', name: 'Sporten', type: 'sport', days: ['monday'],
    cat_id: null, proj_id: null, active: true, created_at: '', ...overrides,
  }
}

function baseProps(overrides: Partial<Parameters<typeof RecurringTaskModal>[0]> = {}) {
  return {
    allTasks: [] as RecurringTask[], categories: [],
    onToggle: vi.fn(), onDelete: vi.fn(), onCreate: vi.fn(), onClose: vi.fn(),
    ...overrides,
  }
}

describe('RecurringTaskModal — omzetten naar losse taak', () => {
  it('toont geen "→ taak"-knop zonder onConvertToTask (gedrag blijft zoals voorheen)', () => {
    render(<RecurringTaskModal {...baseProps({ allTasks: [recur()] })} />)
    expect(screen.queryByText('→ taak')).toBeNull()
  })

  it('roept onConvertToTask aan met de herhaaltaak bij een klik', () => {
    const onConvertToTask = vi.fn()
    const rt = recur({ id: 5, name: 'Sportschool' })
    render(<RecurringTaskModal {...baseProps({ allTasks: [rt], onConvertToTask })} />)
    fireEvent.click(screen.getByText('→ taak'))
    expect(onConvertToTask).toHaveBeenCalledWith(expect.objectContaining({ id: 5, name: 'Sportschool' }))
  })

  it('roept niet ook onDelete of onToggle aan bij het omzetten', () => {
    const onConvertToTask = vi.fn()
    const onDelete = vi.fn()
    const onToggle = vi.fn()
    render(<RecurringTaskModal {...baseProps({ allTasks: [recur()], onConvertToTask, onDelete, onToggle })} />)
    fireEvent.click(screen.getByText('→ taak'))
    expect(onDelete).not.toHaveBeenCalled()
    expect(onToggle).not.toHaveBeenCalled()
  })
})

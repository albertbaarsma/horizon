import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Task, WeekItem } from '@/lib/types'
import { WeekItemDetailPanel } from '@/app/dashboard/WeekTab'

const taak: Task = {
  id: 175, user_id: 'u', proj_id: null, name: 'Financieel overzicht', status: 'backlog',
  urgent: false, priority: 0, notes: 'bunq bekijken', created_at: '', updated_at: '',
}

function item(task_id: string | null): WeekItem {
  return { id: 9, user_id: 'u', date: '2026-09-15', type: 'task', text: 'Financiële sessie', done: false, proj_id: null, task_id, recur_id: null, created_at: '' }
}

function props(task_id: string | null, onSetTaskNotes = vi.fn()) {
  return {
    panel: { item: item(task_id), date: '2026-09-15' },
    categories: [], projects: [], goals: [], recurringTasks: [], tasks: [taak],
    onClose: vi.fn(), onToggle: vi.fn(), onDeleteItem: vi.fn(), onDeleteRecur: vi.fn(),
    onMakeOneTime: vi.fn(), onMakeRecurring: vi.fn(), onLinkCat: vi.fn(), onGotoVisie: vi.fn(),
    onAddSuggestion: vi.fn().mockResolvedValue(true), onSetTaskNotes,
  }
}

describe('WeekItemDetailPanel — notities', () => {
  it('toont de notities van de gekoppelde taak en slaat een wijziging op', () => {
    const onSetTaskNotes = vi.fn()
    render(<WeekItemDetailPanel {...props('175', onSetTaskNotes)} />)
    const veld = screen.getByLabelText('Notities bij deze taak') as HTMLTextAreaElement
    expect(veld.value).toBe('bunq bekijken')
    fireEvent.change(veld, { target: { value: 'bunq bekijken, en wat mam en Rein nog krijgen' } })
    fireEvent.blur(veld)
    expect(onSetTaskNotes).toHaveBeenCalledWith(175, 'bunq bekijken, en wat mam en Rein nog krijgen')
  })

  it('slaat niets op als de notities niet veranderd zijn', () => {
    const onSetTaskNotes = vi.fn()
    render(<WeekItemDetailPanel {...props('175', onSetTaskNotes)} />)
    fireEvent.blur(screen.getByLabelText('Notities bij deze taak'))
    expect(onSetTaskNotes).not.toHaveBeenCalled()
  })

  it('toont geen notitieveld bij een item zonder gekoppelde taak', () => {
    render(<WeekItemDetailPanel {...props(null)} />)
    expect(screen.queryByLabelText('Notities bij deze taak')).not.toBeInTheDocument()
  })
})

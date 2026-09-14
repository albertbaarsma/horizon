import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { TasksTab } from '@/app/dashboard/TasksTab'
import type { Task } from '@/lib/types'

function task(id: number, name: string, status: Task['status'] = 'backlog'): Task {
  return { id, user_id: 'u', proj_id: null, name, status, urgent: false, priority: 0, sort_order: 0, created_at: '', updated_at: '' }
}

function baseProps(tasks: Task[], plannedDates?: Map<number, string>) {
  return { tasks, projects: [], categories: [], onUpdate: vi.fn(), onTaskClick: vi.fn(), onMoveHorizon: vi.fn(), onReorder: vi.fn(), plannedDates }
}

/** De Kanban-kolom waar dit kopje bovenaan staat. */
function kolom(label: string): HTMLElement {
  return screen.getByText(label).closest('div')!.parentElement as HTMLElement
}

describe('TasksTab — ingeplande taken verplaatsen, niet kopiëren', () => {
  it('zet een ingeplande backlog-taak in Ingepland en haalt hem uit Backlog', () => {
    render(<TasksTab {...baseProps([task(1, 'Marktplaats'), task(2, 'Nog doen')], new Map([[1, '2026-09-14']]))} />)
    expect(within(kolom('Ingepland')).getByText('Marktplaats')).toBeInTheDocument()
    expect(within(kolom('Backlog')).queryByText('Marktplaats')).not.toBeInTheDocument()
    expect(within(kolom('Backlog')).getByText('Nog doen')).toBeInTheDocument()
    expect(screen.getByText('📅 ma 14 sep')).toBeInTheDocument()
  })

  it('laat een ingeplande taak die al bezig is in Bezig staan, met de dag erbij', () => {
    render(<TasksTab {...baseProps([task(1, 'Opname', 'doing')], new Map([[1, '2026-09-15']]))} />)
    expect(within(kolom('Bezig')).getByText('Opname')).toBeInTheDocument()
    expect(screen.queryByText('Ingepland')).not.toBeInTheDocument()
    expect(screen.getByText('📅 di 15 sep')).toBeInTheDocument()
  })

  it('werkt zonder plannedDates zoals voorheen', () => {
    render(<TasksTab {...baseProps([task(1, 'Marktplaats')])} />)
    expect(screen.queryByText('Ingepland')).not.toBeInTheDocument()
    expect(within(kolom('Backlog')).getByText('Marktplaats')).toBeInTheDocument()
  })

  it('toont in de Lijst een aparte groep Ingepland', () => {
    render(<TasksTab {...baseProps([task(1, 'Marktplaats'), task(2, 'Nog doen')], new Map([[1, '2026-09-14']]))} />)
    fireEvent.click(screen.getByRole('button', { name: /lijst/i }))
    expect(screen.getByText('Ingepland').textContent).toContain('(1)')
    expect(screen.getByText('Backlog').textContent).toContain('(1)')
    expect(screen.getByText('📅 ma 14 sep')).toBeInTheDocument()
  })
})

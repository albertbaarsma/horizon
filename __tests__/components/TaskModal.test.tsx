import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskModal } from '@/app/dashboard/TaskModal'
import type { Task } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  }),
}))

function task(overrides: Partial<Task> = {}): Task {
  return { id: 1, user_id: 'u', proj_id: 'p1', name: 'Testtaak', status: 'backlog', urgent: false, priority: 0, created_at: '', updated_at: '', ...overrides }
}

function setup(overrides: Partial<Task> = {}) {
  const onSetPriority = vi.fn()
  const utils = render(
    <TaskModal task={task(overrides)} project={null} category={null} allProjects={[]}
      onClose={vi.fn()} onUpdate={vi.fn()} onSetDuration={vi.fn()} onSetPriority={onSetPriority}
      onSetNotes={vi.fn()} onSetSubtasks={vi.fn()} onSetDeadline={vi.fn()} onAssignProject={vi.fn()} onStartFocus={vi.fn()} />
  )
  return { onSetPriority, ...utils }
}

describe('TaskModal — omzetten naar herhaaltaak', () => {
  it('toont geen "Herhaling"-knop zonder onConvertToRecurring (gedrag blijft zoals voorheen)', () => {
    render(<TaskModal task={task()} project={null} category={null} allProjects={[]}
      onClose={vi.fn()} onUpdate={vi.fn()} onSetDuration={vi.fn()} onSetPriority={vi.fn()}
      onSetNotes={vi.fn()} onSetSubtasks={vi.fn()} onSetDeadline={vi.fn()} onAssignProject={vi.fn()} onStartFocus={vi.fn()} />)
    expect(screen.queryByText(/Maak hier een herhaaltaak van/)).toBeNull()
  })

  it('toont een dagenkiezer na klikken op de knop, submit-knop staat uit zonder gekozen dag', () => {
    render(<TaskModal task={task()} project={null} category={null} allProjects={[]}
      onClose={vi.fn()} onUpdate={vi.fn()} onSetDuration={vi.fn()} onSetPriority={vi.fn()}
      onSetNotes={vi.fn()} onSetSubtasks={vi.fn()} onSetDeadline={vi.fn()} onAssignProject={vi.fn()} onStartFocus={vi.fn()}
      onConvertToRecurring={vi.fn()} />)
    fireEvent.click(screen.getByText(/Maak hier een herhaaltaak van/))
    expect(screen.getByText('Ma')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Omzetten naar herhaling' })).toBeDisabled()
  })

  it('roept onConvertToRecurring aan met de taak en gekozen dagen, en sluit de modal', () => {
    const onConvertToRecurring = vi.fn()
    const onClose = vi.fn()
    render(<TaskModal task={task({ id: 7, name: 'Sportschool' })} project={null} category={null} allProjects={[]}
      onClose={onClose} onUpdate={vi.fn()} onSetDuration={vi.fn()} onSetPriority={vi.fn()}
      onSetNotes={vi.fn()} onSetSubtasks={vi.fn()} onSetDeadline={vi.fn()} onAssignProject={vi.fn()} onStartFocus={vi.fn()}
      onConvertToRecurring={onConvertToRecurring} />)
    fireEvent.click(screen.getByText(/Maak hier een herhaaltaak van/))
    fireEvent.click(screen.getByText('Ma'))
    fireEvent.click(screen.getByText('Wo'))
    fireEvent.click(screen.getByRole('button', { name: 'Omzetten naar herhaling' }))
    expect(onConvertToRecurring).toHaveBeenCalledWith(expect.objectContaining({ id: 7, name: 'Sportschool' }), ['monday', 'wednesday'])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('annuleren verbergt de dagenkiezer weer, zonder iets aan te roepen', () => {
    const onConvertToRecurring = vi.fn()
    render(<TaskModal task={task()} project={null} category={null} allProjects={[]}
      onClose={vi.fn()} onUpdate={vi.fn()} onSetDuration={vi.fn()} onSetPriority={vi.fn()}
      onSetNotes={vi.fn()} onSetSubtasks={vi.fn()} onSetDeadline={vi.fn()} onAssignProject={vi.fn()} onStartFocus={vi.fn()}
      onConvertToRecurring={onConvertToRecurring} />)
    fireEvent.click(screen.getByText(/Maak hier een herhaaltaak van/))
    fireEvent.click(screen.getByText('Ma'))
    fireEvent.click(screen.getByText('Annuleer'))
    expect(screen.queryByText('Omzetten naar herhaling')).toBeNull()
    expect(onConvertToRecurring).not.toHaveBeenCalled()
  })
})

describe('TaskModal — prioriteit', () => {
  it('toont "geen" als er geen prioriteit gezet is', () => {
    setup({ priority: 0 })
    expect(screen.getByLabelText('Taakprioriteit')).toHaveValue('0')
    expect(screen.queryByText(/🔺 P/)).not.toBeInTheDocument()
  })

  it('toont het prioriteitsbadge als er wel een prioriteit gezet is', () => {
    setup({ priority: 3 })
    expect(screen.getByLabelText('Taakprioriteit')).toHaveValue('3')
    expect(screen.getByText('🔺 P3')).toBeInTheDocument()
  })

  it('roept onSetPriority aan met het gekozen cijfer', () => {
    const { onSetPriority } = setup({ priority: 0 })
    fireEvent.change(screen.getByLabelText('Taakprioriteit'), { target: { value: '4' } })
    expect(onSetPriority).toHaveBeenCalledWith(1, 4)
  })
})

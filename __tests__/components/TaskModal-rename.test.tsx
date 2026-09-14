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

function renderModal(onRename?: (id: number, name: string) => void) {
  return render(
    <TaskModal task={task()} project={null} category={null} allProjects={[]}
      onClose={vi.fn()} onUpdate={vi.fn()} onSetDuration={vi.fn()} onSetPriority={vi.fn()}
      onSetNotes={vi.fn()} onSetSubtasks={vi.fn()} onSetDeadline={vi.fn()} onAssignProject={vi.fn()} onStartFocus={vi.fn()}
      onRename={onRename} />
  )
}

describe('TaskModal — titel hernoemen', () => {
  it('maakt de titel bewerkbaar na een klik en slaat de nieuwe naam op', () => {
    const onRename = vi.fn()
    renderModal(onRename)
    fireEvent.click(screen.getByTitle('Klik om te hernoemen'))
    const input = screen.getByLabelText('Taaknaam')
    fireEvent.change(input, { target: { value: 'Spullen op Marktplaats' } })
    fireEvent.blur(input)
    expect(onRename).toHaveBeenCalledWith(1, 'Spullen op Marktplaats')
  })

  it('slaat niets op als de naam leeg of ongewijzigd is', () => {
    const onRename = vi.fn()
    renderModal(onRename)
    fireEvent.click(screen.getByTitle('Klik om te hernoemen'))
    const input = screen.getByLabelText('Taaknaam')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)
    expect(onRename).not.toHaveBeenCalled()
  })

  it('Escape zet de oude naam terug zonder op te slaan', () => {
    const onRename = vi.fn()
    renderModal(onRename)
    fireEvent.click(screen.getByTitle('Klik om te hernoemen'))
    const input = screen.getByLabelText('Taaknaam')
    fireEvent.change(input, { target: { value: 'Iets anders' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Taaknaam')).not.toBeInTheDocument()
  })

  it('zonder onRename blijft de titel gewone tekst', () => {
    renderModal()
    expect(screen.queryByTitle('Klik om te hernoemen')).not.toBeInTheDocument()
  })
})

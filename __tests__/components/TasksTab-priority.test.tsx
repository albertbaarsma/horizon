import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TasksTab } from '@/app/dashboard/TasksTab'
import { TASK_MIME } from '@/lib/drag-mime'
import type { Task } from '@/lib/types'

function task(id: number, name: string, priority: number, sortOrder = 0): Task {
  return { id, user_id: 'u', proj_id: null, name, status: 'backlog', urgent: false, priority, sort_order: sortOrder, created_at: '', updated_at: '' }
}

function baseProps(tasks: Task[], extra: Partial<React.ComponentProps<typeof TasksTab>> = {}) {
  return { tasks, projects: [], categories: [], onUpdate: vi.fn(), onTaskClick: vi.fn(), onMoveHorizon: vi.fn(), onReorder: vi.fn(), ...extra }
}

describe('TasksTab — sortering', () => {
  it('toont taken binnen een kolom op sort_order, niet meer op prioriteit', () => {
    // Bewuste gedragswijziging: de volgorde is nu handmatig (slepen), prioriteit
    // blijft alleen nog een badge/filter — zie Task.priority in lib/types.ts.
    const tasks = [
      task(1, 'Laag', 1, 2),
      task(2, 'Hoog', 5, 0),
      task(3, 'Geen', 0, 3),
      task(4, 'Middel', 3, 1),
    ]
    render(<TasksTab {...baseProps(tasks)} />)
    const names = screen.getAllByText(/^(Laag|Hoog|Geen|Middel)$/).map(el => el.textContent)
    expect(names).toEqual(['Hoog', 'Middel', 'Laag', 'Geen'])
  })

  it('toont een prioriteitsbadge op de kaart', () => {
    render(<TasksTab {...baseProps([task(1, 'Belangrijk', 4)])} />)
    expect(screen.getByText('🔺 P4')).toBeInTheDocument()
  })

  it('toont geen badge zonder prioriteit', () => {
    render(<TasksTab {...baseProps([task(1, 'Gewoon', 0)])} />)
    expect(screen.queryByText(/🔺/)).not.toBeInTheDocument()
  })

  it('slepen op een andere kaart binnen dezelfde Kanban-kolom herschikt (sort_order)', () => {
    const onReorder = vi.fn()
    const tasks = [task(1, 'Eerste', 0, 0), task(2, 'Tweede', 0, 1)]
    render(<TasksTab {...baseProps(tasks, { onReorder })} />)
    const kaartEerste = screen.getByText('Eerste').closest('div[draggable="true"]')!
    const kaartTweede = screen.getByText('Tweede').closest('div[draggable="true"]')!
    const dataTransfer = { types: [] as string[], data: {} as Record<string,string>, setData(t:string,v:string){this.data[t]=v;this.types.push(t)}, getData(t:string){return this.data[t]??''} }
    fireEvent.dragStart(kaartEerste, { dataTransfer })
    fireEvent.dragOver(kaartTweede, { dataTransfer })
    fireEvent.drop(kaartTweede, { dataTransfer })
    expect(onReorder).toHaveBeenCalledWith([{ id: 2, sort_order: 0 }, { id: 1, sort_order: 1 }])
  })
})

describe('TasksTab — taak slepen naar buiten (bv. een dag in Week)', () => {
  function dataTransferMock() {
    const store = new Map<string, string>()
    return {
      effectAllowed: '',
      setData: (type: string, val: string) => { store.set(type, val) },
      getData: (type: string) => store.get(type) ?? '',
    }
  }

  it('zet de taak-id op TASK_MIME bij het slepen van een Kanban-kaart', () => {
    render(<TasksTab {...baseProps([task(1, 'Sleepbaar', 0)])} />)
    const kaart = screen.getByText('Sleepbaar').closest('div[draggable="true"]')!
    const dataTransfer = dataTransferMock()
    fireEvent.dragStart(kaart, { dataTransfer })
    expect(dataTransfer.getData(TASK_MIME)).toBe('1')
  })

  it('zet de taak-id op TASK_MIME bij het slepen van een Lijst-rij', () => {
    render(<TasksTab {...baseProps([task(1, 'Sleepbaar', 0)])} />)
    fireEvent.click(screen.getByRole('button', { name: /lijst/i }))
    const rij = screen.getByText('Sleepbaar').closest('div[draggable="true"]')!
    const dataTransfer = dataTransferMock()
    fireEvent.dragStart(rij, { dataTransfer })
    expect(dataTransfer.getData(TASK_MIME)).toBe('1')
  })
})

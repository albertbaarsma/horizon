import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TasksTab } from '@/app/dashboard/TasksTab'
import type { Task, Project, GoalHorizon } from '@/lib/types'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1, user_id: 'u', proj_id: null, name: 'Taak', status: 'backlog',
    urgent: false, priority: 0, horizon: null, created_at: '', updated_at: '',
    ...overrides,
  }
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1', user_id: 'u', cat_id: 'c1', name: 'Project', emoji: '📁', status: 'actief',
    description: '', vision: '', proj_type: 'project', notes: null, html_content: null,
    is_priority: false, sort_order: 0, created_at: '', updated_at: '',
    ...overrides,
  }
}

const CATS = [{ id: 'c1', name: 'Gezondheid' }]

function baseProps(tasks: Task[], extra: Partial<React.ComponentProps<typeof TasksTab>> = {}) {
  return {
    tasks, projects: [] as Project[], categories: CATS,
    onUpdate: vi.fn(), onTaskClick: vi.fn(), onMoveHorizon: vi.fn(), onReorder: vi.fn(),
    ...extra,
  }
}

describe('TasksTab — horizon-weergave', () => {
  beforeEach(() => { localStorage.removeItem('taken-weergave') })

  it('start standaard in Kanban', () => {
    render(<TasksTab {...baseProps([task()])} />)
    expect(screen.getByText('Backlog')).toBeTruthy()
    expect(screen.queryByText(/Nog niet ingedeeld/)).toBeNull()
  })

  it('wisselt naar de horizon-weergave via de knop', () => {
    render(<TasksTab {...baseProps([task({ horizon: 'jaar' })])} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(screen.queryByText('Backlog')).toBeNull()
    expect(screen.getByText(/Nog niet ingedeeld/)).toBeTruthy()
  })

  it('onthoudt de gekozen weergave in localStorage', () => {
    const { unmount } = render(<TasksTab {...baseProps([])} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(localStorage.getItem('taken-weergave')).toBe('horizon')
    unmount()
    render(<TasksTab {...baseProps([])} />)
    expect(screen.getByText(/Nog niet ingedeeld/)).toBeTruthy()
  })

  it('toont alle 10 horizon-kolommen, ook leeg', () => {
    render(<TasksTab {...baseProps([])} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    for (const h of ['nu', 'wk', '6w', 'kwartaal', 'jaar', '2-4jr']) {
      expect(document.querySelector(`[data-horizon="${h}"]`)).toBeTruthy()
    }
    fireEvent.click(screen.getByText(/Lange termijn/))
    for (const h of ['5-9jr', '10jr+', 'doorlopend', 'ooit']) {
      expect(document.querySelector(`[data-horizon="${h}"]`)).toBeTruthy()
    }
  })

  it('toont een taak zonder horizon onder "Nog niet ingedeeld"', () => {
    render(<TasksTab {...baseProps([task({ name: 'Losse taak', horizon: null })])} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(screen.getByText(/Nog niet ingedeeld/)).toBeTruthy()
    expect(screen.getByText('Losse taak')).toBeTruthy()
  })

  it('groepeert een taak met horizon in zijn eigen kolom — "Nog niet ingedeeld" blijft op 0 staan', () => {
    render(<TasksTab {...baseProps([task({ name: 'Kwartaaltaak', horizon: 'kwartaal' })])} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(document.querySelector('[data-horizon="kwartaal"]')?.textContent).toContain('Kwartaaltaak')
    expect(screen.getByText(/Nog niet ingedeeld \(0\)/)).toBeTruthy()
  })

  it('laat een klaar-gezette taak niet meer zien — dit is een vooruitkijk-weergave, geen archief', () => {
    render(<TasksTab {...baseProps([task({ name: 'Gedaan', status: 'done', horizon: 'jaar' })])} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(screen.queryByText('Gedaan')).toBeNull()
  })

  it('toont het gekoppelde project als chip, in de kleur van zijn levensgebied', () => {
    const proj = project({ id: 'p1', cat_id: 'c1', name: 'Sporten', emoji: '💪' })
    render(<TasksTab {...baseProps([task({ name: 'Hardlopen', proj_id: 'p1', horizon: 'wk' })], { projects: [proj] })} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(screen.getByText(/Sporten/)).toBeTruthy()
  })

  it('slepen naar een andere horizon-kolom werkt via onMoveHorizon', async () => {
    const onMoveHorizon = vi.fn()
    render(<TasksTab {...baseProps([task({ id: 5, name: 'Verplaatsbaar', horizon: 'kwartaal' })], { onMoveHorizon })} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))

    const kaart = [...document.querySelectorAll('div[draggable="true"]')].find(el => el.textContent?.includes('Verplaatsbaar'))!
    const dataTransfer = {
      types: [] as string[], data: {} as Record<string, string>,
      setData(type: string, val: string) { this.data[type] = val; this.types.push(type) },
      getData(type: string) { return this.data[type] ?? '' },
    }
    fireEvent.dragStart(kaart, { dataTransfer })
    const doel = document.querySelector('[data-horizon="jaar"]')!
    fireEvent.dragOver(doel, { dataTransfer })
    fireEvent.drop(doel, { dataTransfer })

    await waitFor(() => expect(onMoveHorizon).toHaveBeenCalledWith(5, 'jaar' as GoalHorizon))
  })

  it('slepen terug naar "Nog niet ingedeeld" roept onMoveHorizon aan met null', async () => {
    const onMoveHorizon = vi.fn()
    render(<TasksTab {...baseProps([task({ id: 7, name: 'Heroverwegen', horizon: 'kwartaal' })], { onMoveHorizon })} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))

    const kaart = document.querySelector('[data-horizon="kwartaal"] div[draggable="true"]')!
    const dataTransfer = {
      types: [] as string[], data: {} as Record<string, string>,
      setData(type: string, val: string) { this.data[type] = val; this.types.push(type) },
      getData(type: string) { return this.data[type] ?? '' },
    }
    fireEvent.dragStart(kaart, { dataTransfer })
    const inbox = screen.getByText(/sleep naar een horizon hieronder/).closest('div')!.parentElement!
    fireEvent.dragOver(inbox, { dataTransfer })
    fireEvent.drop(inbox, { dataTransfer })

    await waitFor(() => expect(onMoveHorizon).toHaveBeenCalledWith(7, null))
  })

  it('afvinken vanuit de horizon-kaart roept onUpdate aan met status "done"', () => {
    const onUpdate = vi.fn()
    render(<TasksTab {...baseProps([task({ id: 9, name: 'Afvinkbaar', horizon: 'wk' })], { onUpdate })} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    fireEvent.click(screen.getByLabelText('Afvinken: Afvinkbaar'))
    expect(onUpdate).toHaveBeenCalledWith(9, 'done')
  })

  it('een taak met een deadline dichtbij staat in Nu, ook al staat het opgeslagen horizon op jaar', () => {
    const dichtbij = new Date(Date.now() + 2*86400000).toISOString().slice(0,10)
    render(<TasksTab {...baseProps([task({ name: 'Dichtbij', horizon: 'jaar', deadline: dichtbij })])} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(document.querySelector('[data-horizon="nu"]')?.textContent).toContain('Dichtbij')
    expect(document.querySelector('[data-horizon="jaar"]')?.textContent).not.toContain('Dichtbij')
  })

  it('toont de deadline op de kaart, met ⚠ als hij al voorbij is', () => {
    const teLaat = new Date(Date.now() - 3*86400000).toISOString().slice(0,10)
    render(<TasksTab {...baseProps([task({ name: 'Te laat', horizon: 'jaar', deadline: teLaat })])} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(document.querySelector('[data-horizon="nu"]')?.textContent).toContain('⚠')
  })

  it('toont een verschoven-icoon als de deadline later is dan de oorspronkelijke', () => {
    const vandaag = new Date().toISOString().slice(0,10)
    const dichtbij = new Date(Date.now() + 2*86400000).toISOString().slice(0,10)   // binnen 7 dagen: blijft in Nu
    render(<TasksTab {...baseProps([task({ name: 'Verschoven', horizon: 'nu', deadline: dichtbij, original_deadline: vandaag })])} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(document.querySelector('[data-horizon="nu"]')?.textContent).toContain('🔀')
  })

  it('zet ook het algemene TASK_MIME bij het slepen van een horizon-kaart, voor dropzones buiten Taken (bv. een dag in Week)', async () => {
    const { TASK_MIME } = await import('@/lib/drag-mime')
    render(<TasksTab {...baseProps([task({ id: 3, name: 'Naar Week te slepen', horizon: 'wk' })])} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    const kaart = [...document.querySelectorAll('div[draggable="true"]')].find(el => el.textContent?.includes('Naar Week te slepen'))!
    const store = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: '',
      setData: (type: string, val: string) => { store.set(type, val) },
      getData: (type: string) => store.get(type) ?? '',
    }
    fireEvent.dragStart(kaart, { dataTransfer })
    expect(dataTransfer.getData(TASK_MIME)).toBe('3')
  })

  it('slepen op een andere kaart binnen dezelfde horizon herschikt (sort_order), verandert de horizon niet', () => {
    const onReorder = vi.fn()
    const a = task({ id: 10, name: 'Taak A', horizon: 'kwartaal', sort_order: 0 })
    const b = task({ id: 11, name: 'Taak B', horizon: 'kwartaal', sort_order: 1 })
    render(<TasksTab {...baseProps([a, b], { onReorder })} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))

    const kaartA = [...document.querySelectorAll('div[draggable="true"]')].find(el => el.textContent?.includes('Taak A'))!
    const kaartB = [...document.querySelectorAll('div[draggable="true"]')].find(el => el.textContent?.includes('Taak B'))!
    const dataTransfer = {
      types: [] as string[], data: {} as Record<string, string>,
      setData(type: string, val: string) { this.data[type] = val; this.types.push(type) },
      getData(type: string) { return this.data[type] ?? '' },
    }
    fireEvent.dragStart(kaartA, { dataTransfer })
    fireEvent.dragOver(kaartB, { dataTransfer })
    fireEvent.drop(kaartB, { dataTransfer })

    expect(onReorder).toHaveBeenCalledWith([{ id: 11, sort_order: 0 }, { id: 10, sort_order: 1 }])
  })
})

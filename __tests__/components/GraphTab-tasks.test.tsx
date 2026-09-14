import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GraphDetailPanel } from '@/app/dashboard/GraphTab'
import type { Task, Project } from '@/lib/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const cats = [{ id: 'werk', name: 'Werk' }, { id: 'thuis', name: 'Thuis' }]

function proj(id: string, cat: string, name = id): Project {
  return {
    id, user_id: 'u', cat_id: cat, name, emoji: '🎯', status: 'actief', description: '', vision: '',
    proj_type: 'project', notes: null, html_content: null, is_priority: false, sort_order: 0,
    created_at: '', updated_at: '',
  }
}
function task(id: number, projId: string | null, name = `taak ${id}`): Task {
  return { id, user_id: 'u', proj_id: projId, name, status: 'backlog', urgent: false, priority: 0, created_at: '', updated_at: '' }
}

const created = (name: string) => task(99, 'acme-co', name)

function panel(props: Partial<React.ComponentProps<typeof GraphDetailPanel>> = {}) {
  const base: React.ComponentProps<typeof GraphDetailPanel> = {
    selected: { kind: 'proj', id: 'acme-co' },
    projects: [proj('acme-co', 'werk', 'Acme Co'), proj('website', 'werk', 'Website')],
    categories: cats,
    tasks: [task(1, 'acme-co', 'Setlist maken')],
    weekItems: [],
    onClose: vi.fn(),
    onPick: vi.fn(),
    onOpenProject: vi.fn(),
    ...props,
  }
  return { ...render(<GraphDetailPanel {...base} />), props: base }
}

// ── Taak toevoegen vanuit een project ─────────────────────────────────────────

describe('GraphDetailPanel — taak toevoegen bij een project', () => {
  it('laat geen toevoeg-veld zien als de kaart alleen-lezen is', () => {
    panel()
    expect(screen.queryByLabelText('Nieuwe taak')).not.toBeInTheDocument()
  })

  it('voegt de taak toe aan het geopende project', async () => {
    const onAddTask = vi.fn().mockResolvedValue(created('Piano stemmen'))
    panel({ onAddTask })

    fireEvent.change(screen.getByLabelText('Nieuwe taak'), { target: { value: 'Piano stemmen' } })
    fireEvent.click(screen.getByRole('button', { name: /Taak toevoegen/ }))

    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith('Piano stemmen', 'acme-co'))
    expect(await screen.findByText(/toegevoegd/)).toBeInTheDocument()
  })

  it('maakt het veld leeg na toevoegen, zodat je door kunt typen', async () => {
    const onAddTask = vi.fn().mockResolvedValue(created('Piano stemmen'))
    panel({ onAddTask })
    const input = screen.getByLabelText('Nieuwe taak') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Piano stemmen' } })
    fireEvent.click(screen.getByRole('button', { name: /Taak toevoegen/ }))
    await waitFor(() => expect(input.value).toBe(''))
  })

  it('haalt witruimte weg voor het opslaan', async () => {
    const onAddTask = vi.fn().mockResolvedValue(created('Piano stemmen'))
    panel({ onAddTask })
    fireEvent.change(screen.getByLabelText('Nieuwe taak'), { target: { value: '   Piano stemmen  ' } })
    fireEvent.click(screen.getByRole('button', { name: /Taak toevoegen/ }))
    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith('Piano stemmen', 'acme-co'))
  })

  it('meldt geen succes als het opslaan mislukt', async () => {
    const onAddTask = vi.fn().mockResolvedValue(null)
    panel({ onAddTask })
    fireEvent.change(screen.getByLabelText('Nieuwe taak'), { target: { value: 'Piano stemmen' } })
    fireEvent.click(screen.getByRole('button', { name: /Taak toevoegen/ }))

    expect(await screen.findByText(/lukte niet/)).toBeInTheDocument()
    expect(screen.queryByText(/toegevoegd/)).not.toBeInTheDocument()
  })

  it('doet niets bij een leeg veld', () => {
    const onAddTask = vi.fn().mockResolvedValue(created('x'))
    panel({ onAddTask })
    fireEvent.click(screen.getByRole('button', { name: /Taak toevoegen/ }))
    expect(onAddTask).not.toHaveBeenCalled()
  })

  it('toont geen projectkeuze bij één project', () => {
    panel({ onAddTask: vi.fn() })
    expect(screen.queryByLabelText('Project')).not.toBeInTheDocument()
  })
})

// ── Taak toevoegen vanuit een levensgebied ────────────────────────────────────

describe('GraphDetailPanel — taak toevoegen bij een levensgebied', () => {
  const catProps = { selected: { kind: 'cat' as const, id: 'werk' } }

  it('kiest standaard het eerste project van het gebied', async () => {
    const onAddTask = vi.fn().mockResolvedValue(created('Boekhouding'))
    panel({ ...catProps, onAddTask })
    fireEvent.change(screen.getByLabelText('Nieuwe taak'), { target: { value: 'Boekhouding' } })
    fireEvent.click(screen.getByRole('button', { name: /Taak toevoegen/ }))
    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith('Boekhouding', 'acme-co'))
  })

  it('laat je een ander project van het gebied kiezen', async () => {
    const onAddTask = vi.fn().mockResolvedValue(created('Teksten schrijven'))
    panel({ ...catProps, onAddTask })
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'website' } })
    fireEvent.change(screen.getByLabelText('Nieuwe taak'), { target: { value: 'Teksten schrijven' } })
    fireEvent.click(screen.getByRole('button', { name: /Taak toevoegen/ }))
    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith('Teksten schrijven', 'website'))
  })

  it('kan de taak ook zonder project opslaan', async () => {
    const onAddTask = vi.fn().mockResolvedValue(created('Nog uitzoeken'))
    panel({ ...catProps, onAddTask })
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Nieuwe taak'), { target: { value: 'Nog uitzoeken' } })
    fireEvent.click(screen.getByRole('button', { name: /Taak toevoegen/ }))
    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith('Nog uitzoeken', null))
  })

  it('legt bij een gebied zonder projecten uit dat de taak in de inbox komt', async () => {
    const onAddTask = vi.fn().mockResolvedValue(created('Iets nieuws'))
    panel({ selected: { kind: 'cat', id: 'thuis' }, onAddTask })
    expect(screen.getByText(/inbox/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nieuwe taak'), { target: { value: 'Iets nieuws' } })
    fireEvent.click(screen.getByRole('button', { name: /Taak toevoegen/ }))
    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith('Iets nieuws', null))
  })
})

// ── Taak verwijderen ──────────────────────────────────────────────────────────

describe('GraphDetailPanel — taak verwijderen', () => {
  const taskProps = { selected: { kind: 'task' as const, id: '1' } }

  it('toont geen verwijderknop zonder verwijder-mogelijkheid', () => {
    panel(taskProps)
    expect(screen.queryByLabelText('Taak verwijderen')).not.toBeInTheDocument()
  })

  it('verwijdert de geopende taak en sluit het paneel', () => {
    const onDeleteTask = vi.fn()
    const onClose = vi.fn()
    panel({ ...taskProps, onDeleteTask, onClose })

    fireEvent.click(screen.getByLabelText('Taak verwijderen'))
    expect(onDeleteTask).toHaveBeenCalledWith(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('laat de taak zelf ook nog gewoon openen', () => {
    const onOpenTask = vi.fn()
    panel({ ...taskProps, onOpenTask, onDeleteTask: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /Open taak/ }))
    expect(onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Setlist maken' }))
  })
})

// ── Inbox ─────────────────────────────────────────────────────────────────────

describe('GraphDetailPanel — inbox', () => {
  it('kan rechtstreeks een taak zonder project toevoegen', async () => {
    const onAddTask = vi.fn().mockResolvedValue(created('Losse gedachte'))
    panel({ selected: { kind: 'cat', id: 'inbox' }, tasks: [task(5, null, 'Losse taak')], onAddTask })
    fireEvent.change(screen.getByLabelText('Nieuwe taak'), { target: { value: 'Losse gedachte' } })
    fireEvent.click(screen.getByRole('button', { name: /Taak toevoegen/ }))
    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith('Losse gedachte', null))
  })
})

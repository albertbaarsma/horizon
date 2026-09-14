import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Project, Task } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    }),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  }),
}))

const { ProjectModal } = await import('@/app/dashboard/ProjectsView')

beforeEach(() => { vi.clearAllMocks() })

function proj(over: Partial<Project> = {}): Project {
  return {
    id: 'tuinproject', user_id: 'u', cat_id: 'thuis', name: 'Schuur verbouwen', emoji: '🏚️',
    status: 'actief', description: '', vision: '', proj_type: 'project', notes: null,
    html_content: null, is_priority: true, sort_order: 0, created_at: '', updated_at: '', ...over,
  }
}

function toon(project = proj(), tasks: Task[] = []) {
  const onClose = vi.fn()
  render(<ProjectModal project={project} tasks={tasks} onUpdateTask={vi.fn()} onClose={onClose} />)
  return { onClose }
}

const AANBOD = /Dit project draagt gewicht maar staat nog dun opgeschreven/

describe('ProjectModal — aanbod om uit te werken', () => {
  it('biedt het aan bij een leeg prioriteitsproject, en zegt wat er ontbreekt', () => {
    toon()
    expect(screen.getByText(AANBOD)).toBeTruthy()
    expect(screen.getByText(/Er ontbreekt .*omschrijving/)).toBeTruthy()
  })

  // Jordan wil geen por bij projecten die prima kort mogen zijn
  it('zwijgt bij een project dat niet je prioriteit is', () => {
    toon(proj({ is_priority: false, status: 'lopend' }))
    expect(screen.queryByText(AANBOD)).toBeNull()
  })

  it('zwijgt bij een uitgewerkt project', () => {
    toon(proj({
      description: 'De stal ombouwen tot woonruimte, met isolatie en vloerverwarming.',
      vision: 'Een warme ruimte waar je zo naar binnen loopt.',
    }), [{ id: 1, user_id: 'u', proj_id: 'tuinproject', name: 'Offerte opvragen', status: 'backlog', urgent: false, priority: 0, created_at: '', updated_at: '' }])
    expect(screen.queryByText(AANBOD)).toBeNull()
  })

  it('kopieert bij "Copy prompt" een RPM-vraag naar het klembord, en laat het venster open', async () => {
    const { onClose } = toon()
    fireEvent.click(screen.getByText(/Copy prompt/))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))
    const gekopieerd = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]
    expect(gekopieerd).toContain('Schuur verbouwen')
    expect(gekopieerd).toMatch(/Maak nog niets aan/i)
    expect(gekopieerd).toMatch(/RPM-methode/i)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('toont een bevestiging na het kopiëren', async () => {
    toon()
    fireEvent.click(screen.getByText(/Copy prompt/))
    expect(await screen.findByText('✓ Gekopieerd')).toBeTruthy()
  })

  it('laat je het aanbod wegklikken zonder verder iets te doen', () => {
    toon()
    fireEvent.click(screen.getByText('Prima zo'))
    expect(screen.queryByText(AANBOD)).toBeNull()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })
})

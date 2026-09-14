import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Goal, Project } from '@/lib/types'
import { verzamelNietSmart } from '@/lib/uitwerk-overzicht'

const { UitwerkPanel } = await import('@/app/dashboard/UitwerkPanel')

beforeEach(() => { vi.clearAllMocks() })

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 1, user_id: 'u', horizon: 'kwartaal', text: 'Album afmaken', done: false,
    cat_id: 'muziek', deadline: null, created_at: '', ...over,
  }
}

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'tuinproject', user_id: 'u', cat_id: 'thuis', name: 'Schuur verbouwen', emoji: '🏚️',
    status: 'actief', description: '', vision: '', proj_type: 'project', notes: null,
    html_content: null, is_priority: true, sort_order: 0, created_at: '', updated_at: '', ...over,
  }
}

function toon(over: Partial<Parameters<typeof UitwerkPanel>[0]> = {}) {
  const items = over.items ?? verzamelNietSmart([goal()], [project()], [])
  const onClose = vi.fn(), onOpenGoal = vi.fn(), onOpenProject = vi.fn()
  render(<UitwerkPanel items={items} tasks={[]} onClose={onClose} onOpenGoal={onOpenGoal} onOpenProject={onOpenProject} {...over} />)
  return { onClose, onOpenGoal, onOpenProject, items }
}

describe('UitwerkPanel', () => {
  it('toont elk item met wat eraan ontbreekt', () => {
    toon()
    expect(screen.getByText('Album afmaken')).toBeTruthy()
    expect(screen.getByText('Schuur verbouwen')).toBeTruthy()
    expect(screen.getAllByText(/Mist:/).length).toBe(2)
  })

  it('staat standaard helemaal aangevinkt', () => {
    toon()
    const vinkjes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(vinkjes.every(v => v.checked)).toBe(true)
  })

  it('vinkt een item uit en dat verdwijnt uit de prompt', async () => {
    toon()
    const vinkjes = screen.getAllByRole('checkbox')
    fireEvent.click(vinkjes[0])   // het doel uitvinken
    fireEvent.click(screen.getByText(/Copy prompt/))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))
    const prompt = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]
    expect(prompt).not.toContain('Album afmaken')
    expect(prompt).toContain('Schuur verbouwen')
  })

  it('"Alles uit" en "Alles aan" werken', () => {
    toon()
    fireEvent.click(screen.getByText('Alles uit'))
    expect((screen.getAllByRole('checkbox') as HTMLInputElement[]).every(v => !v.checked)).toBe(true)
    fireEvent.click(screen.getByText('Alles aan'))
    expect((screen.getAllByRole('checkbox') as HTMLInputElement[]).every(v => v.checked)).toBe(true)
  })

  it('de teller volgt de selectie', () => {
    toon()
    expect(screen.getByText('2 geselecteerd')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(screen.getByText('1 geselecteerd')).toBeTruthy()
  })

  it('klik op een doel opent het', () => {
    const { onOpenGoal } = toon()
    fireEvent.click(screen.getByText('Album afmaken'))
    expect(onOpenGoal).toHaveBeenCalledWith(1)
  })

  it('klik op een project opent het', () => {
    const { onOpenProject } = toon()
    fireEvent.click(screen.getByText('Schuur verbouwen'))
    expect(onOpenProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'tuinproject' }))
  })

  it('toont een lege staat als er niets meer is', () => {
    toon({ items: [] })
    expect(screen.getByText(/Niets meer om uit te werken/)).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('sluit via de kruisknop', () => {
    const { onClose } = toon()
    fireEvent.click(screen.getByLabelText('Overzicht sluiten'))
    expect(onClose).toHaveBeenCalled()
  })
})

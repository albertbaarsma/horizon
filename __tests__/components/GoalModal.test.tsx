import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import type { Goal, Category, Project } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    }),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  }),
}))

const { GoalModal } = await import('@/app/dashboard/GoalsView')

beforeEach(() => { vi.clearAllMocks() })

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 1, user_id: 'u', horizon: 'kwartaal', text: 'Album afmaken', done: false,
    cat_id: 'muziek', deadline: null, created_at: '', ...over,
  }
}

const CATS: Category[] = [{ id: 'muziek', user_id: 'u', name: 'Muzikant' }, { id: 'thuis', user_id: 'u', name: 'Thuis & Land' }]

function toon(over: Partial<Parameters<typeof GoalModal>[0]> = {}) {
  const onClose = vi.fn(), onUpdated = vi.fn(), onTrash = vi.fn(), onOpenGoal = vi.fn(), onOpenProject = vi.fn()
  const g = over.goal ?? goal()
  render(
    <GoalModal goal={g} allGoals={over.allGoals ?? [g]} categories={CATS} projects={over.projects ?? []} userId="u"
      onClose={onClose} onUpdated={onUpdated} onTrash={onTrash} onOpenGoal={onOpenGoal} onOpenProject={onOpenProject}
      {...over} />
  )
  return { onClose, onUpdated, onTrash, onOpenGoal, onOpenProject, goal: g }
}

describe('GoalModal — velden', () => {
  it('toont de doeltekst en de RPM-velden', () => {
    toon()
    expect(screen.getByText('Album afmaken')).toBeTruthy()
    expect(screen.getByLabelText('Result')).toBeTruthy()
    expect(screen.getByLabelText('Why')).toBeTruthy()
    expect(screen.getByLabelText('Notities')).toBeTruthy()
    expect(screen.getByLabelText('Streefdatum')).toBeTruthy()
  })

  it('bewaart een wijziging aan Result, gedebouncet', async () => {
    vi.useFakeTimers()
    try {
      const { onUpdated } = toon()
      fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'Tien nummers klaar' } })
      await act(async () => { vi.advanceTimersByTime(900) })
      expect(onUpdated).toHaveBeenCalledWith({ id: 1, result: 'Tien nummers klaar' })
    } finally { vi.useRealTimers() }
  })

  it('wisselt tussen doel en hobbydoel', async () => {
    const { onUpdated } = toon()
    fireEvent.click(screen.getByTitle('Wissel tussen doel en hobbydoel'))
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ id: 1, kind: 'hobby' }))
  })

  it('verandert de horizon via het dropdown', async () => {
    const { onUpdated } = toon()
    fireEvent.change(screen.getByLabelText('Horizon'), { target: { value: '2-4jr' } })
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ id: 1, horizon: '2-4jr' }))
  })

  it('verandert het levensgebied', async () => {
    const { onUpdated } = toon()
    fireEvent.change(screen.getByLabelText('Levensgebied'), { target: { value: 'thuis' } })
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ id: 1, cat_id: 'thuis' }))
  })
})

describe('GoalModal — hoofd- en sub-doelen', () => {
  it('biedt geen zichzelf of eigen kinderen aan als hoofddoel', () => {
    const g = goal({ id: 1 })
    const kind = goal({ id: 2, parent_id: 1, text: 'sub' })
    const ander = goal({ id: 3, text: 'ander doel' })
    toon({ goal: g, allGoals: [g, kind, ander] })
    const opties = within(screen.getByLabelText('Hoofddoel')).getAllByRole('option').map(o => o.textContent)
    expect(opties.some(t => t?.includes('sub'))).toBe(false)
    expect(opties.some(t => t?.includes('ander doel'))).toBe(true)
  })

  it('toont sub-doelen als klikbare chips die het detail openen', () => {
    const g = goal({ id: 1 })
    const sub = goal({ id: 2, parent_id: 1, text: 'Nummer 1 opnemen' })
    const { onOpenGoal } = toon({ goal: g, allGoals: [g, sub] })
    fireEvent.click(screen.getByText('Nummer 1 opnemen'))
    expect(onOpenGoal).toHaveBeenCalledWith(sub)
  })

  it('verandert parent_id via het dropdown', async () => {
    const g = goal({ id: 1 })
    const ander = goal({ id: 3, text: 'ander doel' })
    const { onUpdated } = toon({ goal: g, allGoals: [g, ander] })
    fireEvent.change(screen.getByLabelText('Hoofddoel'), { target: { value: '3' } })
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ id: 1, parent_id: 3 }))
  })
})

describe('GoalModal — gerelateerde projecten', () => {
  function project(over: Partial<Project> = {}): Project {
    return {
      id: 'p1', user_id: 'u', cat_id: 'muziek', name: 'Lemon Tree', emoji: '🍋', status: 'actief',
      description: '', vision: '', proj_type: 'project', notes: null, html_content: null,
      is_priority: false, sort_order: 0, created_at: '', updated_at: '', ...over,
    }
  }

  it('toont projecten uit hetzelfde levensgebied', () => {
    toon({ projects: [project()] })
    expect(screen.getByText(/Lemon Tree/)).toBeTruthy()
  })

  it('opent het project bij een klik', () => {
    const { onOpenProject } = toon({ projects: [project()] })
    fireEvent.click(screen.getByText(/Lemon Tree/))
    expect(onOpenProject).toHaveBeenCalledWith(project())
  })

  it('laat een project uit een ander levensgebied weg', () => {
    toon({ projects: [project({ cat_id: 'thuis' })] })
    expect(screen.queryByText('Lemon Tree')).toBeNull()
  })

  it('toont niets als er geen projecten zijn — geen lege sectie', () => {
    toon({ projects: [] })
    expect(screen.queryByLabelText('Gerelateerde projecten')).toBeNull()
  })
})

describe('GoalModal — SMART-nudge', () => {
  const AANBOD = /Dit doel heeft nog geen duidelijk result/

  it('biedt aan als het result ontbreekt', () => {
    toon()
    expect(screen.getByText(AANBOD)).toBeTruthy()
  })

  it('zwijgt zodra er een result is', () => {
    toon({ goal: goal({ result: 'Tien nummers klaar' }) })
    expect(screen.queryByText(AANBOD)).toBeNull()
  })

  it('zwijgt bij een hobbydoel', () => {
    toon({ goal: goal({ kind: 'hobby' }) })
    expect(screen.queryByText(AANBOD)).toBeNull()
  })

  it('kopieert bij "Copy prompt" een SMART-vraag naar het klembord, en laat het venster open', async () => {
    const { onClose } = toon()
    fireEvent.click(screen.getByText(/Copy prompt/))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))
    const gekopieerd = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]
    expect(gekopieerd).toContain('Album afmaken')
    expect(gekopieerd).toMatch(/SMART/)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('"Prima zo" klikt het aanbod weg zonder verder iets te doen', () => {
    toon()
    fireEvent.click(screen.getByText('Prima zo'))
    expect(screen.queryByText(AANBOD)).toBeNull()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })
})

describe('GoalModal — verwijderen', () => {
  it('vraagt eerst, gooit niet meteen weg', () => {
    const { onTrash } = toon()
    fireEvent.click(screen.getByLabelText('Doel verwijderen'))
    expect(onTrash).not.toHaveBeenCalled()
    expect(screen.getByText(/prullenbak/)).toBeTruthy()
  })

  it('gaat naar de prullenbak (geen hard delete) na bevestigen, en sluit', () => {
    const { onTrash, onClose } = toon()
    fireEvent.click(screen.getByLabelText('Doel verwijderen'))
    fireEvent.click(screen.getByText('Ja, weg'))
    expect(onTrash).toHaveBeenCalledWith(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('annuleren laat het doel met rust', () => {
    const { onTrash } = toon()
    fireEvent.click(screen.getByLabelText('Doel verwijderen'))
    fireEvent.click(screen.getByText('Nee'))
    expect(onTrash).not.toHaveBeenCalled()
    expect(screen.queryByText(/prullenbak/)).toBeNull()
  })
})

describe('GoalModal — visualisaties', () => {
  it('rendert geplakte HTML', () => {
    toon({ goal: goal({ html_content: '<b data-testid="html-inhoud">grafiek</b>' }) })
    expect(screen.getByTestId('html-inhoud')).toBeTruthy()
  })

  it('rendert niets extra als er geen HTML is', () => {
    toon()
    expect(document.querySelector('[data-testid="html-inhoud"]')).toBeNull()
  })
})

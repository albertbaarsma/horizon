import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Project, Task, TaskStatus } from '@/lib/types'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockSingle = vi.fn()

function makeChain(result = { data: null as unknown, error: null }) {
  const q: Record<string, unknown> = {}
  q.eq     = () => q
  q.select = () => q
  q.update = (data: unknown) => { mockUpdate(data); return q }
  q.insert = (rows: unknown) => { mockInsert(rows); return q }
  q.single = () => mockSingle()
  q.then   = (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve)
  q.catch  = (reject: (e: unknown) => void) => Promise.resolve(result).catch(reject)
  return q
}

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => makeChain(),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  }),
}))

// ── Lazy imports after mocks ──────────────────────────────────────────────────

const { RpmSectionHead, ProjectCard, ProjectsTab, CreateProjectModal, ProjectModal } =
  await import('@/app/dashboard/ProjectsView')

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1', user_id: 'uid', cat_id: 'c1', name: 'Testproject', emoji: '🗂',
    status: 'actief', description: 'Omschrijving', vision: 'Visie tekst',
    proj_type: 'project', notes: null, html_content: null,
    is_priority: false, sort_order: 0, created_at: '', updated_at: '',
    ...overrides,
  }
}

function makeTask(id: number, status: TaskStatus, overrides: Partial<Task> = {}): Task {
  return { id, user_id: 'uid', proj_id: 'p1', name: `Taak ${id}`, status, urgent: false, priority: 0, created_at: '', updated_at: '', ...overrides }
}

const CATS = [{ id: 'c1', name: 'Muziek' }, { id: 'c2', name: 'Business' }]

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: null, error: null })
})

// ── RpmSectionHead ────────────────────────────────────────────────────────────

describe('RpmSectionHead', () => {
  it('renders icon, label, and applies color', () => {
    const { container } = render(<RpmSectionHead icon="🎯" label="RESULT" color="#6366f1" />)
    expect(screen.getByText(/RESULT/)).toBeTruthy()
    expect(screen.getByText(/🎯/)).toBeTruthy()
    // jsdom normalizes hex to rgb()
    const el = container.firstChild as HTMLElement
    expect(el.style.color).toMatch(/rgb\(99,\s*102,\s*241\)|#6366f1/)
  })
})

// ── ProjectCard ───────────────────────────────────────────────────────────────

describe('ProjectCard', () => {
  const baseProps = {
    tasks: [],
    onSelect: vi.fn(),
    onTogglePriority: vi.fn(),
    dragging: false,
    dragOver: false,
    onDragStart: vi.fn(),
    onDragEnter: vi.fn(),
    onDragEnd: vi.fn(),
  }

  it('renders project name and emoji', () => {
    render(<ProjectCard p={makeProject()} {...baseProps} />)
    expect(screen.getByText('Testproject')).toBeTruthy()
    expect(screen.getByText('🗂')).toBeTruthy()
  })

  it('shows star button with correct aria-label when not priority', () => {
    render(<ProjectCard p={makeProject({ is_priority: false })} {...baseProps} />)
    const star = screen.getByRole('button', { name: /voeg toe aan prioriteiten/i })
    expect(star).toBeTruthy()
    expect(star.textContent).toBe('★')
  })

  it('shows star button with correct aria-label when priority', () => {
    render(<ProjectCard p={makeProject({ is_priority: true })} {...baseProps} />)
    const star = screen.getByRole('button', { name: /verwijder uit prioriteiten/i })
    expect(star).toBeTruthy()
  })

  it('calls onSelect when card is clicked', () => {
    const onSelect = vi.fn()
    render(<ProjectCard p={makeProject()} {...baseProps} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Testproject'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('calls onTogglePriority when star is clicked (not the card)', () => {
    const onTogglePriority = vi.fn()
    const onSelect = vi.fn()
    render(<ProjectCard p={makeProject()} {...baseProps} onSelect={onSelect} onTogglePriority={onTogglePriority} />)
    const star = screen.getByRole('button', { name: /voeg toe aan prioriteiten/i })
    fireEvent.click(star)
    expect(onTogglePriority).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows task progress when tasks exist', () => {
    const tasks = [makeTask(1, 'doing'), makeTask(2, 'done')]
    render(<ProjectCard p={makeProject()} {...baseProps} tasks={tasks} />)
    expect(screen.getByText('1/2')).toBeTruthy()
  })

  it('toont de namen van openstaande taken, niet alleen een getal', () => {
    const tasks = [makeTask(1, 'doing', { name: 'Eerste taak' }), makeTask(2, 'backlog', { name: 'Tweede taak' }), makeTask(3, 'done', { name: 'Derde taak' })]
    render(<ProjectCard p={makeProject()} {...baseProps} tasks={tasks} />)
    expect(screen.getByText(/Eerste taak/)).toBeTruthy()
    expect(screen.getByText(/Tweede taak/)).toBeTruthy()
    expect(screen.queryByText(/Derde taak/)).toBeNull()   // al klaar — hoort niet in de preview
  })

  it('toont de ✓-knop direct, zonder eerst te hoveren', () => {
    const onMove = vi.fn()
    render(<ProjectCard p={makeProject()} {...baseProps} onMove={onMove} onMoveCategory={vi.fn()} onDelete={vi.fn()} categories={CATS} />)
    fireEvent.click(screen.getByRole('button', { name: /markeren als klaar/i }))
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 'archive')
  })

  it('is draggable', () => {
    const { container } = render(<ProjectCard p={makeProject()} {...baseProps} />)
    const card = container.firstChild as HTMLElement
    expect(card.getAttribute('draggable')).toBe('true')
  })
})

// ── ProjectsTab ───────────────────────────────────────────────────────────────

describe('ProjectsTab', () => {
  const baseProps = {
    tasks: [],
    categories: CATS,
    onSelect: vi.fn(),
    onUpdateProjects: vi.fn(),
    onCreate: vi.fn(),
  }

  it('renders "+ Nieuw project" button', () => {
    render(<ProjectsTab projects={[]} {...baseProps} />)
    expect(screen.getByRole('button', { name: /nieuw project/i })).toBeTruthy()
  })

  it('calls onCreate when new project button clicked', () => {
    const onCreate = vi.fn()
    render(<ProjectsTab projects={[]} {...baseProps} onCreate={onCreate} />)
    fireEvent.click(screen.getByRole('button', { name: /nieuw project/i }))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('shows Prioriteiten section only when is_priority projects exist', () => {
    const { rerender } = render(<ProjectsTab projects={[]} {...baseProps} />)
    expect(screen.queryByText(/Prioriteiten/i)).toBeNull()

    rerender(<ProjectsTab projects={[makeProject({ is_priority: true })]} {...baseProps} />)
    expect(screen.getByText(/Prioriteiten/i)).toBeTruthy()
  })

  it('shows Overige projecten for non-priority active projects', () => {
    const p = makeProject({ is_priority: false, status: 'actief' })
    render(<ProjectsTab projects={[p]} {...baseProps} />)
    expect(screen.getByText(/Overige projecten/i)).toBeTruthy()
  })

  it('shows Routines section for routine-type projects', () => {
    const p = makeProject({ proj_type: 'routine' })
    render(<ProjectsTab projects={[p]} {...baseProps} />)
    expect(screen.getByText(/Routines/i)).toBeTruthy()
  })

  it('shows Slapend section for sleeping/vision projects', () => {
    const p = makeProject({ status: 'slapend' })
    render(<ProjectsTab projects={[p]} {...baseProps} />)
    // The section header contains the emoji + text; use getAllBy since the status badge also says 'slapend'
    const matches = screen.getAllByText(/Slapend/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('calls onUpdateProjects with toggled is_priority when star is clicked', async () => {
    const onUpdateProjects = vi.fn()
    const p = makeProject({ id: 'p1', is_priority: false })
    render(<ProjectsTab projects={[p]} {...baseProps} onUpdateProjects={onUpdateProjects} />)

    const star = screen.getByRole('button', { name: /voeg toe aan prioriteiten/i })
    fireEvent.click(star)

    await waitFor(() => {
      expect(onUpdateProjects).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'p1', is_priority: true })])
      )
    })
  })

  it('shows priority badge with count', () => {
    const p1 = makeProject({ id: 'p1', is_priority: true })
    const p2 = makeProject({ id: 'p2', is_priority: true })
    render(<ProjectsTab projects={[p1, p2]} {...baseProps} />)
    expect(screen.getByText('2/7')).toBeTruthy()
  })

  // De server kent geen localStorage, dus rendert een groep altijd ingeklapt.
  // De useState-beginwaarde moet daarom óók op de client altijd leeg starten
  // (niet meteen uit localStorage lezen) — anders wijkt de eerste client-render
  // af van de server-HTML en gooit React de SSR-HTML weg voor een hertekening
  // (een echte, geziene hydration-fout). RTL flust effecten synchroon binnen
  // render(), dus dat allereerste "nog leeg"-moment is hier niet apart te
  // toetsen — wel dat het laden werkt én de opslag niet vroegtijdig overschrijft.
  describe('groep-uitklapstand (hydration-veilig)', () => {
    const hoofd = makeProject({ id: 'hoofd', name: 'Hoofdproject' })
    const sub   = makeProject({ id: 'sub', name: 'Subproject', parent_id: 'hoofd' })

    it('klapt vlak na het laden alsnog open, volgens wat was opgeslagen', async () => {
      localStorage.setItem('proj-expanded', JSON.stringify(['hoofd']))
      render(<ProjectsTab projects={[hoofd, sub]} {...baseProps} />)
      await waitFor(() => expect(screen.getByText('Subproject')).toBeTruthy())
    })

    it('het laden overschrijft niet meteen weer de opslag met de lege beginstand', async () => {
      localStorage.setItem('proj-expanded', JSON.stringify(['hoofd']))
      render(<ProjectsTab projects={[hoofd, sub]} {...baseProps} />)
      await waitFor(() => expect(screen.getByText('Subproject')).toBeTruthy())
      // Als het opslaan-effect vóór het inlezen af was, stond hier nu '[]'
      expect(JSON.parse(localStorage.getItem('proj-expanded') ?? '[]')).toEqual(['hoofd'])
    })

    it('zonder opgeslagen stand blijft alles gewoon ingeklapt', () => {
      localStorage.removeItem('proj-expanded')
      render(<ProjectsTab projects={[hoofd, sub]} {...baseProps} />)
      expect(screen.queryByText('Subproject')).toBeNull()
    })
  })
})

describe('ProjectsTab — horizon-weergave', () => {
  const baseProps = {
    tasks: [],
    categories: CATS,
    onSelect: vi.fn(),
    onUpdateProjects: vi.fn(),
    onCreate: vi.fn(),
  }

  beforeEach(() => { localStorage.removeItem('projecten-weergave'); localStorage.removeItem('projecten-lang-open') })

  it('start standaard in de sectie-weergave', () => {
    render(<ProjectsTab projects={[makeProject({ is_priority: true })]} {...baseProps} />)
    expect(screen.getByText(/Prioriteiten/i)).toBeTruthy()
    expect(screen.queryByText(/sleep een kaart naar een andere horizon/)).toBeNull()
  })

  it('wisselt naar de horizon-weergave en toont de horizon-hint i.p.v. de sectie-hint', () => {
    render(<ProjectsTab projects={[makeProject({ horizon: 'jaar' })]} {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(screen.queryByText(/Prioriteiten/i)).toBeNull()
    expect(screen.getByText(/sleep een kaart naar een andere horizon/)).toBeTruthy()
  })

  it('onthoudt de gekozen weergave in localStorage', () => {
    const { unmount } = render(<ProjectsTab projects={[]} {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(localStorage.getItem('projecten-weergave')).toBe('horizon')
    unmount()
    render(<ProjectsTab projects={[]} {...baseProps} />)
    expect(screen.getByText(/sleep een kaart naar een andere horizon/)).toBeTruthy()
  })

  it('toont alle 9 horizon-kolommen, ook leeg — anders is een lege horizon nooit te vullen', () => {
    render(<ProjectsTab projects={[]} {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    for (const h of ['nu', 'wk', '6w', 'kwartaal', 'jaar']) expect(document.querySelector(`[data-horizon="${h}"]`)).toBeTruthy()
    fireEvent.click(screen.getByText(/Lange termijn/))
    for (const h of ['2-4jr', '5-9jr', '10jr+', 'ooit']) expect(document.querySelector(`[data-horizon="${h}"]`)).toBeTruthy()
  })

  it('toont een project zonder horizon onder "Nog niet ingedeeld"', () => {
    render(<ProjectsTab projects={[makeProject({ name: 'Los project', horizon: null })]} {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(screen.getByText(/Nog niet ingedeeld/)).toBeTruthy()
    expect(screen.getByText('Los project')).toBeTruthy()
  })

  it('groepeert een project met horizon in zijn eigen kolom — "Nog niet ingedeeld" blijft op 0 staan', () => {
    render(<ProjectsTab projects={[makeProject({ id:'p1', name:'Kwartaalproject', horizon:'kwartaal' })]} {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(document.querySelector('[data-horizon="kwartaal"]')?.textContent).toContain('Kwartaalproject')
    expect(screen.getByText(/Nog niet ingedeeld \(0\)/)).toBeTruthy()
  })

  it('een sub-project met een eigen horizon valt uit elkaar van zijn hoofdproject, met een verwijzing ernaar', () => {
    const hoofd = makeProject({ id: 'hoofd', name: 'Hoofdproject', horizon: 'jaar' })
    const sub   = makeProject({ id: 'sub', name: 'Subproject', parent_id: 'hoofd', horizon: 'kwartaal' })
    render(<ProjectsTab projects={[hoofd, sub]} {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    const kwartaalKolom = document.querySelector('[data-horizon="kwartaal"]')!
    const jaarKolom = document.querySelector('[data-horizon="jaar"]')!
    expect(kwartaalKolom.textContent).toContain('Subproject')
    expect(kwartaalKolom.textContent).toContain('Hoofdproject')   // de "↳ onder ..." verwijzing
    expect(jaarKolom.textContent).toContain('Hoofdproject')
    expect(jaarKolom.textContent).not.toContain('Subproject')
  })

  it('slepen naar een andere horizon-kolom werkt via onUpdateProjects', async () => {
    const onUpdateProjects = vi.fn()
    const p = makeProject({ id: 'p1', name: 'Verplaatsbaar', horizon: 'kwartaal' })
    render(<ProjectsTab projects={[p]} {...baseProps} onUpdateProjects={onUpdateProjects} />)
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

    await waitFor(() => expect(onUpdateProjects).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'p1', horizon: 'jaar' })])
    ))
  })

  it('toont een ✓-knop om een project als klaar te markeren, ook in Horizon', async () => {
    const onUpdateProjects = vi.fn()
    const p = makeProject({ id: 'p1', name: 'Afronden', horizon: 'jaar' })
    render(<ProjectsTab projects={[p]} {...baseProps} onUpdateProjects={onUpdateProjects} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    fireEvent.click(screen.getByRole('button', { name: /afronden markeren als klaar/i }))

    await waitFor(() => expect(onUpdateProjects).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'p1', status: 'archief' })])
    ))
  })

  it('toont welke taken bij een project horen, ook in Horizon', () => {
    const p = makeProject({ id: 'p1', name: 'Met taken', horizon: 'jaar' })
    const tasks = [makeTask(1, 'doing', { name: 'Zichtbare taak' }), makeTask(2, 'done', { name: 'Klare taak' })]
    render(<ProjectsTab projects={[p]} {...baseProps} tasks={tasks} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(screen.getByText(/Zichtbare taak/)).toBeTruthy()
    expect(screen.queryByText(/Klare taak/)).toBeNull()
  })

  it('een project met een deadline dichtbij staat in Nu, ook al staat het opgeslagen horizon op jaar', () => {
    const p = makeProject({ horizon: 'jaar', deadline: new Date(Date.now() + 2*86400000).toISOString().slice(0,10) })
    render(<ProjectsTab projects={[p]} {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    expect(document.querySelector('[data-horizon="nu"]')?.textContent).toContain('Testproject')
  })

  it('slepen van een project MET deadline past de deadline aan i.p.v. alleen het horizon-veld', async () => {
    const onUpdateProjects = vi.fn()
    const p = makeProject({ id: 'p1', name: 'Gedateerd', horizon: 'nu', deadline: new Date().toISOString().slice(0,10) })
    render(<ProjectsTab projects={[p]} {...baseProps} onUpdateProjects={onUpdateProjects} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))

    const kaart = [...document.querySelectorAll('div[draggable="true"]')].find(el => el.textContent?.includes('Gedateerd'))!
    const dataTransfer = {
      types: [] as string[], data: {} as Record<string, string>,
      setData(type: string, val: string) { this.data[type] = val; this.types.push(type) },
      getData(type: string) { return this.data[type] ?? '' },
    }
    fireEvent.dragStart(kaart, { dataTransfer })
    const doel = document.querySelector('[data-horizon="jaar"]')!
    fireEvent.dragOver(doel, { dataTransfer })
    fireEvent.drop(doel, { dataTransfer })

    await waitFor(() => expect(onUpdateProjects).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'p1', horizon: 'jaar', deadline: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })])
    ))
    const call = onUpdateProjects.mock.calls[0][0].find((x: Project) => x.id === 'p1')
    expect(call.deadline).not.toBe(p.deadline)   // daadwerkelijk verschoven, niet dezelfde datum
  })

  it('slepen naar een langetermijn-kolom laat de deadline los', async () => {
    const onUpdateProjects = vi.fn()
    const p = makeProject({ id: 'p1', name: 'Loslaten', horizon: 'nu', deadline: new Date().toISOString().slice(0,10) })
    render(<ProjectsTab projects={[p]} {...baseProps} onUpdateProjects={onUpdateProjects} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))
    fireEvent.click(screen.getByText(/Lange termijn/))

    const kaart = [...document.querySelectorAll('div[draggable="true"]')].find(el => el.textContent?.includes('Loslaten'))!
    const dataTransfer = {
      types: [] as string[], data: {} as Record<string, string>,
      setData(type: string, val: string) { this.data[type] = val; this.types.push(type) },
      getData(type: string) { return this.data[type] ?? '' },
    }
    fireEvent.dragStart(kaart, { dataTransfer })
    // 2-4jr/5-9jr/10jr+ zijn zelf ook deadline-gestuurd (zie deadline-horizon.ts)
    // — alleen ooit/doorlopend laten de deadline echt los.
    const doel = document.querySelector('[data-horizon="ooit"]')!
    fireEvent.dragOver(doel, { dataTransfer })
    fireEvent.drop(doel, { dataTransfer })

    await waitFor(() => expect(onUpdateProjects).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'p1', horizon: 'ooit', deadline: null })])
    ))
  })

  it('slepen op een andere kaart binnen dezelfde horizon herschikt (sort_order), verandert de horizon niet', async () => {
    const onUpdateProjects = vi.fn()
    const a = makeProject({ id: 'a', name: 'Project A', horizon: 'kwartaal', sort_order: 0 })
    const b = makeProject({ id: 'b', name: 'Project B', horizon: 'kwartaal', sort_order: 1 })
    render(<ProjectsTab projects={[a, b]} {...baseProps} onUpdateProjects={onUpdateProjects} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))

    const kaartA = [...document.querySelectorAll('div[draggable="true"]')].find(el => el.textContent?.includes('Project A'))!
    const kaartB = [...document.querySelectorAll('div[draggable="true"]')].find(el => el.textContent?.includes('Project B'))!
    const dataTransfer = {
      types: [] as string[], data: {} as Record<string, string>,
      setData(type: string, val: string) { this.data[type] = val; this.types.push(type) },
      getData(type: string) { return this.data[type] ?? '' },
    }
    fireEvent.dragStart(kaartA, { dataTransfer })
    fireEvent.dragOver(kaartB, { dataTransfer })
    fireEvent.drop(kaartB, { dataTransfer })

    await waitFor(() => expect(onUpdateProjects).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'a', horizon: 'kwartaal', sort_order: 1 }),
        expect.objectContaining({ id: 'b', horizon: 'kwartaal', sort_order: 0 }),
      ])
    ))
  })

  it('slepen terug naar "Nog niet ingedeeld" zet de horizon op null', async () => {
    const onUpdateProjects = vi.fn()
    const p = makeProject({ id: 'p1', name: 'Heroverwegen', horizon: 'kwartaal' })
    render(<ProjectsTab projects={[p]} {...baseProps} onUpdateProjects={onUpdateProjects} />)
    fireEvent.click(screen.getByRole('button', { name: /horizon/i }))

    const kaart = [...document.querySelectorAll('[data-horizon="kwartaal"] div[draggable="true"]')][0]
    const dataTransfer = {
      types: [] as string[], data: {} as Record<string, string>,
      setData(type: string, val: string) { this.data[type] = val; this.types.push(type) },
      getData(type: string) { return this.data[type] ?? '' },
    }
    fireEvent.dragStart(kaart, { dataTransfer })
    const inbox = screen.getByText(/sleep naar een horizon hieronder/).closest('div')!.parentElement!
    fireEvent.dragOver(inbox, { dataTransfer })
    fireEvent.drop(inbox, { dataTransfer })

    await waitFor(() => expect(onUpdateProjects).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'p1', horizon: null })])
    ))
  })
})

// ── CreateProjectModal ────────────────────────────────────────────────────────

describe('CreateProjectModal', () => {
  const baseProps = {
    categories: CATS,
    userId: 'uid',
    onClose: vi.fn(),
    onCreated: vi.fn(),
  }

  it('renders form with name and emoji inputs', () => {
    render(<CreateProjectModal {...baseProps} />)
    expect(screen.getByLabelText('Projectnaam')).toBeTruthy()
    expect(screen.getByLabelText('Emoji')).toBeTruthy()
  })

  it('renders category and status selects', () => {
    render(<CreateProjectModal {...baseProps} />)
    expect(screen.getByLabelText('Categorie')).toBeTruthy()
    expect(screen.getByLabelText('Status')).toBeTruthy()
  })

  it('shows categories in dropdown', () => {
    render(<CreateProjectModal {...baseProps} />)
    expect(screen.getByText('Muziek')).toBeTruthy()
    expect(screen.getByText('Business')).toBeTruthy()
  })

  it('shows error when submitting without a name', async () => {
    render(<CreateProjectModal {...baseProps} />)
    fireEvent.submit(screen.getByRole('button', { name: /aanmaken/i }).closest('form')!)
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('Naam is verplicht')
  })

  it('closes when Escape key pressed', () => {
    const onClose = vi.fn()
    render(<CreateProjectModal {...baseProps} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when clicking the backdrop', () => {
    const onClose = vi.fn()
    const { container } = render(<CreateProjectModal {...baseProps} onClose={onClose} />)
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onCreated with new project after successful submit', async () => {
    const newProject = makeProject({ id: 'new1', name: 'Nieuw project' })
    mockSingle.mockResolvedValueOnce({ data: newProject, error: null })
    const onCreated = vi.fn()

    render(<CreateProjectModal {...baseProps} onCreated={onCreated} />)
    fireEvent.change(screen.getByLabelText('Projectnaam'), { target: { value: 'Nieuw project' } })
    fireEvent.submit(screen.getByRole('button', { name: /aanmaken/i }).closest('form')!)

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(newProject))
  })

  it('geeft een id mee (slug van de naam), uniek naast bestaande projecten', async () => {
    // projects.id heeft geen standaardwaarde: zonder id weigert de database het project.
    mockSingle.mockResolvedValueOnce({ data: makeProject({ id: 'financieel-overzicht-2' }), error: null })
    render(<CreateProjectModal {...baseProps} projects={[makeProject({ id: 'financieel-overzicht' })]} />)
    fireEvent.change(screen.getByLabelText('Projectnaam'), { target: { value: 'Financieel overzicht' } })
    fireEvent.submit(screen.getByRole('button', { name: /aanmaken/i }).closest('form')!)
    await waitFor(() => expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'financieel-overzicht-2', name: 'Financieel overzicht' })
    ))
  })

  it('shows error when insert fails', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB fout' } })

    render(<CreateProjectModal {...baseProps} />)
    fireEvent.change(screen.getByLabelText('Projectnaam'), { target: { value: 'Iets' } })
    fireEvent.submit(screen.getByRole('button', { name: /aanmaken/i }).closest('form')!)

    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('DB fout')
  })
})

// ── ProjectModal ──────────────────────────────────────────────────────────────

describe('ProjectModal', () => {
  const baseProps = {
    onUpdateTask: vi.fn(),
    onClose: vi.fn(),
  }
  function renderModal(project: Project, tasks: Task[] = []) {
    return render(<ProjectModal project={project} tasks={tasks} {...baseProps} />)
  }

  it('shows all 5 sections: Result, Doel, Notities, Taken, Visualisaties', () => {
    renderModal(makeProject(), [])
    expect(screen.getByRole('region', { name: 'Result' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Doel' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Notities' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Taken' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Visualisaties' })).toBeTruthy()
  })

  it('renders project name and emoji in header', () => {
    renderModal(makeProject({ name: 'Tuinproject', emoji: '🐄' }))
    expect(screen.getByText('Tuinproject')).toBeTruthy()
    expect(screen.getByText('🐄')).toBeTruthy()
  })

  it('prefills vision field with project.vision', () => {
    renderModal(makeProject({ vision: 'Mijn grote visie' }))
    const textareas = screen.getAllByRole('textbox')
    const visionField = textareas.find(el => (el as HTMLTextAreaElement).placeholder?.includes('gewenste resultaat')) as HTMLTextAreaElement
    expect(visionField?.value).toBe('Mijn grote visie')
  })

  it('prefills description field with project.description', () => {
    renderModal(makeProject({ description: 'Het doel' }))
    const textareas = screen.getAllByRole('textbox')
    const descField = textareas.find(el => (el as HTMLTextAreaElement).placeholder?.includes('belangrijk')) as HTMLTextAreaElement
    expect(descField?.value).toBe('Het doel')
  })

  it('prefills notes field with project.notes', () => {
    renderModal(makeProject({ notes: 'Mijn notities' }))
    const textareas = screen.getAllByRole('textbox')
    const notesField = textareas.find(el => (el as HTMLTextAreaElement).placeholder?.includes('Stand van zaken')) as HTMLTextAreaElement
    expect(notesField?.value).toBe('Mijn notities')
  })

  it('closes when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<ProjectModal project={makeProject()} tasks={[]} onUpdateTask={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when clicking the backdrop', () => {
    const onClose = vi.fn()
    const { container } = render(<ProjectModal project={makeProject()} tasks={[]} onUpdateTask={vi.fn()} onClose={onClose} />)
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('has accessible close button', () => {
    renderModal(makeProject())
    expect(screen.getByRole('button', { name: /sluiten/i })).toBeTruthy()
  })

  it('schedules auto-save when vision textarea changes', async () => {
    renderModal(makeProject({ id: 'p1', vision: '' }))

    const textareas = screen.getAllByRole('textbox')
    const visionField = textareas.find(el => (el as HTMLTextAreaElement).placeholder?.includes('gewenste resultaat'))!
    fireEvent.change(visionField, { target: { value: 'Nieuwe visie' } })
    expect(mockUpdate).not.toHaveBeenCalled()

    // Wait for the 800ms debounce to fire
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ vision: 'Nieuwe visie' }))
    }, { timeout: 1200 })
  })

  it('shows open tasks in Taken section', () => {
    const tasks = [makeTask(1, 'doing', { name: 'Muur schilderen' })]
    renderModal(makeProject(), tasks)
    expect(screen.getByText('Muur schilderen')).toBeTruthy()
  })

  it('shows done tasks separately', () => {
    const tasks = [makeTask(1, 'done', { name: 'Gedaan taak' })]
    renderModal(makeProject(), tasks)
    expect(screen.getByText('Gedaan taak')).toBeTruthy()
    expect(screen.getByText(/afgerond/i)).toBeTruthy()
  })

  it('shows empty state when no tasks', () => {
    renderModal(makeProject(), [])
    expect(screen.getByText(/geen taken voor dit project/i)).toBeTruthy()
  })

  it('renders HTML preview when html_content is set', () => {
    renderModal(makeProject({ html_content: '<b>Test HTML</b>' }))
    expect(screen.getByText('Test HTML')).toBeTruthy()
  })

  it('does not render HTML preview when html_content is empty', () => {
    renderModal(makeProject({ html_content: '' }))
    const textareas = screen.getAllByRole('textbox')
    const htmlField = textareas.find(el => (el as HTMLTextAreaElement).placeholder?.includes('HTML')) as HTMLTextAreaElement
    expect(htmlField?.value).toBe('')
  })

  it('shows Lees voor button', () => {
    renderModal(makeProject())
    expect(screen.getByRole('button', { name: /lees voor/i })).toBeTruthy()
  })

  it('shows type badge in header', () => {
    renderModal(makeProject({ proj_type: 'routine' }))
    expect(screen.getByText(/routine/i)).toBeTruthy()
  })
})

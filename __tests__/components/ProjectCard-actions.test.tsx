import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Project } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({ createClient: () => ({ from: () => ({ update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }) }) }) }))

const { ProjectCard, sectionPatch, huidigeSectie } = await import('@/app/dashboard/ProjectsView')

beforeEach(() => { vi.clearAllMocks() })

function proj(over: Partial<Project> = {}): Project {
  return {
    id: 'tuinproject', user_id: 'u', cat_id: 'thuis', name: 'Schuur verbouwen', emoji: '🏚️',
    status: 'actief', description: '', vision: '', proj_type: 'project',
    notes: null, html_content: null, is_priority: false, sort_order: 0,
    created_at: '', updated_at: '', ...over,
  }
}

const CATS = [{ id: 'thuis', name: 'Thuis & Land' }, { id: 'muziek', name: 'Muzikant' }]

function toon(over: Partial<Project> = {}, extra: Record<string, unknown> = {}) {
  const onMove = vi.fn(), onMoveCategory = vi.fn(), onDelete = vi.fn(), onSelect = vi.fn()
  const p = proj(over)
  render(
    <ProjectCard
      p={p} tasks={[]} categories={CATS}
      onSelect={onSelect} onTogglePriority={vi.fn()}
      dragging={false} dragOver={false}
      onDragStart={vi.fn()} onDragEnter={vi.fn()} onDragEnd={vi.fn()}
      onMove={onMove} onMoveCategory={onMoveCategory} onDelete={onDelete}
      {...extra}
    />
  )
  return { onMove, onMoveCategory, onDelete, onSelect, p }
}

describe('ProjectCard — afvinken', () => {
  it('zet een project met één klik op klaar', () => {
    const { onMove, p } = toon()
    fireEvent.click(screen.getByLabelText('Schuur verbouwen markeren als klaar'))
    expect(onMove).toHaveBeenCalledWith(p, 'archive')
  })

  it('biedt bij een afgerond project juist "weer oppakken"', () => {
    const { onMove } = toon({ status: 'archief' })
    expect(screen.queryByLabelText(/markeren als klaar/)).toBeNull()
    fireEvent.click(screen.getByLabelText('Schuur verbouwen weer oppakken'))
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'tuinproject' }), 'active')
  })

  // De kaart zelf opent het project bij een klik — de actieknoppen mogen dat niet doen
  it('opent het project niet als je op een actieknop klikt', () => {
    const { onSelect } = toon()
    fireEvent.click(screen.getByLabelText(/markeren als klaar/))
    fireEvent.click(screen.getByLabelText(/verplaatsen/))
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('ProjectCard — verplaatsen', () => {
  it('verplaatst naar een andere sectie via het menu', () => {
    const { onMove, p } = toon()
    fireEvent.click(screen.getByLabelText('Schuur verbouwen verplaatsen'))
    fireEvent.click(within(screen.getByRole('menu')).getByText(/Routines/))
    expect(onMove).toHaveBeenCalledWith(p, 'routines')
  })

  it('verplaatst naar een ander levensgebied', () => {
    const { onMoveCategory, p } = toon()
    fireEvent.click(screen.getByLabelText('Schuur verbouwen verplaatsen'))
    fireEvent.click(within(screen.getByRole('menu')).getByText('Muzikant'))
    expect(onMoveCategory).toHaveBeenCalledWith(p, 'muziek')
  })

  it('biedt de sectie en categorie waar het project al staat niet aan', () => {
    toon()
    fireEvent.click(screen.getByLabelText('Schuur verbouwen verplaatsen'))
    const menu = within(screen.getByRole('menu'))
    expect(menu.getByText(/Overige projecten · staat hier/).closest('button')).toBeDisabled()
    expect(menu.getByText(/Thuis & Land · huidig/).closest('button')).toBeDisabled()
  })

  it('sluit het menu weer met een tweede klik', () => {
    toon()
    const knop = screen.getByLabelText('Schuur verbouwen verplaatsen')
    fireEvent.click(knop)
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.click(knop)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('ProjectCard — verwijderen', () => {
  it('verwijdert niet op de eerste klik, maar vraagt het eerst', () => {
    const { onDelete } = toon()
    fireEvent.click(screen.getByLabelText('Schuur verbouwen verwijderen'))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('verwijdert pas na bevestigen', () => {
    const { onDelete, p } = toon()
    fireEvent.click(screen.getByLabelText('Schuur verbouwen verwijderen'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Verwijder'))
    expect(onDelete).toHaveBeenCalledWith(p)
  })

  it('doet niets als je annuleert', () => {
    const { onDelete } = toon()
    fireEvent.click(screen.getByLabelText('Schuur verbouwen verwijderen'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Annuleer'))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // Projecten hebben geen prullenbak — dat mag de gebruiker niet pas achteraf ontdekken
  it('zegt erbij dat het definitief is en wat er met de rest gebeurt', () => {
    toon({}, {
      tasks: [{ id: 1, proj_id: 'tuinproject' }, { id: 2, proj_id: 'tuinproject' }],
      subProjects: [proj({ id: 'dak', name: 'Dak', parent_id: 'tuinproject' })],
    })
    fireEvent.click(screen.getByLabelText('Schuur verbouwen verwijderen'))
    const dialoog = screen.getByRole('dialog')
    expect(dialoog.textContent).toContain('kan niet ongedaan')
    expect(dialoog.textContent).toContain('2 taken gaan naar je inbox')
    expect(dialoog.textContent).toContain('1 sub-project blijft bestaan')
    expect(dialoog.textContent).toContain('Klaar in plaats van weg')
  })
})

describe('ProjectCard — zonder actie-handlers', () => {
  it('toont geen actiebalk als de kaart alleen-lezen is', () => {
    render(
      <ProjectCard p={proj()} tasks={[]} onSelect={vi.fn()} onTogglePriority={vi.fn()}
        dragging={false} dragOver={false}
        onDragStart={vi.fn()} onDragEnter={vi.fn()} onDragEnd={vi.fn()} />
    )
    expect(screen.queryByLabelText(/markeren als klaar/)).toBeNull()
    expect(screen.queryByLabelText(/verwijderen/)).toBeNull()
  })
})

describe('sectionPatch en huidigeSectie horen bij elkaar', () => {
  const gevallen: [SectieNaam, Partial<Project>][] = [
    ['priority', { is_priority: true }],
    ['active',   {}],
    ['routines', { proj_type: 'routine' }],
    ['sleeping', { status: 'slapend' }],
    ['archive',  { status: 'archief' }],
  ]
  type SectieNaam = 'priority' | 'active' | 'routines' | 'sleeping' | 'archive'

  it.each(gevallen)('een project dat naar %s verplaatst wordt, staat daarna ook in %s', kind => {
    const p = proj()
    const verplaatst = { ...p, ...sectionPatch(kind, p) }
    expect(huidigeSectie(verplaatst)).toBe(kind)
  })

  it.each(gevallen)('herkent %s aan de eigenschappen van het project', (kind, velden) => {
    expect(huidigeSectie(proj(velden))).toBe(kind)
  })

  it('maakt een slapend project weer wakker bij het oppakken', () => {
    const slapend = proj({ status: 'slapend' })
    expect(sectionPatch('active', slapend).status).toBe('lopend')
    expect(sectionPatch('priority', slapend).status).toBe('actief')
  })

  it('laat de status met rust bij een project dat al loopt', () => {
    const lopend = proj({ status: 'urgent' })
    expect(sectionPatch('active', lopend).status).toBe('urgent')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShoppingListPanel } from '@/app/dashboard/ShoppingListPanel'
import type { ShoppingItem } from '@/lib/types'

function makeItem(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return { id: 1, user_id: 'u', text: 'Melk', done: false, created_at: '', ...overrides }
}

describe('ShoppingListPanel — leeg', () => {
  it('toont een lege staat zonder items', () => {
    render(<ShoppingListPanel items={[]} onAdd={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/Nog niets op je lijstje/)).toBeInTheDocument()
  })
})

describe('ShoppingListPanel — item toevoegen', () => {
  it('roept onAdd aan met de getypte tekst en leegt het veld', () => {
    const onAdd = vi.fn()
    render(<ShoppingListPanel items={[]} onAdd={onAdd} onToggle={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Nieuw item…') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Plakband houder' } })
    fireEvent.click(screen.getByText('＋'))
    expect(onAdd).toHaveBeenCalledWith('Plakband houder')
    expect(input.value).toBe('')
  })

  it('voegt ook toe via Enter', () => {
    const onAdd = vi.fn()
    render(<ShoppingListPanel items={[]} onAdd={onAdd} onToggle={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Nieuw item…'), { target: { value: 'Brood' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Nieuw item…'), { key: 'Enter' })
    expect(onAdd).toHaveBeenCalledWith('Brood')
  })

  it('doet niets bij een lege of whitespace-only invoer', () => {
    const onAdd = vi.fn()
    render(<ShoppingListPanel items={[]} onAdd={onAdd} onToggle={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Nieuw item…'), { target: { value: '   ' } })
    fireEvent.click(screen.getByText('＋'))
    expect(onAdd).not.toHaveBeenCalled()
  })
})

describe('ShoppingListPanel — items beheren', () => {
  it('splitst open en gehaalde items, met een aparte kop voor "Gehaald"', () => {
    const items = [makeItem({ id: 1, text: 'Melk', done: false }), makeItem({ id: 2, text: 'Kaas', done: true })]
    render(<ShoppingListPanel items={items} onAdd={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Melk')).toBeInTheDocument()
    expect(screen.getByText('Kaas')).toBeInTheDocument()
    expect(screen.getByText(/Gehaald \(1\)/)).toBeInTheDocument()
  })

  it('vinkt een item af via onToggle', () => {
    const onToggle = vi.fn()
    render(<ShoppingListPanel items={[makeItem()]} onAdd={vi.fn()} onToggle={onToggle} onDelete={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Afvinken'))
    expect(onToggle).toHaveBeenCalledWith(1)
  })

  it('verwijdert een item via de prullenbak', () => {
    const onDelete = vi.fn()
    render(<ShoppingListPanel items={[makeItem()]} onAdd={vi.fn()} onToggle={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Verwijderen'))
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('sluit het paneel via het kruisje', () => {
    const onClose = vi.fn()
    render(<ShoppingListPanel items={[]} onAdd={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Sluiten'))
    expect(onClose).toHaveBeenCalled()
  })
})

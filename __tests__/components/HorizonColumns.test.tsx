import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HorizonColumns, type HorizonColumnDef } from '@/app/dashboard/HorizonColumns'

beforeEach(() => { localStorage.clear() })

function kolommen(n: number): HorizonColumnDef[] {
  return Array.from({ length: n }, (_, i) => ({ key: `k${i}`, content: <div>Kolom {i}</div> }))
}

describe('HorizonColumns', () => {
  it('toont de eerste 6 kolommen altijd', () => {
    render(<HorizonColumns columns={kolommen(10)} storageKey="test-open" />)
    for (let i = 0; i < 6; i++) expect(screen.getByText(`Kolom ${i}`)).toBeTruthy()
  })

  it('verbergt kolom 7 t/m 10 achter het inklapbare paneel, standaard dicht', () => {
    render(<HorizonColumns columns={kolommen(10)} storageKey="test-open" />)
    for (let i = 6; i < 10; i++) expect(screen.queryByText(`Kolom ${i}`)).toBeNull()
  })

  it('toont de lange-termijn-kolommen na klikken op het paneel', () => {
    render(<HorizonColumns columns={kolommen(10)} storageKey="test-open" />)
    fireEvent.click(screen.getByText(/Lange termijn/))
    for (let i = 6; i < 10; i++) expect(screen.getByText(`Kolom ${i}`)).toBeTruthy()
  })

  it('onthoudt de open/dicht-stand in localStorage', () => {
    render(<HorizonColumns columns={kolommen(10)} storageKey="test-open" />)
    fireEvent.click(screen.getByText(/Lange termijn/))
    expect(localStorage.getItem('test-open')).toBe('1')
    fireEvent.click(screen.getByText(/Lange termijn/))
    expect(localStorage.getItem('test-open')).toBe('0')
  })

  it('leest een eerder onthouden open-stand bij het laden', () => {
    localStorage.setItem('test-open', '1')
    render(<HorizonColumns columns={kolommen(10)} storageKey="test-open" />)
    expect(screen.getByText('Kolom 6')).toBeTruthy()
  })

  it('slaat kolommen zonder inhoud over (geen lege cellen)', () => {
    const cols: HorizonColumnDef[] = [
      { key: 'a', content: <div>A</div> },
      { key: 'b', content: null },
      { key: 'c', content: <div>C</div> },
    ]
    const { container } = render(<HorizonColumns columns={cols} storageKey="test-open2" />)
    expect(screen.getByText('A')).toBeTruthy()
    expect(screen.getByText('C')).toBeTruthy()
    // 2 kolommen met inhoud, geen derde lege wrapper-div
    expect(container.querySelectorAll(':scope > div > div > div').length).toBe(2)
  })

  it('toont het lange-termijn-paneel niet als er geen kolommen voorbij de eerste 6 zijn', () => {
    render(<HorizonColumns columns={kolommen(6)} storageKey="test-open3" />)
    expect(screen.queryByText(/Lange termijn/)).toBeNull()
  })
})

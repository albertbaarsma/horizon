import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationBell, type AlertItem } from '@/app/dashboard/NotificationBell'

function item(overrides: Partial<AlertItem> = {}): AlertItem {
  return {
    key: 'x', icon: '⚡', color: '#fb923c', body: <span>Een melding</span>,
    onDismiss: vi.fn(), dismissTitle: 'Wegklikken',
    ...overrides,
  }
}

describe('NotificationBell', () => {
  it('toont geen rood badge zonder meldingen', () => {
    render(<NotificationBell items={[]} />)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('toont het aantal meldingen in een rood badge', () => {
    render(<NotificationBell items={[item({ key: 'a' }), item({ key: 'b' })]} />)
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('is standaard dicht en gaat open bij een klik op het belletje', () => {
    render(<NotificationBell items={[item()]} />)
    expect(screen.queryByText('Een melding')).toBeNull()
    fireEvent.click(screen.getByTitle('1 melding'))
    expect(screen.getByText('Een melding')).toBeTruthy()
  })

  it('toont "Geen meldingen" als de lijst leeg is en je toch open klikt', () => {
    render(<NotificationBell items={[]} />)
    fireEvent.click(screen.getByTitle('Geen meldingen'))
    expect(screen.getByText(/Geen meldingen/)).toBeTruthy()
  })

  it('roept onDismiss aan voor de juiste melding', () => {
    const onDismiss = vi.fn()
    render(<NotificationBell items={[item({ key: 'a', onDismiss, dismissTitle: 'Weg met a' })]} />)
    fireEvent.click(screen.getByTitle('1 melding'))
    fireEvent.click(screen.getByTitle('Weg met a'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('sluit bij een klik buiten het paneel', () => {
    render(<div><NotificationBell items={[item()]} /><button>Ergens anders</button></div>)
    fireEvent.click(screen.getByTitle('1 melding'))
    expect(screen.getByText('Een melding')).toBeTruthy()
    fireEvent.click(screen.getByText('Ergens anders'))
    expect(screen.queryByText('Een melding')).toBeNull()
  })

  it('sluit met Escape', () => {
    render(<NotificationBell items={[item()]} />)
    fireEvent.click(screen.getByTitle('1 melding'))
    expect(screen.getByText('Een melding')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('Een melding')).toBeNull()
  })
})

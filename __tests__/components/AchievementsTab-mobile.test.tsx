import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Achievement, Category } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null }) }) }) }) }),
}))

const { AchievementsTab } = await import('@/app/dashboard/AchievementsTab')

const DESKTOP_WIDTH = window.innerWidth

function setWidth(w: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true })
  window.dispatchEvent(new Event('resize'))
}

afterEach(() => setWidth(DESKTOP_WIDTH))

const categories: Category[] = [
  { id: 'cat-1', user_id: 'uid', name: 'Gezondheid' },
]
const achievements: Achievement[] = [
  { id: 1, user_id: 'uid', date: '2026-09-01', text: 'Hardgelopen', emoji: '🏃', cat_id: 'cat-1', created_at: '' },
]

describe('AchievementsTab — mobiel', () => {
  it('toont de levensgebieden als een horizontale pillenrij i.p.v. een linker sidebar onder 768px', () => {
    setWidth(375)
    render(<AchievementsTab achievements={achievements} categories={categories} userId="uid" onAdd={() => {}} />)
    // De pillenrij-knop heeft role button; de desktop-sidebar gebruikt een niet-interactieve div.
    expect(screen.getByRole('button', { name: /Alles/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gezondheid/ })).toBeInTheDocument()
  })

  it('toont de linker sidebar (geen pillenrij) op desktopbreedte', () => {
    setWidth(1280)
    render(<AchievementsTab achievements={achievements} categories={categories} userId="uid" onAdd={() => {}} />)
    expect(screen.queryByRole('button', { name: /Alles/ })).not.toBeInTheDocument()
    expect(screen.getByText('Alles')).toBeInTheDocument()
    expect(screen.getByText('Levensgebied')).toBeInTheDocument()
  })
})

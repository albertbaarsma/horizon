import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DagTab } from '@/app/dashboard/DagTab'
import type { Task } from '@/lib/types'

function task(id: number, name: string, priority: number): Task {
  return { id, user_id: 'u', proj_id: null, name, status: 'backlog', urgent: false, priority, created_at: '', updated_at: '' }
}

function setup(tasks: Task[]) {
  return render(
    <DagTab today="2026-08-31" weekItems={[]} tasks={tasks} projects={[]} recurringTasks={[]}
      onToggle={vi.fn()} onAddItem={vi.fn()} onSetTime={vi.fn()} onTaskClick={vi.fn()} />
  )
}

describe('DagTab — openstaande taken op prioriteit', () => {
  it('toont openstaande taken van hoge naar lage prioriteit', () => {
    setup([task(1, 'Laag', 1), task(2, 'Hoog', 5), task(3, 'Geen', 0)])
    const names = screen.getAllByText(/^(Laag|Hoog|Geen)$/).map(el => el.textContent)
    expect(names).toEqual(['Hoog', 'Laag', 'Geen'])
  })

  it('toont een prioriteitsbadge', () => {
    setup([task(1, 'Belangrijk', 2)])
    expect(screen.getByText('🔺P2')).toBeInTheDocument()
  })
})

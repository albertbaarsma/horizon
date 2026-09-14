import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConsistencyPanel } from '@/app/dashboard/ConsistencyPanel'
import type { Issue } from '@/lib/consistency'

const NU = new Date('2026-08-08T12:00:00Z')

const issue = (over: Partial<Issue> = {}): Issue => ({
  kind: 'staat-uit-elkaar',
  key: 'task:1|week:2',
  title: 'Was doen',
  detail: 'Het planning "🧺 Was doen" staat op klaar, maar de taak "Was doen" staat nog open.',
  score: 1,
  items: [
    { kind: 'task', id: '1', name: 'Was doen', done: false },
    { kind: 'week', id: '2', name: '🧺 Was doen', done: true },
  ],
  ...over,
})

function paneel(issues: Issue[], over: Partial<React.ComponentProps<typeof ConsistencyPanel>> = {}) {
  const props = {
    issues, lastCheck: null as string | null, now: NU,
    onFix: vi.fn(), onIgnore: vi.fn(), onMarkChecked: vi.fn(), onClose: vi.fn(),
    ...over,
  }
  render(<ConsistencyPanel {...props} />)
  return props
}

describe('ConsistencyPanel', () => {
  it('vertelt wanneer er voor het laatst gecontroleerd is', () => {
    paneel([issue()], { lastCheck: '2026-08-07T09:00:00Z' })
    expect(screen.getByText(/gisteren gecontroleerd/)).toBeInTheDocument()
  })

  it('legt per punt uit wat er niet klopt', () => {
    paneel([issue()])
    expect(screen.getByText(/staat op klaar, maar de taak/)).toBeInTheDocument()
  })

  it('laat bij het open item afvinken én verwijderen toe', () => {
    const p = paneel([issue()])
    fireEvent.click(screen.getByLabelText('taak afvinken: Was doen'))
    expect(p.onFix).toHaveBeenCalledWith('task', '1', 'done')
    fireEvent.click(screen.getByLabelText('taak verwijderen: Was doen'))
    expect(p.onFix).toHaveBeenCalledWith('task', '1', 'delete')
  })

  it('biedt bij een item dat al klaar is geen afvinken meer', () => {
    paneel([issue()])
    expect(screen.queryByLabelText('planning afvinken: 🧺 Was doen')).not.toBeInTheDocument()
    expect(screen.getByLabelText('planning verwijderen: 🧺 Was doen')).toBeInTheDocument()
  })

  it('kan een punt met rust laten', () => {
    const p = paneel([issue()])
    fireEvent.click(screen.getByText(/Klopt zo, laat staan/))
    expect(p.onIgnore).toHaveBeenCalledWith('task:1|week:2')
  })

  it('groepeert per soort probleem', () => {
    paneel([
      issue(),
      issue({ kind: 'dubbel', key: 'a|b', detail: 'Staat als project én als taak.' }),
      issue({ kind: 'wees', key: 'c|d', detail: 'Verwijst naar iets dat weg is.' }),
    ])
    expect(screen.getByText('Staat uit elkaar')).toBeInTheDocument()
    expect(screen.getByText('Dubbel')).toBeInTheDocument()
    expect(screen.getByText('Losgeraakt')).toBeInTheDocument()
  })

  it('laat een groep in- en uitklappen', () => {
    paneel([issue()])
    fireEvent.click(screen.getByText('Staat uit elkaar'))
    expect(screen.queryByText(/staat op klaar, maar de taak/)).not.toBeInTheDocument()
  })

  it('meldt het als alles klopt', () => {
    paneel([])
    expect(screen.getByText(/allemaal hetzelfde/)).toBeInTheDocument()
  })

  it('kan afgetekend worden tot volgende week', () => {
    const p = paneel([issue()])
    fireEvent.click(screen.getByText(/Nagekeken/))
    expect(p.onMarkChecked).toHaveBeenCalled()
  })

  it('heeft als paneel een sluitknop, als volle kolom niet', () => {
    const { unmount } = render(<ConsistencyPanel issues={[issue()]} lastCheck={null} now={NU}
      onFix={vi.fn()} onIgnore={vi.fn()} onMarkChecked={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Controle sluiten')).toBeInTheDocument()
    unmount()
    render(<ConsistencyPanel full issues={[issue()]} lastCheck={null} now={NU}
      onFix={vi.fn()} onIgnore={vi.fn()} onMarkChecked={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByLabelText('Controle sluiten')).not.toBeInTheDocument()
  })
})

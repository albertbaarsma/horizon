import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { Profile, Task, Project, WeekItem, Achievement } from '@/lib/types'
import type { ParsedItem } from '@/app/api/achievements/parse/route'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/app/dashboard/VisiTab', () => ({
  ULTIEME_VISIE: 'Default ultieme visie tekst',
}))

const mockProfileUpdate = vi.fn()
const mockInsert        = vi.fn()
const mockSingle        = vi.fn()

function makeChain(result = { data: null as unknown, error: null }) {
  const q: Record<string, unknown> = {}
  q.eq     = () => q
  q.select = () => q
  q.update = (data: unknown) => { mockProfileUpdate(data); return q }
  q.insert = (rows: unknown) => { mockInsert(rows); return q }
  // single() returns an actual Promise so the caller can await it directly
  q.single = () => mockSingle()
  q.then   = (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve)
  q.catch  = (reject: (e: unknown) => void)        => Promise.resolve(result).catch(reject)
  return q
}

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ from: () => makeChain() }),
}))

// ── Lazy import after mocks ───────────────────────────────────────────────────

const { PlanningSessionModal } = await import('@/app/dashboard/PlanningSessionModal')

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'uid', display_name: 'Jordan', ai_token: 'tok', created_at: '',
    vision_text: 'Mijn visie', planning_music_url: 'https://music.youtube.com/test',
    ...overrides,
  }
}

function makeAchievement(overrides: Partial<Achievement> = {}): Achievement {
  return { id: 1, user_id: 'uid', date: TODAY, text: 'Test item', emoji: '🏆', cat_id: '', created_at: '', ...overrides }
}

const PROJECTS: Project[] = [
  { id: 'p1', user_id: 'uid', cat_id: 'c1', name: 'Acme Co', emoji: '🎹', status: 'actief', description: '', vision: '', proj_type: 'project', notes: null, html_content: null, is_priority: false, sort_order: 0, created_at: '', updated_at: '' },
  { id: 'p2', user_id: 'uid', cat_id: 'c1', name: 'YouTube',     emoji: '📹', status: 'actief', description: '', vision: '', proj_type: 'project', notes: null, html_content: null, is_priority: false, sort_order: 1, created_at: '', updated_at: '' },
]

function makeTask(id: number, status: Task['status'] = 'backlog', projId = 'p1'): Task {
  return { id, user_id: 'uid', proj_id: projId, name: `Taak ${id}`, status, urgent: false, priority: 0, created_at: '', updated_at: '' }
}

function getMonday(): string {
  const today = new Date()
  const dow = today.getDay()
  const daysFromMon = dow === 0 ? 6 : dow - 1
  const mon = new Date(today)
  mon.setDate(today.getDate() - daysFromMon)
  return mon.toISOString().slice(0, 10)
}

function makeWeekItem(taskId: number, date: string): WeekItem {
  return { id: taskId * 100, user_id: 'uid', date, type: 'task', text: `Taak ${taskId}`, done: false, proj_id: 'p1', task_id: String(taskId), recur_id: null, created_at: '' }
}

const onClose           = vi.fn()
const onSaved           = vi.fn()
const onAddAchievement  = vi.fn()
const onGoToWeek        = vi.fn()

function renderModal(
  profile       = makeProfile(),
  tasks: Task[] = [],
  weekItems: WeekItem[]      = [],
  projects                   = PROJECTS,
  achievements: Achievement[] = [],
) {
  return render(
    <PlanningSessionModal
      profile={profile} userId="uid"
      onClose={onClose} onSaved={onSaved} onGoToWeek={onGoToWeek}
      tasks={tasks} projects={projects} weekItems={weekItems}
      achievements={achievements} onAddAchievement={onAddAchievement}
    />
  )
}

function stubParseApi(items: ParsedItem[], error?: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: !error,
    json: () => Promise.resolve(error ? { error } : { items }),
  }))
}

function goToPhase(n: 2 | 3) {
  fireEvent.click(screen.getByText('Volgende →'))
  void n
}

function expandPaste() {
  fireEvent.click(screen.getByText(/Weeknotities plakken/))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PlanningSessionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('open', vi.fn())
    mockSingle.mockResolvedValue({ data: null, error: null })
  })

  // ── Structure & navigation ─────────────────────────────────────────────────

  describe('structure and navigation', () => {
    it('renders modal with 2 phase tabs', () => {
      renderModal()
      expect(screen.getByText(/🌟 Vision/)).toBeTruthy()
      expect(screen.getByText(/🏆 Achievements/)).toBeTruthy()
      expect(screen.queryByText(/📅 Week plan/)).toBeNull()
    })

    it('starts on phase 1 (Vision)', () => {
      renderModal()
      expect(screen.getByText('Jouw Ultimate Vision')).toBeTruthy()
    })

    it('Volgende → goes to phase 2', () => {
      renderModal()
      goToPhase(2)
      expect(screen.getByPlaceholderText('Wat heb je bereikt?')).toBeTruthy()
    })

    it('← Vorige on phase 2 goes back to phase 1', () => {
      renderModal()
      goToPhase(2)
      fireEvent.click(screen.getByText('← Vorige'))
      expect(screen.getByText('Jouw Ultimate Vision')).toBeTruthy()
    })

    it('← Vorige is disabled on phase 1', () => {
      renderModal()
      expect(screen.getByText('← Vorige').closest('button')).toHaveAttribute('disabled')
    })

    it('shows "Naar week planning →" on phase 2 instead of Volgende →', () => {
      renderModal()
      goToPhase(2)
      expect(screen.getByText('Naar week planning →')).toBeTruthy()
      expect(screen.queryByText('Volgende →')).toBeNull()
    })

    it('"Naar week planning →" calls onGoToWeek and onClose', () => {
      renderModal()
      goToPhase(2)
      fireEvent.click(screen.getByText('Naar week planning →'))
      expect(onGoToWeek).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })

    it('done phases show ✓ prefix in tab', () => {
      renderModal()
      goToPhase(2)
      expect(screen.getByText(/✓.*🌟 Vision/)).toBeTruthy()
    })

    it('closes on ✕ button', () => {
      renderModal()
      fireEvent.click(screen.getByText('✕'))
      expect(onClose).toHaveBeenCalled()
    })

    it('closes on Escape key', () => {
      renderModal()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalled()
    })

    it('closes on backdrop click', () => {
      const { container } = renderModal()
      fireEvent.click(container.firstChild as Element)
      expect(onClose).toHaveBeenCalled()
    })

    it('does NOT close when clicking inside the modal card', () => {
      renderModal()
      fireEvent.click(screen.getByText('Jouw Ultimate Vision'))
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  // ── Phase 1: Vision ────────────────────────────────────────────────────────

  describe('phase 1 — vision', () => {
    it('shows profile.vision_text in textarea', () => {
      renderModal(makeProfile({ vision_text: 'Mijn eigen visie' }))
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Mijn eigen visie')
    })

    it('shows ULTIEME_VISIE when profile.vision_text is null', () => {
      renderModal(makeProfile({ vision_text: null }))
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Default ultieme visie tekst')
    })

    it('shows "▶ Zet muziek aan" when music URL is set', () => {
      renderModal()
      expect(screen.getByText(/▶ Zet muziek aan/)).toBeTruthy()
    })

    it('shows no-music message when URL is empty string', () => {
      renderModal(makeProfile({ planning_music_url: '' }))
      expect(screen.getByText(/Geen muziek-URL ingesteld/)).toBeTruthy()
    })

    it('clicking music button calls window.open with the URL', () => {
      const openSpy = vi.fn()
      vi.stubGlobal('open', openSpy)
      renderModal()
      fireEvent.click(screen.getByText(/▶ Zet muziek aan/))
      expect(openSpy).toHaveBeenCalledWith(
        'https://music.youtube.com/test', '_blank', 'noopener,noreferrer'
      )
    })

    it('clicking "URL wijzigen" shows music URL input', () => {
      renderModal()
      fireEvent.click(screen.getByText('URL wijzigen'))
      expect(screen.getByPlaceholderText(/YouTube of Spotify URL/)).toBeTruthy()
    })

    it('pressing Enter in music URL input saves and hides input', async () => {
      renderModal()
      fireEvent.click(screen.getByText('URL wijzigen'))
      const input = screen.getByPlaceholderText(/YouTube of Spotify URL/)
      fireEvent.change(input, { target: { value: 'https://new-music.com' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      await waitFor(() => {
        expect(mockProfileUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ planning_music_url: 'https://new-music.com' })
        )
      })
      expect(screen.queryByPlaceholderText(/YouTube of Spotify URL/)).toBeNull()
    })

    it('clicking Opslaan saves music URL', async () => {
      renderModal()
      fireEvent.click(screen.getByText('URL wijzigen'))
      fireEvent.change(screen.getByPlaceholderText(/YouTube of Spotify URL/), {
        target: { value: 'https://spotify.com/test' },
      })
      fireEvent.click(screen.getByText('Opslaan'))
      await waitFor(() => {
        expect(mockProfileUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ planning_music_url: 'https://spotify.com/test' })
        )
      })
    })

    it('pressing Escape in music input reverts and closes input', () => {
      renderModal()
      fireEvent.click(screen.getByText('URL wijzigen'))
      fireEvent.keyDown(screen.getByPlaceholderText(/YouTube of Spotify URL/), { key: 'Escape' })
      expect(screen.queryByPlaceholderText(/YouTube of Spotify URL/)).toBeNull()
    })

    it('clicking Annuleer closes music input', () => {
      renderModal()
      fireEvent.click(screen.getByText('URL wijzigen'))
      fireEvent.click(screen.getByText('Annuleer'))
      expect(screen.queryByPlaceholderText(/YouTube of Spotify URL/)).toBeNull()
    })

    it('auto-saves defaults when profile fields are empty', async () => {
      renderModal(makeProfile({ vision_text: null, planning_music_url: null }))
      await waitFor(() => {
        expect(mockProfileUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ vision_text: 'Default ultieme visie tekst' })
        )
      })
    })

    it('vision text change debounces profile save', async () => {
      vi.useFakeTimers()
      try {
        renderModal()
        vi.clearAllMocks()
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nieuwe visie' } })
        expect(mockProfileUpdate).not.toHaveBeenCalled()
        await act(async () => { vi.advanceTimersByTime(1600) })
        expect(mockProfileUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ vision_text: 'Nieuwe visie' })
        )
      } finally {
        vi.useRealTimers()
      }
    })
  })

  // ── Phase 2: Quick-add ─────────────────────────────────────────────────────

  describe('phase 2 — quick-add tabs', () => {
    it('shows 3 type tabs (Achievement, Magic Moment, Verbeterpunt)', () => {
      renderModal()
      goToPhase(2)
      // Phase tabs are "🏆 Achievements" (with 's') — type tabs are "🏆 Achievement" (no 's')
      expect(screen.getByRole('button', { name: '🏆 Achievement' })).toBeTruthy()
      expect(screen.getByRole('button', { name: '✨ Magic Moment' })).toBeTruthy()
      expect(screen.getByRole('button', { name: '💡 Verbeterpunt' })).toBeTruthy()
    })

    it('shows achievement placeholder by default', () => {
      renderModal()
      goToPhase(2)
      expect(screen.getByPlaceholderText('Wat heb je bereikt?')).toBeTruthy()
    })

    it('switching to Magic Moment changes placeholder', () => {
      renderModal()
      goToPhase(2)
      fireEvent.click(screen.getByRole('button', { name: /✨ Magic Moment/ }))
      expect(screen.getByPlaceholderText(/Beschrijf het bijzondere moment/)).toBeTruthy()
    })

    it('switching to Verbeterpunt changes placeholder', () => {
      renderModal()
      goToPhase(2)
      fireEvent.click(screen.getByRole('button', { name: /💡 Verbeterpunt/ }))
      expect(screen.getByPlaceholderText(/Wat kan er beter/)).toBeTruthy()
    })

    it('+ button disabled when input is empty', () => {
      renderModal()
      goToPhase(2)
      // The + button is the one with text '+' next to the input
      const addBtn = screen.getAllByRole('button').find(b => b.textContent === '+')
      expect(addBtn).toBeTruthy()
      expect(addBtn).toHaveAttribute('disabled')
    })

    it('Enter with text calls Supabase insert with 🏆 emoji', async () => {
      const saved = makeAchievement({ id: 99, text: 'Piano geoefend', emoji: '🏆' })
      mockSingle.mockResolvedValueOnce({ data: saved, error: null })

      renderModal()
      goToPhase(2)
      fireEvent.change(screen.getByPlaceholderText('Wat heb je bereikt?'), {
        target: { value: 'Piano geoefend' },
      })
      fireEvent.keyDown(screen.getByPlaceholderText('Wat heb je bereikt?'), { key: 'Enter' })

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({ text: 'Piano geoefend', emoji: '🏆', user_id: 'uid' })
        )
      })
    })

    it('inserts with ✨ emoji when Magic Moment tab is active', async () => {
      const saved = makeAchievement({ id: 100, text: 'Bijzonder moment', emoji: '✨' })
      mockSingle.mockResolvedValueOnce({ data: saved, error: null })

      renderModal()
      goToPhase(2)
      fireEvent.click(screen.getByRole('button', { name: /✨ Magic Moment/ }))
      fireEvent.change(screen.getByPlaceholderText(/Beschrijf het bijzondere moment/), {
        target: { value: 'Bijzonder moment' },
      })
      fireEvent.keyDown(screen.getByPlaceholderText(/Beschrijf het bijzondere moment/), { key: 'Enter' })

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({ emoji: '✨', text: 'Bijzonder moment' })
        )
      })
    })

    it('inserts with 💡 emoji when Verbeterpunt tab is active', async () => {
      const saved = makeAchievement({ id: 101, text: 'Meer oefenen', emoji: '💡' })
      mockSingle.mockResolvedValueOnce({ data: saved, error: null })

      renderModal()
      goToPhase(2)
      fireEvent.click(screen.getByRole('button', { name: /💡 Verbeterpunt/ }))
      fireEvent.change(screen.getByPlaceholderText(/Wat kan er beter/), {
        target: { value: 'Meer oefenen' },
      })
      fireEvent.keyDown(screen.getByPlaceholderText(/Wat kan er beter/), { key: 'Enter' })

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({ emoji: '💡', text: 'Meer oefenen' })
        )
      })
    })

    it('calls onAddAchievement with saved achievement after quick-add', async () => {
      const saved = makeAchievement({ id: 99, text: 'Test', emoji: '🏆' })
      mockSingle.mockResolvedValueOnce({ data: saved, error: null })

      renderModal()
      goToPhase(2)
      fireEvent.change(screen.getByPlaceholderText('Wat heb je bereikt?'), { target: { value: 'Test' } })
      fireEvent.keyDown(screen.getByPlaceholderText('Wat heb je bereikt?'), { key: 'Enter' })

      await waitFor(() => expect(onAddAchievement).toHaveBeenCalledWith(saved))
    })

    it('calls onSaved after quick-add', async () => {
      const saved = makeAchievement({ id: 99, text: 'Test', emoji: '🏆' })
      mockSingle.mockResolvedValueOnce({ data: saved, error: null })

      renderModal()
      goToPhase(2)
      fireEvent.change(screen.getByPlaceholderText('Wat heb je bereikt?'), { target: { value: 'Test' } })
      fireEvent.keyDown(screen.getByPlaceholderText('Wat heb je bereikt?'), { key: 'Enter' })

      await waitFor(() => expect(onSaved).toHaveBeenCalled())
    })

    it('clears input after successful quick-add', async () => {
      const saved = makeAchievement({ id: 99, text: 'Test', emoji: '🏆' })
      mockSingle.mockResolvedValueOnce({ data: saved, error: null })

      renderModal()
      goToPhase(2)
      const input = screen.getByPlaceholderText('Wat heb je bereikt?')
      fireEvent.change(input, { target: { value: 'Test' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => expect((input as HTMLInputElement).value).toBe(''))
    })

    it('shows today\'s achievement entries (from props) in achievement tab', () => {
      const existing = makeAchievement({ id: 1, text: 'Al gedaan gisteren', emoji: '🏆', date: TODAY })
      renderModal(makeProfile(), [], [], PROJECTS, [existing])
      goToPhase(2)
      expect(screen.getByText('Al gedaan gisteren')).toBeTruthy()
    })

    it('does not show yesterday\'s entries', () => {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
      const old = makeAchievement({ text: 'Gisteren bereikt', date: yesterday })
      renderModal(makeProfile(), [], [], PROJECTS, [old])
      goToPhase(2)
      expect(screen.queryByText('Gisteren bereikt')).toBeNull()
    })

    it('filters entries by tab — ✨ entries hidden in achievement tab', () => {
      const magic = makeAchievement({ id: 2, text: 'Magisch moment', emoji: '✨' })
      renderModal(makeProfile(), [], [], PROJECTS, [magic])
      goToPhase(2)
      // On achievement tab: ✨ entry should not show
      expect(screen.queryByText('Magisch moment')).toBeNull()
      // Switch to magic tab: should show
      fireEvent.click(screen.getByRole('button', { name: /✨ Magic Moment/ }))
      expect(screen.getByText('Magisch moment')).toBeTruthy()
    })

    it('shows total today item count', () => {
      const items = [
        makeAchievement({ id: 1, emoji: '🏆', text: 'A' }),
        makeAchievement({ id: 2, emoji: '✨', text: 'B' }),
        makeAchievement({ id: 3, emoji: '💡', text: 'C' }),
      ]
      renderModal(makeProfile(), [], [], PROJECTS, items)
      goToPhase(2)
      expect(screen.getByText(/3 items toegevoegd vandaag/)).toBeTruthy()
    })

    it('newly quick-added item appears in today entries', async () => {
      const saved = makeAchievement({ id: 99, text: 'Nieuw item', emoji: '🏆' })
      mockSingle.mockResolvedValueOnce({ data: saved, error: null })

      renderModal()
      goToPhase(2)
      fireEvent.change(screen.getByPlaceholderText('Wat heb je bereikt?'), {
        target: { value: 'Nieuw item' },
      })
      fireEvent.keyDown(screen.getByPlaceholderText('Wat heb je bereikt?'), { key: 'Enter' })

      await waitFor(() => expect(screen.getByText('Nieuw item')).toBeTruthy())
    })
  })

  // ── Phase 2: Paste + AI (behind toggle) ────────────────────────────────────

  describe('phase 2 — paste + AI section', () => {
    it('paste textarea is NOT visible by default', () => {
      renderModal()
      goToPhase(2)
      expect(screen.queryByPlaceholderText(/Plak hier je notities/)).toBeNull()
    })

    it('shows "▼ Weeknotities plakken" toggle button', () => {
      renderModal()
      goToPhase(2)
      expect(screen.getByText(/Weeknotities plakken/)).toBeTruthy()
    })

    it('clicking toggle reveals paste textarea', () => {
      renderModal()
      goToPhase(2)
      expandPaste()
      expect(screen.getByPlaceholderText(/Plak hier je notities/)).toBeTruthy()
    })

    it('"Verwerk via AI" disabled when paste textarea is empty', () => {
      renderModal()
      goToPhase(2)
      expandPaste()
      expect(screen.getByText(/Verwerk via AI/).closest('button')).toHaveAttribute('disabled')
    })

    it('"Verwerk via AI" enabled after pasting text', () => {
      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), {
        target: { value: 'Ik heb iets bereikt' },
      })
      expect(screen.getByText(/Verwerk via AI/).closest('button')).not.toHaveAttribute('disabled')
    })

    it('calls /api/achievements/parse with pasted text', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [] }) })
      vi.stubGlobal('fetch', fetchMock)

      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), { target: { value: 'Piano geoefend' } })
      fireEvent.click(screen.getByText(/Verwerk via AI/))

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/achievements/parse', expect.objectContaining({ method: 'POST' }))
        const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
        expect(body.text).toBe('Piano geoefend')
      })
    })

    it('renders parsed items after API response', async () => {
      stubParseApi([
        { text: 'Piano geoefend',  type: 'accomplishment', emoji: '🏆' },
        { text: 'Mooi moment',     type: 'magic_moment',   emoji: '✨' },
      ])

      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), { target: { value: 'tekst' } })
      fireEvent.click(screen.getByText(/Verwerk via AI/))

      await waitFor(() => expect(screen.getByText('Piano geoefend')).toBeTruthy())
      expect(screen.getByText('Mooi moment')).toBeTruthy()
    })

    it('all parsed items checked by default', async () => {
      stubParseApi([
        { text: 'A', type: 'accomplishment', emoji: '🏆' },
        { text: 'B', type: 'magic_moment',   emoji: '✨' },
      ])

      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), { target: { value: 'tekst' } })
      fireEvent.click(screen.getByText(/Verwerk via AI/))

      await waitFor(() => screen.getByText('A'))
      const cbs = screen.getAllByRole('checkbox') as HTMLInputElement[]
      expect(cbs).toHaveLength(2)
      cbs.forEach(cb => expect(cb.checked).toBe(true))
    })

    it('save button shows checked count', async () => {
      stubParseApi([
        { text: 'A', type: 'accomplishment', emoji: '🏆' },
        { text: 'B', type: 'magic_moment',   emoji: '✨' },
        { text: 'C', type: 'verbeterpunt',   emoji: '📝' },
      ])

      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), { target: { value: 'tekst' } })
      fireEvent.click(screen.getByText(/Verwerk via AI/))

      await waitFor(() => expect(screen.getByText(/Sla 3 items op/)).toBeTruthy())
    })

    it('unchecking item reduces count', async () => {
      stubParseApi([
        { text: 'A', type: 'accomplishment', emoji: '🏆' },
        { text: 'B', type: 'magic_moment',   emoji: '✨' },
      ])

      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), { target: { value: 'tekst' } })
      fireEvent.click(screen.getByText(/Verwerk via AI/))

      await waitFor(() => screen.getByText('A'))
      fireEvent.click(screen.getAllByRole('checkbox')[0])
      expect(screen.getByText(/Sla 1 item op/)).toBeTruthy()
    })

    it('saves only checked items to Supabase', async () => {
      stubParseApi([
        { text: 'Piano geoefend', type: 'accomplishment', emoji: '🏆' },
        { text: 'Zonsondergang',  type: 'magic_moment',   emoji: '✨' },
      ])

      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), { target: { value: 'tekst' } })
      fireEvent.click(screen.getByText(/Verwerk via AI/))

      await waitFor(() => screen.getByText('Piano geoefend'))
      fireEvent.click(screen.getAllByRole('checkbox')[1]) // uncheck second
      fireEvent.click(screen.getByText(/Sla 1 item op/))

      await waitFor(() => {
        const rows = mockInsert.mock.calls[0][0] as unknown[]
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ text: 'Piano geoefend', emoji: '🏆' })
      })
    })

    it('calls onSaved after AI save', async () => {
      stubParseApi([{ text: 'Item X', type: 'accomplishment', emoji: '🏆' }])

      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), { target: { value: 'tekst' } })
      fireEvent.click(screen.getByText(/Verwerk via AI/))
      await waitFor(() => screen.getByText('Item X'))
      fireEvent.click(screen.getByText(/Sla 1 item op/))

      await waitFor(() => expect(onSaved).toHaveBeenCalled())
    })

    it('shows inline success state after AI save', async () => {
      stubParseApi([{ text: 'Item X', type: 'accomplishment', emoji: '🏆' }])

      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), { target: { value: 'tekst' } })
      fireEvent.click(screen.getByText(/Verwerk via AI/))
      await waitFor(() => screen.getByText('Item X'))
      fireEvent.click(screen.getByText(/Sla 1 item op/))

      await waitFor(() => expect(screen.getByText(/1 items via AI opgeslagen/)).toBeTruthy())
      expect(screen.getByText('🎉')).toBeTruthy()
    })

    it('"Opnieuw plakken" resets to paste textarea', async () => {
      stubParseApi([{ text: 'Item X', type: 'accomplishment', emoji: '🏆' }])

      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), { target: { value: 'tekst' } })
      fireEvent.click(screen.getByText(/Verwerk via AI/))
      await waitFor(() => screen.getByText('Item X'))
      fireEvent.click(screen.getByText('Opnieuw plakken'))

      expect(screen.getByPlaceholderText(/Plak hier je notities/)).toBeTruthy()
    })

    it('shows API error message', async () => {
      stubParseApi([], 'AI-fout opgetreden')

      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), { target: { value: 'tekst' } })
      fireEvent.click(screen.getByText(/Verwerk via AI/))

      await waitFor(() => expect(screen.getByText('AI-fout opgetreden')).toBeTruthy())
    })

    it('shows "Verbindingsfout" on fetch failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      renderModal()
      goToPhase(2)
      expandPaste()
      fireEvent.change(screen.getByPlaceholderText(/Plak hier je notities/), { target: { value: 'tekst' } })
      fireEvent.click(screen.getByText(/Verwerk via AI/))

      await waitFor(() => expect(screen.getByText(/Verbindingsfout/)).toBeTruthy())
    })
  })

  // ── Phase 3: Week plan — hidden/disabled for now ──────────────────────────

  describe.skip('phase 3 — week plan (disabled)', () => {
    it('shows empty state when no backlog or doing tasks', () => {
      renderModal(makeProfile(), [])
      goToPhase(3)
      expect(screen.getByText('Geen backlog taken gevonden')).toBeTruthy()
    })

    it('shows backlog tasks', () => {
      renderModal(makeProfile(), [makeTask(1, 'backlog')])
      goToPhase(3)
      expect(screen.getByText('Taak 1')).toBeTruthy()
    })

    it('shows doing tasks (also eligible for planning)', () => {
      renderModal(makeProfile(), [makeTask(2, 'doing')])
      goToPhase(3)
      expect(screen.getByText('Taak 2')).toBeTruthy()
    })

    it('hides waiting and done tasks', () => {
      renderModal(makeProfile(), [makeTask(3, 'waiting'), makeTask(4, 'done')])
      goToPhase(3)
      expect(screen.getByText('Geen backlog taken gevonden')).toBeTruthy()
    })

    it('shows project group header above tasks', () => {
      renderModal(makeProfile(), [makeTask(1)])
      goToPhase(3)
      expect(screen.getByText(/Acme Co/)).toBeTruthy()
    })

    it('groups tasks by project', () => {
      const tasks = [makeTask(1, 'backlog', 'p1'), makeTask(2, 'backlog', 'p2')]
      renderModal(makeProfile(), tasks)
      goToPhase(3)
      expect(screen.getByText(/Acme Co/)).toBeTruthy()
      expect(screen.getByText(/YouTube/)).toBeTruthy()
    })

    it('clicking a day button marks it selected (●)', () => {
      renderModal(makeProfile(), [makeTask(1)])
      goToPhase(3)
      const freeBtn = screen.getAllByRole('button').find(b =>
        ['Zo','Ma','Di','Wo','Do','Vr','Za'].includes(b.getAttribute('title') ?? '')
      )!
      fireEvent.click(freeBtn)
      expect(freeBtn.textContent).toBe('●')
    })

    it('clicking selected day button deselects it', () => {
      renderModal(makeProfile(), [makeTask(1)])
      goToPhase(3)
      const freeBtn = screen.getAllByRole('button').find(b =>
        ['Zo','Ma','Di','Wo','Do','Vr','Za'].includes(b.getAttribute('title') ?? '')
      )!
      fireEvent.click(freeBtn)
      fireEvent.click(freeBtn)
      expect(freeBtn.textContent).toBe('')
    })

    it('save button is disabled when no days selected', () => {
      renderModal(makeProfile(), [makeTask(1)])
      goToPhase(3)
      expect(screen.getByText('Selecteer taken').closest('button')).toHaveAttribute('disabled')
    })

    it('save button shows assignment count after selection', () => {
      renderModal(makeProfile(), [makeTask(1)])
      goToPhase(3)
      const freeBtn = screen.getAllByRole('button').find(b =>
        ['Zo','Ma','Di','Wo','Do','Vr','Za'].includes(b.getAttribute('title') ?? '')
      )!
      fireEvent.click(freeBtn)
      expect(screen.getByText(/Plan 1 item in/)).toBeTruthy()
    })

    it('already-planned tasks show ✓ and title "Al ingepland"', () => {
      const monday = getMonday()
      renderModal(makeProfile(), [makeTask(1)], [makeWeekItem(1, monday)])
      goToPhase(3)
      const planned = screen.getAllByTitle('Al ingepland')
      expect(planned.length).toBeGreaterThan(0)
      expect(planned[0].textContent).toBe('✓')
    })

    it('already-planned tasks cannot be toggled', () => {
      const monday = getMonday()
      renderModal(makeProfile(), [makeTask(1)], [makeWeekItem(1, monday)])
      goToPhase(3)
      const planned = screen.getAllByTitle('Al ingepland')[0]
      fireEvent.click(planned)
      expect(planned.textContent).toBe('✓')
    })

    it('Reset button clears all selections', () => {
      renderModal(makeProfile(), [makeTask(1)])
      goToPhase(3)
      const freeBtn = screen.getAllByRole('button').find(b =>
        ['Zo','Ma','Di','Wo','Do','Vr','Za'].includes(b.getAttribute('title') ?? '')
      )!
      fireEvent.click(freeBtn)
      fireEvent.click(screen.getByText('Reset'))
      expect(screen.getByText('Selecteer taken')).toBeTruthy()
      expect(screen.queryByText('Reset')).toBeNull()
    })

    it('saves assignments to week_items on save', async () => {
      renderModal(makeProfile(), [makeTask(1)])
      goToPhase(3)
      const freeBtn = screen.getAllByRole('button').find(b =>
        ['Zo','Ma','Di','Wo','Do','Vr','Za'].includes(b.getAttribute('title') ?? '')
      )!
      fireEvent.click(freeBtn)
      fireEvent.click(screen.getByText(/Plan 1 item in/))

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(expect.arrayContaining([
          expect.objectContaining({ type: 'task', text: 'Taak 1', user_id: 'uid', task_id: '1' }),
        ]))
      })
    })

    it('shows weekSaved success state (✅) after saving', async () => {
      renderModal(makeProfile(), [makeTask(1)])
      goToPhase(3)
      const freeBtn = screen.getAllByRole('button').find(b =>
        ['Zo','Ma','Di','Wo','Do','Vr','Za'].includes(b.getAttribute('title') ?? '')
      )!
      fireEvent.click(freeBtn)
      fireEvent.click(screen.getByText(/Plan 1 item in/))

      await waitFor(() => {
        expect(screen.getByText('Weekplan opgeslagen!')).toBeTruthy()
        expect(screen.getByText('✅')).toBeTruthy()
      })
    })

    it('"Meer plannen" resets back to task grid', async () => {
      renderModal(makeProfile(), [makeTask(1)])
      goToPhase(3)
      const freeBtn = screen.getAllByRole('button').find(b =>
        ['Zo','Ma','Di','Wo','Do','Vr','Za'].includes(b.getAttribute('title') ?? '')
      )!
      fireEvent.click(freeBtn)
      fireEvent.click(screen.getByText(/Plan 1 item in/))
      await waitFor(() => screen.getByText('Meer plannen'))
      fireEvent.click(screen.getByText('Meer plannen'))
      expect(screen.getByText('Taak 1')).toBeTruthy()
    })

    it('calls onSaved after week plan saved', async () => {
      renderModal(makeProfile(), [makeTask(1)])
      goToPhase(3)
      const freeBtn = screen.getAllByRole('button').find(b =>
        ['Zo','Ma','Di','Wo','Do','Vr','Za'].includes(b.getAttribute('title') ?? '')
      )!
      fireEvent.click(freeBtn)
      fireEvent.click(screen.getByText(/Plan 1 item in/))
      await waitFor(() => expect(onSaved).toHaveBeenCalled())
    })
  })
})

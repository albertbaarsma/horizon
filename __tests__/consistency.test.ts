import { describe, it, expect } from 'vitest'
import {
  toItems, looksSame, sharedKeywords, findPairs, findOrphans, runChecks,
  checkIsDue, laatsteControleTekst, ISSUE_META, KIND_LABEL, CHECK_INTERVAL_DAGEN,
  type Item,
} from '@/lib/consistency'
import type { Goal, Project, Task, WeekItem, RecurringTask } from '@/lib/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function goal(id: number, text: string, extra: Partial<Goal> = {}): Goal {
  return { id, user_id: 'u', horizon: 'kwartaal', text, done: false, cat_id: 'c', deadline: null, created_at: '', ...extra }
}
function project(id: string, name: string, extra: Partial<Project> = {}): Project {
  return { id, user_id: 'u', cat_id: 'c', name, emoji: '🎯', status: 'actief', description: '', vision: '',
    proj_type: 'project', notes: null, html_content: null, is_priority: false, sort_order: 0, created_at: '', updated_at: '', ...extra }
}
function task(id: number, name: string, extra: Partial<Task> = {}): Task {
  return { id, user_id: 'u', proj_id: null, name, status: 'backlog', urgent: false, priority: 0, created_at: '', updated_at: '', ...extra }
}
function week(id: number, text: string, extra: Partial<WeekItem> = {}): WeekItem {
  return { id, user_id: 'u', date: '2026-08-08', type: 'task', text, done: false,
    proj_id: null, task_id: null, recur_id: null, created_at: '', ...extra }
}
function recur(id: number, name: string, extra: Partial<RecurringTask> = {}): RecurringTask {
  return { id, user_id: 'u', name, type: 'task', days: ['monday'], cat_id: null, proj_id: null, active: true, created_at: '', ...extra }
}

const leeg = { goals: [], projects: [], tasks: [], weekItems: [], recurringTasks: [] }
const item = (kind: Item['kind'], name: string, done = false): Item => ({ kind, id: '1', name, done })

// ── Alles op één hoop ─────────────────────────────────────────────────────────

describe('toItems', () => {
  it('neemt doelen, projecten, taken, planning en herhaaltaken mee', () => {
    const items = toItems({
      goals: [goal(1, 'Doel')], projects: [project('p', 'Project')], tasks: [task(1, 'Taak')],
      weekItems: [week(1, 'Planning')], recurringTasks: [recur(1, 'Routine')],
    })
    expect(items.map(i => i.kind).sort()).toEqual(['goal', 'project', 'recurring', 'task', 'week'])
  })

  it('laat weggegooide doelen buiten de controle', () => {
    expect(toItems({ ...leeg, goals: [goal(1, 'Weg', { deleted_at: '2026-08-01' })] })).toEqual([])
  })

  it('laat uitgezette herhaaltaken buiten de controle', () => {
    expect(toItems({ ...leeg, recurringTasks: [recur(1, 'Uit', { active: false })] })).toEqual([])
  })

  it('ziet een gearchiveerd project als afgerond werk', () => {
    const items = toItems({ ...leeg, projects: [project('p', 'Klaar', { status: 'archief' })] })
    expect(items[0].done).toBe(true)
  })

  it('markeert planning die uit een herhaaltaak komt', () => {
    const items = toItems({ ...leeg, weekItems: [week(1, 'Sportschool', { recur_id: 3 })] })
    expect(items[0].fromRecurring).toBe(true)
  })
})

// ── Namen vergelijken ─────────────────────────────────────────────────────────

describe('sharedKeywords', () => {
  it('geeft de gedeelde inhoudswoorden', () => {
    expect(sharedKeywords('Schuur opruimen — vaste plek', 'Schuur opruimen').sort()).toEqual(['opruimen', 'schuur'])
  })

  it('negeert stopwoorden', () => {
    expect(sharedKeywords('Naar de winkel', 'Naar het bos')).toEqual([])
  })
})

describe('looksSame', () => {
  it('ziet dezelfde naam met andere emoji en hoofdletters als zeker hetzelfde', () => {
    expect(looksSame(item('task', 'Was doen'), item('week', '🧺 was DOEN'))).toBe(1)
  })

  it('herkent een langere formulering als vermoeden, niet als zekerheid', () => {
    const s = looksSame(item('goal', '🎵 Lemon Tree afronden met Lisette'), item('project', 'Lemon Tree afronden'))
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(1)
  })

  it('koppelt niet op één gedeeld woord', () => {
    // "Naar Lisette" moet zich niet aan elk doel met Lisette erin vastplakken
    expect(looksSame(item('week', 'Naar Lisette'), item('goal', '❤️ Lisette afspraak 28 jun'))).toBe(0)
    expect(looksSame(item('week', '🏋️ Sportschool (1/4)'), item('task', 'Sportschool 4x deze week'))).toBe(0)
  })

  it('koppelt niets aan een lege naam', () => {
    expect(looksSame(item('task', ''), item('task', ''))).toBe(0)
  })

  it('koppelt geen los staande dingen', () => {
    expect(looksSame(item('task', 'Regenpijp repareren'), item('task', 'Setlist oefenen'))).toBe(0)
  })
})

// ── Paren ─────────────────────────────────────────────────────────────────────

describe('findPairs', () => {
  it('meldt het als iets op de ene plek klaar is en op de andere niet', () => {
    const issues = findPairs(toItems({
      ...leeg, tasks: [task(1, 'Was doen')], weekItems: [week(1, '🧺 Was doen', { done: true })],
    }))
    expect(issues).toHaveLength(1)
    expect(issues[0].kind).toBe('staat-uit-elkaar')
    expect(issues[0].detail).toContain('staat nog open')
    // Het open item staat vooraan, dat is waar je iets aan wilt doen
    expect(issues[0].items[0].kind).toBe('task')
    expect(issues[0].items[0].done).toBe(false)
  })

  it('meldt dubbel werk als beide nog open staan', () => {
    const issues = findPairs(toItems({
      ...leeg, projects: [project('p', 'Schuur opruimen')], tasks: [task(1, 'Schuur opruimen')],
    }))
    expect(issues).toHaveLength(1)
    expect(issues[0].kind).toBe('dubbel')
  })

  it('zwijgt als beide klaar zijn', () => {
    const issues = findPairs(toItems({
      ...leeg, tasks: [task(1, 'Was doen', { status: 'done' })], weekItems: [week(1, 'Was doen', { done: true })],
    }))
    expect(issues).toEqual([])
  })

  it('valt niet over dezelfde planning in verschillende weken', () => {
    const issues = findPairs(toItems({
      ...leeg, weekItems: [week(1, 'Was doen', { done: true }), week(2, 'Was doen', { date: '2026-08-15' })],
    }))
    expect(issues).toEqual([])
  })

  it('valt niet over een herhaaltaak die in de planning terugkomt', () => {
    const issues = findPairs(toItems({
      ...leeg, recurringTasks: [recur(1, 'Sportschool armen')], weekItems: [week(1, 'Sportschool armen', { done: true })],
    }))
    expect(issues).toEqual([])
  })

  it('gebruikt een afgevinkte routine-dag niet als bewijs over losse taken', () => {
    const issues = findPairs(toItems({
      ...leeg, tasks: [task(1, 'Thuis benen')], weekItems: [week(1, 'Thuis benen', { done: true, recur_id: 9 })],
    }))
    expect(issues).toEqual([])
  })

  it('geeft elk paar één keer terug, ongeacht de volgorde', () => {
    const items = toItems({ ...leeg, tasks: [task(1, 'Was doen'), task(2, 'Was doen')] })
    const keys = findPairs(items).map(i => i.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

// ── Losgeraakte verwijzingen ──────────────────────────────────────────────────

describe('findOrphans', () => {
  it('vindt een taak onder een verdwenen project', () => {
    const issues = findOrphans({ ...leeg, tasks: [task(1, 'Losse taak', { proj_id: 'weg' })] })
    expect(issues).toHaveLength(1)
    expect(issues[0].kind).toBe('wees')
  })

  it('vindt planning die naar een verwijderde taak wijst', () => {
    const issues = findOrphans({ ...leeg, weekItems: [week(1, 'Planning', { task_id: '404' })] })
    expect(issues[0].detail).toContain('verwijderd')
  })

  it('vindt planning onder een verdwenen herhaaltaak of project', () => {
    expect(findOrphans({ ...leeg, weekItems: [week(1, 'P', { recur_id: 99 })] })).toHaveLength(1)
    expect(findOrphans({ ...leeg, weekItems: [week(1, 'P', { proj_id: 'weg' })] })).toHaveLength(1)
  })

  it('zwijgt als alle verwijzingen kloppen', () => {
    const issues = findOrphans({
      ...leeg,
      projects: [project('p', 'Project')],
      tasks: [task(7, 'Taak', { proj_id: 'p' })],
      weekItems: [week(1, 'Planning', { task_id: '7', proj_id: 'p' })],
    })
    expect(issues).toEqual([])
  })
})

// ── Alles samen ───────────────────────────────────────────────────────────────

describe('runChecks', () => {
  const input = {
    ...leeg,
    goals: [goal(1, 'Schuur opruimen helemaal af', { done: true })],
    projects: [project('p', 'Schuur opruimen')],
    tasks: [task(1, 'Losse taak', { proj_id: 'weg' })],
  }

  it('zet losgeraakte verwijzingen bovenaan', () => {
    const issues = runChecks(input)
    expect(issues[0].kind).toBe('wees')
  })

  it('slaat punten over die je met rust wilt laten', () => {
    const issues = runChecks(input)
    const zonder = runChecks(input, [issues[0].key])
    expect(zonder.map(i => i.key)).not.toContain(issues[0].key)
    expect(zonder).toHaveLength(issues.length - 1)
  })

  it('geeft elk punt een uitleg en een geldige soort', () => {
    for (const i of runChecks(input)) {
      expect(i.detail.length).toBeGreaterThan(10)
      expect(ISSUE_META[i.kind]).toBeDefined()
      i.items.forEach(x => expect(KIND_LABEL[x.kind]).toBeDefined())
    }
  })

  it('zwijgt over een schone administratie', () => {
    expect(runChecks({
      ...leeg,
      projects: [project('p', 'Boerderij')],
      tasks: [task(1, 'Regenpijp repareren', { proj_id: 'p' })],
      goals: [goal(1, 'Dak waterdicht')],
    })).toEqual([])
  })

  it('is stabiel: dezelfde data geeft dezelfde uitkomst', () => {
    expect(runChecks(input)).toEqual(runChecks(input))
  })
})

// ── Wekelijkse controle ───────────────────────────────────────────────────────

describe('checkIsDue', () => {
  const nu = new Date('2026-08-08T12:00:00Z')

  it('is meteen aan de orde als er nog nooit gecontroleerd is', () => {
    expect(checkIsDue(null, nu)).toBe(true)
    expect(checkIsDue('geen datum', nu)).toBe(true)
  })

  it('wacht een week na een controle', () => {
    expect(checkIsDue('2026-08-06T12:00:00Z', nu)).toBe(false)
    expect(checkIsDue('2026-08-01T12:00:00Z', nu)).toBe(true)
  })

  it('houdt zich aan de standaard van een week', () => {
    expect(CHECK_INTERVAL_DAGEN).toBe(7)
  })
})

describe('laatsteControleTekst', () => {
  const nu = new Date('2026-08-08T12:00:00Z')

  it('zegt in gewone taal hoe lang het geleden is', () => {
    expect(laatsteControleTekst(null, nu)).toBe('nog niet gecontroleerd')
    expect(laatsteControleTekst('2026-08-08T09:00:00Z', nu)).toBe('vandaag gecontroleerd')
    expect(laatsteControleTekst('2026-08-07T09:00:00Z', nu)).toBe('gisteren gecontroleerd')
    expect(laatsteControleTekst('2026-08-01T12:00:00Z', nu)).toBe('7 dagen geleden gecontroleerd')
  })
})

describe('findOrphans — afgerond project met open werk', () => {
  it('meldt een open taak onder een gearchiveerd project', () => {
    const issues = findOrphans({
      ...leeg,
      projects: [project('schuur', 'Schuur opruimen', { status: 'archief' })],
      tasks: [task(1, 'Laatste dozen wegzetten', { proj_id: 'schuur' })],
    })
    expect(issues).toHaveLength(1)
    expect(issues[0].detail).toContain('afgerond')
  })

  it('zwijgt als die taak zelf ook klaar is', () => {
    const issues = findOrphans({
      ...leeg,
      projects: [project('schuur', 'Schuur opruimen', { status: 'archief' })],
      tasks: [task(1, 'Laatste dozen', { proj_id: 'schuur', status: 'done' })],
    })
    expect(issues).toEqual([])
  })

  it('zwijgt bij een project dat gewoon loopt', () => {
    const issues = findOrphans({
      ...leeg,
      projects: [project('schuur', 'Schuur opruimen')],
      tasks: [task(1, 'Laatste dozen', { proj_id: 'schuur' })],
    })
    expect(issues).toEqual([])
  })
})

import { describe, it, expect, vi } from 'vitest'
import { UsageTracker, TRACKED_FEATURES, TAB_LABELS, type UsageEvent } from '@/lib/usage'
import { buildReport, tabUse, featureUse, suggestions, meetPeriode, reportAsText, minuten } from '@/lib/usage-report'

// ── Verzamelen ────────────────────────────────────────────────────────────────

function tracker(opts: { aan?: boolean } = {}) {
  const verzonden: unknown[][] = []
  let klok = 1_000_000
  const t = new UsageTracker(
    rijen => { verzonden.push(rijen) },
    () => opts.aan ?? true,
    () => klok,
  )
  return { t, verzonden, tik: (ms: number) => { klok += ms } }
}

describe('UsageTracker', () => {
  it('legt een tabbezoek vast met de kijktijd', async () => {
    const { t, verzonden, tik } = tracker()
    t.tab('week'); tik(30_000); t.tab('tasks')
    await t.flush()
    expect(verzonden[0]).toEqual([
      { kind: 'tab', target: 'week', seconds: 30 },
      { kind: 'tab', target: 'tasks', seconds: 0 },
    ].filter(r => r.seconds >= 1))
  })

  it('slaat een doorklik van onder een seconde over', async () => {
    const { t, verzonden, tik } = tracker()
    t.tab('week'); tik(400); t.tab('goals'); tik(5_000)
    await t.flush()
    const rijen = verzonden[0] as { target: string }[]
    expect(rijen.map(r => r.target)).toEqual(['goals'])
  })

  it('doet niets bij twee keer dezelfde tab', async () => {
    const { t, verzonden, tik } = tracker()
    t.tab('week'); tik(10_000); t.tab('week'); tik(10_000)
    await t.flush()
    expect(verzonden[0]).toEqual([{ kind: 'tab', target: 'week', seconds: 20 }])
  })

  it('legt gebruikte onderdelen vast', async () => {
    const { t, verzonden } = tracker()
    t.feature('taak-afvinken'); t.feature('taak-afvinken'); t.feature('zoeken')
    await t.flush()
    expect(verzonden[0]).toHaveLength(3)
  })

  it('meet niets als meten uit staat', async () => {
    const { t, verzonden, tik } = tracker({ aan: false })
    t.tab('week'); tik(30_000); t.tab('goals'); t.feature('zoeken')
    await t.flush()
    expect(verzonden).toEqual([])
  })

  it('verzendt niets bij een lege buffer', async () => {
    const { t, verzonden } = tracker()
    await t.flush()
    expect(verzonden).toEqual([])
  })

  it('maakt de buffer leeg na verzenden, zodat niets dubbel gaat', async () => {
    const { t, verzonden, tik } = tracker()
    t.tab('week'); tik(5_000)
    await t.flush()
    await t.flush()
    expect(verzonden).toHaveLength(1)
    expect(t.wachtrij).toHaveLength(0)
  })

  it('sluit de openstaande tab af bij het verlaten van de pagina', async () => {
    const { t, verzonden, tik } = tracker()
    t.tab('dag'); tik(120_000)
    await t.flush()
    expect(verzonden[0]).toEqual([{ kind: 'tab', target: 'dag', seconds: 120 }])
  })
})

// ── Rapport ───────────────────────────────────────────────────────────────────

const NU = new Date('2026-08-31T12:00:00Z')
const ev = (kind: 'tab'|'feature', target: string, dagenTerug: number, seconds?: number): UsageEvent => ({
  kind, target, seconds: seconds ?? null,
  created_at: new Date(NU.getTime() - dagenTerug * 86400000).toISOString(),
})

describe('meetPeriode', () => {
  it('rekent vanaf de eerste meting', () => {
    expect(meetPeriode([ev('tab','week',20,10), ev('tab','week',1,10)], NU).days).toBe(20)
  })

  it('geeft nul dagen bij niets', () => {
    expect(meetPeriode([], NU)).toEqual({ from: null, to: null, days: 0 })
  })
})

describe('tabUse', () => {
  const events = [
    ev('tab','week',5,600), ev('tab','week',2,300),
    ev('tab','dag',1,120),
    ev('feature','zoeken',1),
  ]

  it('telt bezoeken en tijd per tab, langst eerst', () => {
    const r = tabUse(events, NU, ['week','dag','mail'])
    expect(r[0]).toMatchObject({ tab: 'week', visits: 2, seconds: 900, avgSeconds: 450 })
    expect(r[1].tab).toBe('dag')
  })

  it('noemt een nooit bezochte tab met nul', () => {
    const mail = tabUse(events, NU, ['mail'])[0]
    expect(mail).toMatchObject({ visits: 0, seconds: 0, lastUsed: null, daysSince: null })
  })

  it('rekent uit hoe lang je er niet geweest bent', () => {
    expect(tabUse(events, NU, ['week'])[0].daysSince).toBe(2)
  })
})

describe('featureUse', () => {
  it('telt kliks per onderdeel', () => {
    const r = featureUse([ev('feature','zoeken',1), ev('feature','zoeken',2)])
    expect(r.find(f => f.key === 'zoeken')!.clicks).toBe(2)
  })

  it('houdt onderdelen zonder kliks in de lijst — dat is juist het punt', () => {
    const r = featureUse([], [{ key:'x', label:'X', tab:'dag' }])
    expect(r).toEqual([{ key:'x', label:'X', tab:'dag', clicks:0, lastUsed:null }])
  })
})

describe('suggestions', () => {
  const veel = (target: string, n: number, kind: 'tab'|'feature' = 'tab') =>
    Array.from({ length: n }, (_, i) => ev(kind, target, (i % 20) + 1, 120))

  function rapport(events: UsageEvent[], tabs: string[], features = TRACKED_FEATURES) {
    return buildReport(events, NU, { tabs, features })
  }

  it('zwijgt zolang er te weinig gemeten is', () => {
    const r = rapport([ev('tab','week',1,60)], ['week','mail'])
    expect(r.suggestions).toHaveLength(1)
    expect(r.suggestions[0].kind).toBe('te-weinig-data')
  })

  it('stelt de tab voor waar je bijna altijd begint', () => {
    const r = rapport([...veel('tasks', 30), ...veel('week', 8)], ['tasks','week'])
    const s = r.suggestions.find(x => x.kind === 'start-tab')
    expect(s?.target).toBe('tasks')
    expect(s?.evidence).toContain('30')
  })

  it('stelt niet voor te wisselen als het dicht bij elkaar ligt', () => {
    const r = rapport([...veel('tasks', 20), ...veel('week', 18)], ['tasks','week'])
    expect(r.suggestions.find(x => x.kind === 'start-tab')).toBeUndefined()
  })

  it('stelt voor een tab te verbergen waar je nooit komt', () => {
    const r = rapport(veel('tasks', 40), ['tasks','mail'])
    const s = r.suggestions.find(x => x.kind === 'hide-tab')
    expect(s?.target).toBe('mail')
    expect(s?.text).toContain('niet één keer geopend')
  })

  it('stelt niet voor een tab te verbergen waar je net nog was', () => {
    const events = [...veel('tasks', 40), ev('tab','mail',0,60)]
    const r = rapport(events, ['tasks','mail'])
    expect(r.suggestions.find(x => x.kind === 'hide-tab' && x.target === 'mail')).toBeUndefined()
  })

  it('noemt onderdelen die nooit gebruikt zijn', () => {
    const r = rapport(veel('tasks', 40), ['tasks'], [{ key:'nooit', label:'Nooit gebruikt ding', tab:'tasks' }])
    const s = r.suggestions.find(x => x.kind === 'drop-feature')
    expect(s?.target).toBe('nooit')
    expect(s?.evidence).toContain('0 kliks')
  })

  it('noemt een onderdeel dat wél gebruikt is niet', () => {
    const r = rapport([...veel('tasks', 40), ev('feature','wel',3)], ['tasks'], [{ key:'wel', label:'Wel gebruikt', tab:'tasks' }])
    expect(r.suggestions.find(x => x.kind === 'drop-feature')).toBeUndefined()
  })

  it('geeft bij elk voorstel het bewijs mee', () => {
    const r = rapport([...veel('tasks', 40), ...veel('week', 5)], ['tasks','week','mail'])
    r.suggestions.forEach(s => expect(s.evidence.length).toBeGreaterThan(5))
  })
})

describe('reportAsText', () => {
  it('geeft een leesbaar rapport dat de AI kan meelezen', () => {
    const r = buildReport([ev('tab','week',3,600), ev('feature','zoeken',2)], NU, { tabs:['week','mail'] })
    const tekst = reportAsText(r)
    expect(tekst).toContain('Week: 1×')
    expect(tekst).toContain('Voorstellen:')
    expect(tekst).not.toContain('undefined')
  })
})

describe('minuten', () => {
  it('schrijft tijd leesbaar op', () => {
    expect(minuten(45)).toBe('45s')
    expect(minuten(600)).toBe('10m')
    expect(minuten(7200)).toBe('2u00')
  })
})

describe('TRACKED_FEATURES', () => {
  it('heeft unieke sleutels', () => {
    const keys = TRACKED_FEATURES.map(f => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('verwijst alleen naar tabs die bestaan', () => {
    TRACKED_FEATURES.forEach(f => expect(TAB_LABELS[f.tab], f.key).toBeDefined())
  })
})

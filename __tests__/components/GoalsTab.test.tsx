import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GoalsTab } from '@/app/dashboard/GoalsTab'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

type Doel = Parameters<typeof GoalsTab>[0]['goals'][number]

function doel(over: Partial<Doel> = {}): Doel {
  return { id: 1, horizon: 'kwartaal', text: 'Album afmaken', done: false, ...over }
}

/** De kolom van een horizon — die is het drop-doel. */
function kolom(horizon: string): HTMLElement {
  const el = document.querySelector(`[data-horizon="${horizon}"]`)
  if (!el) throw new Error(`geen kolom voor ${horizon}`)
  return el as HTMLElement
}

/** De sleepbare kaart van een doel, op zijn tekst gezocht. */
function kaart(tekst: string): HTMLElement {
  const el = [...document.querySelectorAll('div[draggable="true"]')]
    .find(e => e.textContent?.includes(tekst))
  if (!el) throw new Error(`geen sleepbare kaart voor "${tekst}"`)
  return el as HTMLElement
}

/** Het ronde vinkje links op een kaart — dat toggelt, de rest van de kaart opent. */
function vinkje(tekst: string): HTMLElement {
  return kaart(tekst).firstElementChild as HTMLElement
}

/** Een dataTransfer die zich net als de echte gedraagt: waardes onthouden, en
 *  tijdens het slepen alleen de types prijsgeven. */
function maakDataTransfer() {
  const store = new Map<string, string>()
  return {
    effectAllowed: '', dropEffect: '',
    get types() { return [...store.keys()] },
    setData: (type: string, waarde: string) => { store.set(type, waarde) },
    getData: (type: string) => store.get(type) ?? '',
  }
}

/** Een sleep van kaart naar kolom, zoals de browser hem afvuurt. */
function sleep(van: HTMLElement, naar: HTMLElement) {
  const dataTransfer = maakDataTransfer()
  fireEvent.dragStart(van, { dataTransfer })
  fireEvent.dragOver(naar, { dataTransfer })
  fireEvent.drop(naar, { dataTransfer })
  fireEvent.dragEnd(van, { dataTransfer })
}

function toon(props: Partial<Parameters<typeof GoalsTab>[0]> = {}) {
  const onMove = vi.fn()
  render(<GoalsTab goals={[doel()]} categories={[]} onMove={onMove} onAddGoal={vi.fn()} {...props} />)
  return { onMove }
}

describe('GoalsTab — doelen slepen tussen horizons', () => {
  it('sleept een kwartaaldoel naar 6 weken', () => {
    const { onMove } = toon()
    sleep(kaart('Album afmaken'), kolom('6w'))
    expect(onMove).toHaveBeenCalledWith(1, '6w')
  })

  it('elke horizon is een drop-doel, ook een lege kolom', () => {
    const { onMove } = toon()
    for (const h of ['nu', 'wk', 'jaar']) {
      sleep(kaart('Album afmaken'), kolom(h))
      expect(onMove).toHaveBeenCalledWith(1, h)
    }
  })

  it('op de eigen kolom laten vallen verandert niets', () => {
    const { onMove } = toon()
    sleep(kaart('Album afmaken'), kolom('kwartaal'))
    expect(onMove).not.toHaveBeenCalled()
  })

  // Het doel dat je sleept reist mee in de dataTransfer, niet in React-state.
  // Anders mist een snelle sleep zijn doel, omdat de state dan nog niet
  // doorgevoerd is tegen de tijd dat je loslaat.
  it('landt ook als de kolom nooit een dragStart heeft gezien', () => {
    const { onMove } = toon()
    const dataTransfer = maakDataTransfer()
    dataTransfer.setData('application/x-albert-goal', '1')
    fireEvent.drop(kolom('6w'), { dataTransfer })
    expect(onMove).toHaveBeenCalledWith(1, '6w')
  })

  it('negeert een sleep die geen doel is', () => {
    const { onMove } = toon()
    const dataTransfer = maakDataTransfer()
    dataTransfer.setData('text/plain', 'zomaar wat tekst')
    fireEvent.drop(kolom('6w'), { dataTransfer })
    expect(onMove).not.toHaveBeenCalled()
  })

  it('zonder onMove is slepen uit', () => {
    render(<GoalsTab goals={[doel()]} categories={[]} onAddGoal={vi.fn()} />)
    expect(document.querySelectorAll('div[draggable="true"]')).toHaveLength(0)
  })

  it('is er een kolom voor elke horizon voorbij dit jaar, achter het inklapbare "Lange termijn"-paneel', () => {
    toon()
    fireEvent.click(screen.getByText(/Lange termijn/))
    for (const h of ['2-4jr', '5-9jr', '10jr+', 'ooit']) expect(kolom(h)).toBeTruthy()
  })
})

describe('GoalsTab — sorteren op levensgebied binnen een horizon', () => {
  const CATS = [
    { id: 'gezondheid', name: 'Gezondheid' },
    { id: 'muzikant', name: 'Muzikant' },
    { id: 'thuis', name: 'Thuis & Land' },
  ]

  /** Tekst van elke sleepbare kaart in een kolom, in de volgorde waarin ze renderen. */
  function kolomVolgorde(horizon: string): string[] {
    return [...kolom(horizon).querySelectorAll('div[draggable="true"]')]
      .map(el => el.textContent ?? '')
  }

  it('groepeert doelen op categorie in dezelfde volgorde als de categories-lijst, niet op invoervolgorde', () => {
    render(
      <GoalsTab
        categories={CATS}
        goals={[
          { id: 1, horizon: 'jaar', text: 'Thuisdoel', done: false, cat_id: 'thuis' },
          { id: 2, horizon: 'jaar', text: 'Muziekdoel', done: false, cat_id: 'muzikant' },
          { id: 3, horizon: 'jaar', text: 'Gezondheidsdoel', done: false, cat_id: 'gezondheid' },
        ]}
        onMove={vi.fn()} onAddGoal={vi.fn()}
      />
    )
    const volgorde = kolomVolgorde('jaar')
    const idxGezondheid = volgorde.findIndex(t => t.includes('Gezondheidsdoel'))
    const idxMuziek = volgorde.findIndex(t => t.includes('Muziekdoel'))
    const idxThuis = volgorde.findIndex(t => t.includes('Thuisdoel'))
    expect(idxGezondheid).toBeLessThan(idxMuziek)
    expect(idxMuziek).toBeLessThan(idxThuis)
  })

  it('zet doelen zonder levensgebied achteraan', () => {
    render(
      <GoalsTab
        categories={CATS}
        goals={[
          { id: 1, horizon: 'jaar', text: 'Zonder gebied', done: false, cat_id: null },
          { id: 2, horizon: 'jaar', text: 'Met gebied', done: false, cat_id: 'thuis' },
        ]}
        onMove={vi.fn()} onAddGoal={vi.fn()}
      />
    )
    const volgorde = kolomVolgorde('jaar')
    expect(volgorde.findIndex(t => t.includes('Met gebied'))).toBeLessThan(volgorde.findIndex(t => t.includes('Zonder gebied')))
  })

  it('slepen op een ander doel binnen dezelfde horizon-kolom herschikt (sort_order), verandert de horizon niet', () => {
    const onReorder = vi.fn()
    const a = { id: 1, horizon: 'jaar', text: 'Doel A', done: false, cat_id: 'thuis', sort_order: 0 }
    const b = { id: 2, horizon: 'jaar', text: 'Doel B', done: false, cat_id: 'thuis', sort_order: 1 }
    render(<GoalsTab categories={CATS} goals={[a, b]} onMove={vi.fn()} onReorder={onReorder} onAddGoal={vi.fn()} />)
    sleep(kaart('Doel A'), kaart('Doel B'))
    expect(onReorder).toHaveBeenCalledWith([{ id: 2, sort_order: 0 }, { id: 1, sort_order: 1 }])
  })

  it('geeft elke categorie een eigen kleur op de kaart', () => {
    render(
      <GoalsTab
        categories={CATS}
        goals={[
          { id: 1, horizon: 'jaar', text: 'Gezondheidsdoel', done: false, cat_id: 'gezondheid' },
          { id: 2, horizon: 'jaar', text: 'Thuisdoel', done: false, cat_id: 'thuis' },
        ]}
        onAddGoal={vi.fn()}
      />
    )
    const gezondheidChip = screen.getByText('Gezondheid')
    const thuisChip = screen.getByText('Thuis & Land')
    expect(gezondheidChip.style.color).not.toBe('')
    expect(gezondheidChip.style.color).not.toBe(thuisChip.style.color)
  })
})

describe('GoalsTab — klikken opent, het vinkje toggelt', () => {
  it('klik op de kaart opent het doel, niet toggelen', () => {
    const onOpenGoal = vi.fn(), onToggle = vi.fn()
    toon({ onOpenGoal, onToggle })
    fireEvent.click(kaart('Album afmaken'))
    expect(onOpenGoal).toHaveBeenCalledWith(1)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('klik op het vinkje toggelt, en opent het doel niet', () => {
    const onOpenGoal = vi.fn(), onToggle = vi.fn()
    toon({ onOpenGoal, onToggle })
    fireEvent.click(vinkje('Album afmaken'))
    expect(onToggle).toHaveBeenCalledWith(1)
    expect(onOpenGoal).not.toHaveBeenCalled()
  })
})

describe('GoalsTab — hoofd- en sub-doelen', () => {
  it('nest een sub-doel direct onder zijn hoofddoel, binnen dezelfde horizon', () => {
    const goals = [
      doel({ id: 1, text: 'Album afmaken', horizon: 'jaar' }),
      doel({ id: 2, text: 'Nummer 1 opnemen', horizon: 'jaar', parent_id: 1 }),
    ]
    toon({ goals })
    const kaarten = [...kolom('jaar').querySelectorAll('div[draggable="true"]')].map(e => e.textContent)
    // Het sub-doel staat direct na zijn hoofddoel, niet ervoor
    expect(kaarten.findIndex(t => t?.includes('Album afmaken')))
      .toBeLessThan(kaarten.findIndex(t => t?.includes('Nummer 1 opnemen')))
    expect(screen.getByText('↳ sub-doel')).toBeTruthy()
  })

  it('een sub-doel in een andere horizon dan zijn hoofddoel krijgt een verwijzing i.p.v. nesting', () => {
    const goals = [
      doel({ id: 1, text: 'Album afmaken', horizon: 'jaar' }),
      doel({ id: 2, text: 'Deze week mixen', horizon: 'wk', parent_id: 1 }),
    ]
    toon({ goals })
    expect(screen.getByText(/sub van.*Album afmaken/)).toBeTruthy()
  })
})

describe('GoalsTab — hobbydoelen verbergen', () => {
  const gemengd = [
    doel({ id: 1, text: 'Album afmaken' }),
    doel({ id: 2, text: 'Zelda uitspelen', kind: 'hobby' }),
  ]

  it('verbergt hobbydoelen standaard', () => {
    toon({ goals: gemengd })
    expect(screen.getByText('Album afmaken')).toBeTruthy()
    expect(screen.queryByText('Zelda uitspelen')).toBeNull()
  })

  it('toont ze na één klik op de knop, en verbergt ze weer', () => {
    toon({ goals: gemengd })
    fireEvent.click(screen.getByText(/Toon hobbydoelen/))
    expect(screen.getByText('Zelda uitspelen')).toBeTruthy()

    fireEvent.click(screen.getByText(/Verberg hobbydoelen/))
    expect(screen.queryByText('Zelda uitspelen')).toBeNull()
  })

  it('onthoudt je keuze', () => {
    const { unmount } = render(<GoalsTab goals={gemengd} categories={[]} onAddGoal={vi.fn()} />)
    fireEvent.click(screen.getByText(/Toon hobbydoelen/))
    expect(localStorage.getItem('goals-hide-hobby')).toBe('0')
    unmount()

    render(<GoalsTab goals={gemengd} categories={[]} onAddGoal={vi.fn()} />)
    expect(screen.getByText('Zelda uitspelen')).toBeTruthy()
  })

  it('geen knop als je helemaal geen hobbydoelen hebt', () => {
    toon()
    expect(screen.queryByText(/hobbydoelen/)).toBeNull()
  })
})

describe('GoalsTab — deadline stuurt de horizon aan', () => {
  const vandaag = new Date().toISOString().slice(0, 10)
  function inDagen(n: number): string {
    const t = new Date(); t.setDate(t.getDate() + n)
    return t.toISOString().slice(0, 10)
  }

  it('een doel met een deadline dichtbij staat in Nu, ook al staat het opgeslagen horizon op jaar', () => {
    toon({ goals: [doel({ horizon: 'jaar', deadline: inDagen(2) })] })
    expect(kolom('nu').textContent).toContain('Album afmaken')
    expect(kolom('jaar').textContent).not.toContain('Album afmaken')
  })

  it('toont de deadline op de kaart, met ⚠ als hij al voorbij is', () => {
    toon({ goals: [doel({ horizon: 'jaar', deadline: inDagen(-3) })] })
    expect(kaart('Album afmaken').textContent).toContain('⚠')
  })

  it('toont een verschoven-icoon als de deadline later is dan de oorspronkelijke', () => {
    toon({ goals: [doel({ horizon: 'nu', deadline: inDagen(30), original_deadline: vandaag })] })
    expect(kaart('Album afmaken').textContent).toContain('🔀')
  })

  it('geen verschoven-icoon als de deadline nooit gewijzigd is', () => {
    toon({ goals: [doel({ horizon: 'nu', deadline: inDagen(2), original_deadline: inDagen(2) })] })
    expect(kaart('Album afmaken').textContent).not.toContain('🔀')
  })
})

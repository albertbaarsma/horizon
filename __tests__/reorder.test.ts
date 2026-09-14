import { describe, it, expect } from 'vitest'
import { reorderList } from '@/lib/reorder'

type Item = { id: number; sort_order: number; naam: string }

function items(...namen: string[]): Item[] {
  return namen.map((naam, i) => ({ id: i + 1, sort_order: i, naam }))
}

describe('reorderList', () => {
  it('verplaatst een item naar de plek van een ander item, verderop in de lijst', () => {
    const result = reorderList(items('A', 'B', 'C', 'D'), 1, 3)
    expect(result.map(x => x.naam)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('verplaatst een item naar de plek van een ander item, terug naar voren', () => {
    const result = reorderList(items('A', 'B', 'C', 'D'), 4, 1)
    expect(result.map(x => x.naam)).toEqual(['D', 'A', 'B', 'C'])
  })

  it('herindexeert sort_order als 0..n-1 in de nieuwe volgorde', () => {
    const result = reorderList(items('A', 'B', 'C'), 1, 3)
    expect(result.map(x => x.sort_order)).toEqual([0, 1, 2])
  })

  it('doet niets als je op je eigen plek droppt', () => {
    const origineel = items('A', 'B', 'C')
    const result = reorderList(origineel, 2, 2)
    expect(result).toBe(origineel)
  })

  it('geeft de ongewijzigde lijst terug als het gesleepte item niet bestaat', () => {
    const origineel = items('A', 'B', 'C')
    const result = reorderList(origineel, 999, 2)
    expect(result).toBe(origineel)
  })

  it('geeft de ongewijzigde lijst terug als het doel-item niet bestaat', () => {
    const origineel = items('A', 'B', 'C')
    const result = reorderList(origineel, 1, 999)
    expect(result).toBe(origineel)
  })

  it('werkt ook met string-ids (projecten)', () => {
    const lijst = [
      { id: 'p1', sort_order: 0, naam: 'Eerste' },
      { id: 'p2', sort_order: 1, naam: 'Tweede' },
      { id: 'p3', sort_order: 2, naam: 'Derde' },
    ]
    const result = reorderList(lijst, 'p3', 'p1')
    expect(result.map(x => x.naam)).toEqual(['Derde', 'Eerste', 'Tweede'])
  })
})

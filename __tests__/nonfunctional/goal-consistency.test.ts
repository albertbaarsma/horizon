/**
 * Doelen-samenhang — niet-functioneel
 *
 * Een weggegooid doel moet uit de héle app verdwijnen, niet alleen uit het
 * doelen-overzicht. Dat is makkelijk om per ongeluk te breken: iemand geeft
 * `goals` door aan een nieuw onderdeel en de prullenbak lekt terug in de app.
 * Deze test leest de broncode en houdt die belofte vast.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

function walk(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(rel)
    return /\.tsx?$/.test(e.name) ? [rel] : []
  })
}

const bronbestanden = [...walk('app'), ...walk('lib')]

describe('een weggegooid doel lekt niet terug in de app', () => {
  it('geeft nergens de ongefilterde serverlijst aan een onderdeel door', () => {
    // `data.goals` is de ruwe lijst van de server, mét prullenbak. Onderdelen
    // horen `levendeDoelen` te krijgen.
    const zondaars = bronbestanden.filter(f => /goals=\{data\.goals\}|data\.goals\.filter/.test(read(f)))
    expect(zondaars).toEqual([])
  })

  it('haalt doelen uit de database altijd zonder prullenbak op', () => {
    // Uitzondering: de dashboard-pagina en het dashboard zelf halen bewust
    // álles op — het doelen-overzicht heeft de prullenbak nodig. Onderdelen
    // krijgen daar de gefilterde lijst van; dat controleert de test hieronder.
    const magAlles = ['app/dashboard/page.tsx', 'app/dashboard/DashboardClient.tsx']
    const fout: string[] = []
    for (const f of bronbestanden) {
      if (magAlles.includes(f)) continue
      const src = read(f)
      // Elke select op goals moet deleted_at uitsluiten
      const selects = src.match(/from\('goals'\)\s*\.select\([^)]*\)(?:[\s\S]{0,200})/g) ?? []
      for (const s of selects) {
        if (!/deleted_at/.test(s)) fout.push(`${f}: ${s.split('\n')[0].trim()}`)
      }
    }
    expect(fout).toEqual([])
  })

  it('gooit een doel nergens hard weg buiten de prullenbak zelf', () => {
    // Alleen 'definitief wissen' uit de prullenbak (purgeGoal) mag echt deleten.
    const magWissen = ['app/dashboard/DashboardClient.tsx']
    const fout = bronbestanden.filter(f =>
      !magWissen.includes(f) && /from\('goals'\)\s*\.delete\(\)/.test(read(f)))
    expect(fout).toEqual([])
  })

  it('houdt XP en prestaties bij het weggooien mee', () => {
    const links = read('lib/goal-links.ts')
    expect(links).toMatch(/from\('xp_events'\)\s*\.delete\(\)/)
    expect(links).toMatch(/syncGoalAchievement/)
  })

  it('gebruikt in het dashboard overal de gefilterde lijst', () => {
    const src = read('app/dashboard/DashboardClient.tsx')
    const props = src.match(/goals=\{[^}]+\}/g) ?? []
    // Alleen het doelen-overzicht zelf mag de volledige lijst hebben (prullenbak)
    const anders = props.filter(p => !/levendeDoelen/.test(p) && !/goals=\{goals\}/.test(p))
    expect(anders).toEqual([])
    expect(props.filter(p => /goals=\{goals\}/.test(p)).length).toBe(1)
  })
})

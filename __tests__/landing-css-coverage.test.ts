import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// De landingspagina's zijn plain HTML met één losstaand CSS-blok in
// landing-chrome.tsx. Er is geen build-time check die een `lp-`-klasse in een
// pagina koppelt aan een regel in dat blok — een class die je gebruikt maar
// waarvan de CSS onderweg verdwijnt (zoals hier met .lp-stappen/.lp-stap
// gebeurde) rendert zonder foutmelding, gewoon met de browser-standaardstijl.
// Deze test is de build-time check die er niet is: elke `lp-`-klasse die in
// een publieke pagina wordt gebruikt, moet ook als selector in de CSS staan.

const ROOT = join(__dirname, '..')
const css = readFileSync(join(ROOT, 'app/landing-chrome.tsx'), 'utf8')

function klassenIn(bestand: string): string[] {
  const tekst = readFileSync(join(ROOT, bestand), 'utf8')
  const gevonden = new Set<string>()
  // className="a b" of className={cond ? 'a' : 'b'} — pak alle lp-woorden uit strings
  for (const m of tekst.matchAll(/className=(?:"([^"]*)"|\{[^}]*\})/g)) {
    const bron = m[1] ?? m[0]
    for (const klasse of bron.match(/lp-[a-z0-9-]+/g) ?? []) gevonden.add(klasse)
  }
  return [...gevonden]
}

function heeftSelector(klasse: string): boolean {
  // .lp-foo gevolgd door iets dat geen deel van de klassenaam is (spatie, :,
  // {, komma, ::) — anders matcht .lp-stap ook toevallig binnen .lp-stappen
  return new RegExp(`\\.${klasse}(?![a-z0-9-])`).test(css)
}

const PAGINAS = ['app/LandingPage.tsx', 'app/updates/page.tsx', 'app/over/page.tsx', 'app/landing-chrome.tsx']

describe('Publieke pagina’s — elke lp-klasse heeft ook echt CSS', () => {
  for (const pagina of PAGINAS) {
    it(`${pagina}: geen weesklasse`, () => {
      const missend = klassenIn(pagina).filter(k => !heeftSelector(k))
      expect(missend, `ontbrekende CSS voor: ${missend.join(', ')}`).toEqual([])
    })
  }

  // Vangt ook een klasse die uitsluitend binnen een @media-blok verdwenen is
  it('.lp-stappen en .lp-stap staan er, met de genummerde badge', () => {
    expect(css).toMatch(/\.lp-stappen\s*\{[^}]*display:\s*grid/)
    expect(css).toMatch(/\.lp-stap::before/)
  })
})

// Vangt de omgekeerde fout: dode CSS voor een klasse die nergens (meer) gebruikt
// wordt — minder ernstig, maar wijst op een pagina die is herschreven zonder de
// oude regels op te ruimen.
describe('landing-chrome.tsx — geen overduidelijk dode selectors', () => {
  it('elke .lp-stap-achtige selector wordt ook ergens gebruikt', () => {
    const gebruikt = new Set(PAGINAS.flatMap(klassenIn))
    for (const m of css.matchAll(/\.lp-([a-z0-9-]+)(?=[\s.,:{])/g)) {
      const klasse = `lp-${m[1]}`
      // Pseudo-elementselectors (::before) en samengestelde regels negeren we
      if (klasse.includes('before') || klasse.includes('after')) continue
      expect(gebruikt.has(klasse), klasse).toBe(true)
    }
  })
})

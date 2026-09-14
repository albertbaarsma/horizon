import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CHANGELOG, datumNL } from '@/lib/changelog'

// redirect() gooit in Next — anders zou de code eronder gewoon doorlopen
const redirect = vi.fn((pad: string) => { throw new Error('REDIRECT:' + pad) })
vi.mock('next/navigation', () => ({ redirect: (p: string) => redirect(p) }))

const getUser = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}))

// Taalcookie — leeg (= nieuwe bezoeker, Engels) tenzij een test 'm zet
let taalCookie: string | undefined
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (naam: string) => (taalCookie !== undefined && naam === 'aos_lang' ? { value: taalCookie } : undefined),
  }),
}))

beforeEach(() => { vi.clearAllMocks(); taalCookie = undefined })

const LandingPage  = (await import('@/app/LandingPage')).default
const Home         = (await import('@/app/page')).default
const UpdatesPage  = (await import('@/app/updates/page')).default
const OverPage     = (await import('@/app/over/page')).default

describe('/ — wie krijgt wat te zien', () => {
  it('stuurt een ingelogde bezoeker door naar het dashboard', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    await expect(Home()).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('toont een nieuwe bezoeker zonder taalcookie de Engelse landingspagina', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    render(await Home())
    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Your whole life, one overview')
  })

  it('toont de Nederlandse landingspagina zodra het aos_lang-cookie op nl staat', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    taalCookie = 'nl'
    render(await Home())
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Je hele leven in één overzicht')
  })
})

describe('Landingspagina (Engels, standaard voor nieuwe bezoekers)', () => {
  beforeEach(() => { render(<LandingPage />) })

  it('legt uit dat je je AI via MCP kunt koppelen', () => {
    expect(screen.getAllByText(/MCP server/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Claude Desktop and Claude Code/)).toBeTruthy()
  })

  it('noemt de handelingen die je AI mag doen', () => {
    for (const tool of ['get_tasks', 'add_week_item', 'update_week_item', 'get_xp']) {
      expect(screen.getByText(tool)).toBeTruthy()
    }
  })

  it('noemt de koppelingen met agenda, mail en een lokaal model', () => {
    expect(screen.getByText('Google Calendar')).toBeTruthy()
    expect(screen.getByText('Gmail')).toBeTruthy()
    expect(screen.getAllByText(/Ollama or LM Studio/).length).toBeGreaterThan(0)
  })

  it('markeert Google Drive eerlijk als nog niet beschikbaar', () => {
    const kop = screen.getByText('Google Drive').closest('h3')
    expect(kop?.textContent).toContain('coming soon')
  })

  it('wijst nieuwe én bestaande gebruikers de weg', () => {
    const paden = screen.getAllByRole('link').map(a => a.getAttribute('href'))
    expect(paden).toContain('/signup')
    expect(paden).toContain('/login')
  })

  it('beschrijft alleen functies die de app echt heeft', () => {
    for (const functie of ['Goals across five horizons', 'Vision per life area', 'Wins, XP, and levels']) {
      expect(screen.getByText(functie)).toBeTruthy()
    }
  })

  it('zegt dat het een gratis alpha en een hobbyproject is', () => {
    expect(screen.getAllByText(/Free alpha/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/hobby project/i).length).toBeGreaterThan(0)
  })

  it('toont de vlaggen om van taal te wisselen, terugkerend naar de homepage', () => {
    const en = screen.getByLabelText('English')
    const nl = screen.getByLabelText('Nederlands')
    expect(en.getAttribute('href')).toBe('/lang?to=en&path=%2F')
    expect(nl.getAttribute('href')).toBe('/lang?to=nl&path=%2F')
  })
})

describe('Landingspagina (Nederlands, via de vlag of het cookie)', () => {
  beforeEach(() => { render(<LandingPage lang="nl" />) })

  it('legt uit dat je je AI via MCP kunt koppelen', () => {
    expect(screen.getAllByText(/MCP-server/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Claude Desktop en Claude Code/)).toBeTruthy()
  })

  it('noemt de handelingen die je AI mag doen', () => {
    for (const tool of ['get_tasks', 'add_week_item', 'update_week_item', 'get_xp']) {
      expect(screen.getByText(tool)).toBeTruthy()
    }
  })

  it('noemt de koppelingen met agenda, mail en een lokaal model', () => {
    expect(screen.getByText('Google Agenda')).toBeTruthy()
    expect(screen.getByText('Gmail')).toBeTruthy()
    expect(screen.getAllByText(/Ollama of LM Studio/).length).toBeGreaterThan(0)
  })

  // Drive is nog niet gekoppeld; de pagina mag dat niet als bestaand verkopen
  it('markeert Google Drive eerlijk als nog niet beschikbaar', () => {
    const kop = screen.getByText('Google Drive').closest('h3')
    expect(kop?.textContent).toContain('binnenkort')
  })

  it('wijst nieuwe én bestaande gebruikers de weg', () => {
    const paden = screen.getAllByRole('link').map(a => a.getAttribute('href'))
    expect(paden).toContain('/signup')
    expect(paden).toContain('/login')
  })

  it('beschrijft alleen functies die de app echt heeft', () => {
    for (const functie of ['Doelen op vijf horizonnen', 'Visie per levensgebied', 'Wins, XP en levels']) {
      expect(screen.getByText(functie)).toBeTruthy()
    }
  })

  it('zegt dat het een gratis alpha en een hobbyproject is', () => {
    expect(screen.getAllByText(/Gratis alpha/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/hobbyproject/i).length).toBeGreaterThan(0)
  })
})

// Jordan wil geen verkooppraat en geen beloftes die hij niet wil houden.
// Deze regels houden dat vast, zodat het er niet ongemerkt weer in sluipt.
describe('Landingspagina — wat er juist NIET op staat', () => {
  beforeEach(() => { render(<LandingPage lang="nl" />) })

  it('belooft niets over veiligheid of afscherming van je gegevens', () => {
    for (const woord of [/row-level security/i, /niemand anders kan bij/i, /gegevens blijven je eigen/i, /verlaat er niets/i]) {
      expect(screen.queryByText(woord), String(woord)).toBeNull()
    }
  })

  it('doet geen beloftes over de prijs in de toekomst', () => {
    for (const woord of [/zonder addertje/i, /geen proefperiode/i, /betaalgegevens/i, /later ineens geld/i]) {
      expect(screen.queryByText(woord), String(woord)).toBeNull()
    }
  })

  it('belooft geen tempo van nieuwe versies', () => {
    for (const woord of [/elke week iets bij/i, /avonduren gebouwd/i]) {
      expect(screen.queryByText(woord), String(woord)).toBeNull()
    }
  })

  it('zet het updatelog en het verhaal erachter niet op de voorpagina zelf', () => {
    expect(screen.queryByText(CHANGELOG[0].wijzigingen[0].tekst)).toBeNull()
    expect(screen.queryByText(/Gemaakt door één muzikant/)).toBeNull()
  })
})

describe('Updatelog — eigen pagina', () => {
  beforeEach(async () => { render(await UpdatesPage()) })

  it('toont elke release met datum en titel', () => {
    for (const r of CHANGELOG) {
      expect(screen.getByText(datumNL(r.datum)), r.datum).toBeTruthy()
      expect(screen.getByText(r.titel), r.titel).toBeTruthy()
    }
  })

  it('toont de wijzigingen van de nieuwste release', () => {
    for (const w of CHANGELOG[0].wijzigingen) {
      expect(screen.getByText(w.tekst)).toBeTruthy()
    }
  })

  it('markeert alleen de bovenste release als "Nieuwste"', () => {
    expect(screen.getAllByText('Nieuwste')).toHaveLength(1)
  })

  it('houdt het neutraal — geen belofte over hoe vaak er iets bij komt', () => {
    expect(screen.queryByText(/elke week/i)).toBeNull()
    expect(screen.queryByText(/wijzigingen tot nu toe/i)).toBeNull()
  })
})

describe('Over — eigen pagina', () => {
  beforeEach(async () => { render(await OverPage()) })

  it('vertelt wie het maakt, neutraal', () => {
    expect(screen.getAllByText(/Acme Co/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Waarom deze app er is/)).toBeTruthy()
  })

  // Jordan: "ik waardeer de grap niet zo over mezelf" — geen grap over zichzelf
  // als "warrig" of iemand met te veel plannen.
  it('maakt geen grap over Jordan zelf', () => {
    for (const tekst of [/te veel plannen/i, /Gemaakt door één muzikant/i, /avonduren/i]) {
      expect(screen.queryByText(tekst), String(tekst)).toBeNull()
    }
  })


  it('is eerlijk over de staat van de app', () => {
    expect(screen.getByText(/Er zit van alles in dat nog schuurt/)).toBeTruthy()
    expect(screen.getByText(/back-up van wat je niet kwijt wil/i)).toBeTruthy()
  })

  it('legt RPM uit en noemt Tony Robbins', () => {
    expect(screen.getAllByText(/Tony Robbins/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Rapid Planning Method/)).toBeTruthy()
    expect(screen.getAllByText('Result').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Purpose').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Massive Action Plan/).length).toBeGreaterThan(0)
  })

  it('geeft instructies voor het schrijven van een ultieme visie', () => {
    expect(screen.getAllByText(/ultieme visie/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Ga naar het einde')).toBeTruthy()
    expect(screen.getByText('Schrijf in het nu')).toBeTruthy()
  })

  it('legt levensgebieden uit met voorbeelden', () => {
    expect(screen.getByText(/Levensgebieden/)).toBeTruthy()
    expect(screen.getByText('Gezondheid')).toBeTruthy()
    expect(screen.getByText('Relaties & gezin')).toBeTruthy()
  })

  it('legt de keten visie → gebied → doel/project → taak uit', () => {
    expect(screen.getAllByText(/Massive Action Plan/).length).toBeGreaterThan(0)
    expect(screen.getByText(/3D-boom/)).toBeTruthy()
  })
})

describe('Beide pagina’s zijn alleen via de balk bovenin te vinden', () => {
  it('de landingspagina linkt naar /updates en /over', () => {
    render(<LandingPage />)
    const paden = screen.getAllByRole('link').map(a => a.getAttribute('href'))
    expect(paden.filter(p => p === '/updates')).toHaveLength(1)
    expect(paden.filter(p => p === '/over')).toHaveLength(1)
  })

  it('en beide pagina’s linken terug naar huis', async () => {
    render(await UpdatesPage())
    expect(screen.getAllByRole('link').map(a => a.getAttribute('href'))).toContain('/')
  })
})

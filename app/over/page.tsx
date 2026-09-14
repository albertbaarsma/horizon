// ─── Over ─────────────────────────────────────────────────────────────────────
// Waarom deze app er is en waar hij in zijn ontwikkeling staat. De uitleg van
// de RPM-methode zelf staat op zijn eigen pagina (/rpm), zodat de credit aan
// Tony Robbins niet verdrinkt tussen dit hobbyproject-verhaal.

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { LandingShell } from '../landing-chrome'

export const metadata: Metadata = {
  title: 'Over Horizon',
  description: 'Horizon is gebaseerd op de RPM-methode van Tony Robbins — een poging om die met AI beter uit te werken.',
}

export default async function OverPagina() {
  const store = await cookies()
  const lang = store.get('aos_lang')?.value === 'en' ? 'en' as const : 'nl' as const
  return (
    // Inhoud van de over-pagina blijft voorlopig Nederlands — alleen balk/voet volgen de taalkeuze
    <LandingShell smal lang={lang} path="/over">
      <section className="lp-sectie">
        <div className="lp-label">Over</div>
        <h2 className="lp-h2">Waarom deze app er is.</h2>

        <div className="lp-glas" style={{ padding: 26, marginBottom: 26 }}>
          <p className="lp-tekst">
            Ik gebruik zelf de RPM-methode van Tony Robbins om mijn eigen leven scherp te houden —
            en ik bouw Horizon om te zien of AI dat proces kan versterken in plaats van vervangen.
          </p>
          <p className="lp-tekst" style={{ marginTop: 12, marginBottom: 0 }}>
            <Link href="/rpm">Wat RPM precies is, en hoe Horizon eromheen gebouwd is →</Link>
          </p>
        </div>
      </section>

      <div className="lp-streep" />

      <section className="lp-sectie">
        <div className="lp-label">Waar het staat</div>
        <h2 className="lp-h2">De staat van de app.</h2>
        <div className="lp-glas" style={{ padding: 26 }}>
          <ul className="lp-lijst">
            <li><b>Dit is een alpha.</b> Er zit van alles in dat nog schuurt, en soms verandert er iets waar je net aan gewend was.</li>
            <li><b>Een hobbyproject, nu open source.</b> Ik bouw eraan in mijn eigen tijd, en deel de broncode zodat anderen ermee kunnen bouwen of hem zelf kunnen hosten. Verwacht geen supportafdeling — wel iemand die het zelf elke dag gebruikt.</li>
            <li><b>Maak een back-up van wat je niet kwijt wil.</b> Ik doe mijn best, maar beloof geen garanties die ik in mijn eentje niet waar kan maken.</li>
          </ul>
        </div>
      </section>
    </LandingShell>
  )
}

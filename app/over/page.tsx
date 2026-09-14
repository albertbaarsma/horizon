// ─── Over ─────────────────────────────────────────────────────────────────────
// Wie de app maakt, waar hij vandaan komt (de RPM-methode) en waar hij in zijn
// ontwikkeling staat. Eigen pagina, alleen bereikbaar via de balk bovenin.

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LandingShell } from '../landing-chrome'

export const metadata: Metadata = {
  title: 'Over Horizon',
  description: 'Horizon is gebaseerd op de RPM-methode van Tony Robbins — een poging om die met AI beter uit te werken.',
}

const VISIE_STAPPEN = [
  { titel: 'Ga naar het einde', tekst: 'Stel een dag voor, over vijf of tien jaar, waarop het klopt: waar ben je, wie is erbij, wat doe je?' },
  { titel: 'Schrijf in het nu', tekst: '"Ik woon…", "Ik voel…" — geen "ik zou willen". De tegenwoordige tijd maakt het invoelbaar in plaats van hypothetisch.' },
  { titel: 'Loop je levensgebieden langs', tekst: 'Gezondheid, relaties, werk, thuis: wat zie, voel en doe je in elk gebied op die dag?' },
  { titel: 'Voel of het klopt', tekst: 'Het gaat om de emotie die het oproept, niet om een sluitend plan. Schaaf tot het je iets doet, en kom er later op terug.' },
]

const VOORBEELDGEBIEDEN = ['Gezondheid', 'Werk & business', 'Relaties & gezin', 'Groei & spiritualiteit', 'Thuis & omgeving', 'Vrije tijd']

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
        </div>
      </section>

      <div className="lp-streep" />

      {/* ── Wat is RPM ──────────────────────────────────────────────────── */}
      <section className="lp-sectie">
        <div className="lp-label">De methode</div>
        <h2 className="lp-h2">Gebaseerd op RPM.</h2>
        <p className="lp-intro">
          Horizon is geen uitgevonden systeem — het is gebouwd rond <b style={{ color: 'var(--lp-ink)' }}>RPM
          (Rapid Planning Method)</b>, de planningsmethode van Tony Robbins. RPM draait niet om een
          langere to-dolijst, maar om drie vragen die je bij elk doel en project stelt:
        </p>
        <div className="lp-raster">
          <div className="lp-glas">
            <span className="lp-emoji">🎯</span>
            <h3 className="lp-kop3">Result</h3>
            <p className="lp-tekst">Wat wil ik precies? Hoe specifieker en tastbaarder, hoe beter je weet of je er bent.</p>
          </div>
          <div className="lp-glas">
            <span className="lp-emoji">📖</span>
            <h3 className="lp-kop3">Purpose</h3>
            <p className="lp-tekst">Waarom wil ik dit? Dit is de reden die je erdoorheen trekt op de dagen dat het tegenzit.</p>
          </div>
          <div className="lp-glas">
            <span className="lp-emoji">✅</span>
            <h3 className="lp-kop3">Massive Action Plan</h3>
            <p className="lp-tekst">Wat ga ik doen om er te komen? De concrete stappen — pas hierna, niet ervoor.</p>
          </div>
        </div>
        <p className="lp-intro" style={{ marginTop: 22, marginBottom: 0 }}>
          Dat is precies hoe een project in Horizon is opgebouwd: het <b style={{ color: 'var(--lp-ink)' }}>Result</b>-
          en <b style={{ color: 'var(--lp-ink)' }}>Purpose</b>-veld staan letterlijk zo in elk projectvenster, en je
          taken zijn het Massive Action Plan. De poging met AI is: die drie vragen sneller scherp
          krijgen, en het geheel actueel houden zonder dat jij alles handmatig moet bijhouden.
        </p>
      </section>

      <div className="lp-streep" />

      {/* ── Ultieme visie ───────────────────────────────────────────────── */}
      <section className="lp-sectie">
        <div className="lp-label">Waar het begint</div>
        <h2 className="lp-h2">Je ultieme visie.</h2>
        <p className="lp-intro">
          RPM begint niet bij een taak, maar bij een beeld: hoe ziet jouw leven eruit als het
          precies klopt? Dat is je <b style={{ color: 'var(--lp-ink)' }}>ultieme visie</b> — in
          Horizon het startpunt van de Visie-tab, waar elk levensgebied, doel en project
          uiteindelijk op terugvalt.
        </p>
        <div className="lp-stappen">
          {VISIE_STAPPEN.map(s => (
            <div key={s.titel} className="lp-stap">
              <h3>{s.titel}</h3>
              <p>{s.tekst}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-streep" />

      {/* ── Levensgebieden ──────────────────────────────────────────────── */}
      <section className="lp-sectie">
        <div className="lp-label">De indeling</div>
        <h2 className="lp-h2">Levensgebieden.</h2>
        <p className="lp-intro" style={{ marginBottom: 18 }}>
          Je leven is geen enkele lijst — het bestaat uit gebieden die elk hun eigen aandacht
          vragen. RPM noemt dit <i>categories</i>: de rollen en domeinen waaruit je dagen zijn
          opgebouwd. In Horizon richt je die zelf in, bijvoorbeeld:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {VOORBEELDGEBIEDEN.map(g => <span key={g} className="lp-pil">{g}</span>)}
        </div>
        <p className="lp-intro" style={{ marginBottom: 0 }}>
          Elk gebied krijgt zijn eigen visie, en daaruit komen zijn eigen doelen en projecten —
          zodat "gezondheid" en "werk" niet in dezelfde lijst vechten om je aandacht.
        </p>
      </section>

      <div className="lp-streep" />

      {/* ── Van visie naar taak ─────────────────────────────────────────── */}
      <section className="lp-sectie">
        <div className="lp-label">Hoe het samenhangt</div>
        <h2 className="lp-h2">Van visie naar wat je vandaag doet.</h2>
        <p className="lp-intro">
          Dit is de keten die RPM voorschrijft, en die Horizon ook letterlijk zo vastlegt:
        </p>
        <ul className="lp-lijst" style={{ maxWidth: 640 }}>
          <li><b>Visie</b> — het beeld van je hele leven, waar alles op terugvalt.</li>
          <li><b>Levensgebied</b> — een van de domeinen waaruit dat leven bestaat.</li>
          <li><b>Doel of project</b> — het Result en Purpose binnen dat gebied: wat je wil, en waarom.</li>
          <li><b>Taak</b> — het Massive Action Plan: de concrete stap die er vandaag aan bijdraagt.</li>
        </ul>
        <p className="lp-intro" style={{ marginTop: 16, marginBottom: 0 }}>
          In de Inzicht-tab van de app zie je die hele keten ook letterlijk terug als een 3D-boom —
          je visie in het midden, je levensgebieden eromheen, en daaruit je doelen, projecten en
          taken. Geen losse lijstjes, maar één samenhangend geheel.
        </p>
      </section>

      <div className="lp-streep" />

      <section className="lp-sectie">
        <div className="lp-label">Waar het staat</div>
        <h2 className="lp-h2">De staat van de app.</h2>
        <div className="lp-glas" style={{ padding: 26 }}>
          <ul className="lp-lijst">
            <li><b>Dit is een alpha.</b> Er zit van alles in dat nog schuurt, en soms verandert er iets waar je net aan gewend was.</li>
            <li><b>Een hobbyproject.</b> Ik bouw eraan in mijn eigen tijd. Verwacht geen supportafdeling — wel iemand die het zelf elke dag gebruikt.</li>
            <li><b>Maak een back-up van wat je niet kwijt wil.</b> Ik doe mijn best, maar beloof geen garanties die ik in mijn eentje niet waar kan maken.</li>
          </ul>
        </div>
      </section>
    </LandingShell>
  )
}

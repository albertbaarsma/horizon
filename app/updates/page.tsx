// ─── Updatelog ────────────────────────────────────────────────────────────────
// Een eigen pagina, alleen bereikbaar via de balk bovenin. Wat er veranderd is,
// zonder er iets omheen te beloven. De inhoud staat in lib/changelog.ts.

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LandingShell } from '../landing-chrome'
import { CHANGELOG, SOORT_META, datumNL } from '@/lib/changelog'

export const metadata: Metadata = {
  title: 'Updates — Horizon',
  description: 'Wat er in Horizon is veranderd.',
}

export default async function UpdatesPagina() {
  const store = await cookies()
  const lang = store.get('aos_lang')?.value === 'en' ? 'en' as const : 'nl' as const
  return (
    // Inhoud van het updatelog blijft voorlopig Nederlands — alleen balk/voet volgen de taalkeuze
    <LandingShell smal lang={lang} path="/updates">
      <section className="lp-sectie">
        <div className="lp-label">Updates</div>
        <h2 className="lp-h2">Wat er veranderd is.</h2>
        <p className="lp-intro">
          Nieuwste bovenaan.
        </p>

        <div className="lp-log">
          {CHANGELOG.map((r, i) => (
            <article key={r.datum} className="lp-release">
              <div>
                <div className="lp-release-datum">{datumNL(r.datum)}</div>
                <h3 className="lp-release-titel">{r.titel}</h3>
                {i === 0 && <span className="lp-nieuwste">Nieuwste</span>}
              </div>
              <div>
                {r.wijzigingen.map(w => {
                  const meta = SOORT_META[w.soort]
                  return (
                    <div key={w.tekst} className="lp-wijziging">
                      <span className="lp-soort" style={{ color: meta.kleur, background: `${meta.kleur}18`, border: `1px solid ${meta.kleur}44` }}>
                        {meta.label}
                      </span>
                      <p>{w.tekst}</p>
                    </div>
                  )
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
    </LandingShell>
  )
}

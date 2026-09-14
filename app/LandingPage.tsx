// ─── Landingspagina ───────────────────────────────────────────────────────────
// Wat een nieuwe bezoeker op / te zien krijgt: wat de app doet en hoe je je AI
// eraan koppelt. Meer niet — het updatelog en het verhaal achter de app staan op
// hun eigen pagina, bereikbaar via de balk bovenin.
//
// Bewust een server component zonder JavaScript. Stijl, balk en voet komen uit
// landing-chrome.tsx, zodat de drie publieke pagina's niet uit elkaar lopen.
// Inhoud is EN/NL via lib/i18n-landing.ts — Engels is de standaard voor nieuwe
// bezoekers, Nederlands kies je met de vlag rechtsboven (of via het aos_lang-cookie).

import Link from 'next/link'
import { LandingShell } from './landing-chrome'
import { datumNL, datumEN, laatsteUpdate } from '@/lib/changelog'
import { LANDING, MCP_TOOLS, type Lang } from '@/lib/i18n-landing'

export default function LandingPage({ lang = 'en' }: { lang?: Lang }) {
  const bijgewerkt = laatsteUpdate()
  const t = LANDING[lang]
  const datum = lang === 'nl' ? datumNL : datumEN

  return (
    <LandingShell lang={lang} path="/">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div>
          <span className="lp-pil"><span className="lp-stip" />{t.pil}</span>
          <h1 className="lp-h1">
            {t.h1[0]}<br />
            <span className="lp-gloed">{t.h1[1]}</span>
          </h1>
          <p className="lp-lead">{t.lead}</p>
          <div className="lp-cta">
            <Link href="/signup" className="lp-btn lp-btn-primair">{t.ctaBeginnen}</Link>
            <Link href="/login" className="lp-btn lp-btn-stil">{t.ctaAlHeb}</Link>
          </div>
          <p className="lp-noot">
            {t.noot}
            {bijgewerkt && t.bijgewerkt(datum(bijgewerkt))}
          </p>
        </div>

        {/* Nagebouwd doelenbord — dit is wat je in de app ziet */}
        <div className="lp-bord" aria-hidden="true">
          <div className="lp-bord-kop">
            <span className="lp-bord-titel">{t.bord.titel}</span>
            <span className="lp-stoplicht"><i /><i /><i /></span>
          </div>
          <div className="lp-kolommen">
            <div className="lp-kolom">
              <div className="lp-kolom-kop" style={{ color: '#58a6ff' }}>{t.bord.kol1}</div>
              <div className="lp-kaart">{t.bord.kol1Kaarten[0]}</div>
              <div className="lp-kaart">{t.bord.kol1Kaarten[1]}</div>
            </div>
            <div className="lp-kolom lp-kolom-doel">
              <div className="lp-kolom-kop" style={{ color: '#d29922' }}>{t.bord.kol2}</div>
              <div className="lp-kaart lp-kaart-sleep">{t.bord.kol2Kaarten[0]}</div>
              <div className="lp-kaart">{t.bord.kol2Kaarten[1]}</div>
            </div>
            <div className="lp-kolom">
              <div className="lp-kolom-kop" style={{ color: '#bc8cff' }}>{t.bord.kol3}</div>
              <div className="lp-kaart">{t.bord.kol3Kaarten[0]}</div>
              <div className="lp-kaart">{t.bord.kol3Kaarten[1]}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-streep" />

      {/* ── Wat het doet ────────────────────────────────────────────────── */}
      <section className="lp-sectie">
        <div className="lp-label">{t.sectie1.label}</div>
        <h2 className="lp-h2">{t.sectie1.h2}</h2>
        <p className="lp-intro">{t.sectie1.intro}</p>
        <div className="lp-raster">
          {t.functies.map(f => (
            <div key={f.titel} className="lp-glas">
              <span className="lp-emoji">{f.emoji}</span>
              <h3 className="lp-kop3">{f.titel}</h3>
              <p className="lp-tekst">{f.tekst}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-streep" />

      {/* ── RPM-credit ──────────────────────────────────────────────────── */}
      <section className="lp-sectie">
        <div className="lp-label">{t.rpm.label}</div>
        <h2 className="lp-h2">{t.rpm.h2}</h2>
        <p className="lp-intro">{t.rpm.intro}</p>
        <div className="lp-glas" style={{ padding: 20, maxWidth: 640 }}>
          <p className="lp-tekst" style={{ margin: 0 }}>{t.rpm.credit}</p>
        </div>
        <p className="lp-intro" style={{ marginTop: 14, marginBottom: 0 }}>
          <Link href="/rpm">{t.rpm.link}</Link>
        </p>
      </section>

      <div className="lp-streep" />

      {/* ── AI koppelen ─────────────────────────────────────────────────── */}
      <section className="lp-sectie">
        <div className="lp-ai">
          <div className="lp-label">{t.ai.label}</div>
          <h2 className="lp-h2">{t.ai.h2}</h2>
          <p className="lp-intro" style={{ marginBottom: 0 }}>{t.ai.intro}</p>

          <div className="lp-ai-split">
            <div className="lp-gesprek">
              <div className="lp-bubbel lp-bubbel-jij">{t.ai.bubbelJij}</div>
              <div className="lp-bubbel lp-bubbel-ai">{t.ai.bubbelAi}</div>
              <div className="lp-bubbel lp-bubbel-doen">{t.ai.bubbelDoen[0]}</div>
              <div className="lp-bubbel lp-bubbel-doen">{t.ai.bubbelDoen[1]}</div>
            </div>

            <div>
              <h3 className="lp-kop3">{t.ai.watMag}</h3>
              <p className="lp-tekst" style={{ marginBottom: 14 }}>{t.ai.watMagIntro}</p>
              <div className="lp-tools">
                {MCP_TOOLS.map(tool => <span key={tool} className="lp-tool">{tool}</span>)}
              </div>
              <ul className="lp-lijst" style={{ marginTop: 18 }}>
                {t.ai.li.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-streep" />

      {/* ── Koppelingen ─────────────────────────────────────────────────── */}
      <section className="lp-sectie">
        <div className="lp-label">{t.koppelSectie.label}</div>
        <h2 className="lp-h2">{t.koppelSectie.h2}</h2>
        <p className="lp-intro">{t.koppelSectie.intro}</p>
        <div className="lp-raster">
          {t.koppelingen.map(k => (
            <div key={k.titel} className="lp-glas lp-koppel">
              <span className="lp-koppel-emoji">{k.emoji}</span>
              <div>
                <h3 className="lp-kop3">
                  {k.titel}
                  {k.straks && <span className="lp-badge">{t.koppelSectie.binnenkort}</span>}
                </h3>
                <p className="lp-tekst">{k.tekst}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-streep" />

      {/* ── Aan de slag ─────────────────────────────────────────────────── */}
      <section className="lp-sectie">
        <div className="lp-label">{t.stappenSectie.label}</div>
        <h2 className="lp-h2">{t.stappenSectie.h2}</h2>
        <p className="lp-intro">{t.stappenSectie.intro}</p>
        <div className="lp-stappen">
          {t.stappen.map(s => (
            <div key={s.titel} className="lp-stap">
              <h3>{s.titel}</h3>
              <p>{s.tekst}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Slot ────────────────────────────────────────────────────────── */}
      <section className="lp-slot">
        <h2 className="lp-h2">{t.slot.h2}</h2>
        <p className="lp-intro" style={{ marginBottom: 28 }}>{t.slot.intro}</p>
        <div className="lp-cta" style={{ justifyContent: 'center' }}>
          <Link href="/signup" className="lp-btn lp-btn-primair">{t.slot.beginnen}</Link>
          <Link href="/login" className="lp-btn lp-btn-stil">{t.slot.inloggen}</Link>
        </div>
      </section>
    </LandingShell>
  )
}

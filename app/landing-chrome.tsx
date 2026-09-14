// ─── Omhulsel van de publieke pagina's ────────────────────────────────────────
// De landingspagina, het updatelog en de over-pagina delen dezelfde stijl,
// balk en voet. Die staan hier één keer, zodat ze niet uit elkaar lopen.
// Alle klassen zijn met `lp-` geprefixt zodat ze het dashboard nergens raken.

import Link from 'next/link'
import { LANDING, type Lang } from '@/lib/i18n-landing'

// Emoji-vlaggen (🇬🇧/🇳🇱) tonen op Windows alleen als "GB"/"NL"-tekst — Windows
// rendert landvlaggen bewust niet. Daarom hier zelf als kleine SVG's, zodat ze
// er overal als echte vlag uitzien.
function VlagGB() {
  return (
    <svg viewBox="0 0 60 30" width="20" height="10" aria-hidden="true">
      <path d="M0,0 H60 V30 H0 Z" fill="#00247d" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L25,12.5 M35,17.5 L60,30 M60,0 L35,12.5 M25,17.5 L0,30" stroke="#cf142b" strokeWidth="4" />
      <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 V30 M0,15 H60" stroke="#cf142b" strokeWidth="6" />
    </svg>
  )
}
function VlagNL() {
  return (
    <svg viewBox="0 0 60 30" width="20" height="10" aria-hidden="true">
      <path d="M0,0 H60 V10 H0 Z" fill="#ae1c28" />
      <path d="M0,10 H60 V20 H0 Z" fill="#fff" />
      <path d="M0,20 H60 V30 H0 Z" fill="#21468b" />
    </svg>
  )
}

export const MAKER = {
  naam: 'Acme Co',
  instagram: 'https://www.instagram.com/acme-co',
  youtube: 'https://www.youtube.com/@acme-co',
}

export const LANDING_CSS = `
/* De landingspagina is donkerder dan de app zelf. Dit blok bestaat alleen op
   deze pagina, dus het raakt het dashboard niet — zonder deze regel zie je bij
   het doorveren aan de rand nog de lichtere app-achtergrond. */
body { background:#030712; }

.lp-wrap { --lp-ink:#f3f4f6; --lp-zacht:#9aa4b2; --lp-vaag:#6b7280;
  min-height:100vh;
  --lp-glas:rgba(255,255,255,.025); --lp-rand:rgba(255,255,255,.10); --lp-rand2:rgba(255,255,255,.18);
  background:#030712; color:var(--lp-ink); position:relative; overflow-x:hidden; isolation:isolate; }

/* ── Achtergrond: paarse gloed van bovenaf plus een heel licht raster ── */
.lp-wrap::before { content:''; position:absolute; inset:0 0 auto; height:1100px; z-index:-2; pointer-events:none;
  background:
    radial-gradient(60% 55% at 50% 0%, rgba(124,77,255,.20), rgba(0,0,0,0) 72%),
    radial-gradient(40% 35% at 85% 8%, rgba(244,114,182,.10), rgba(0,0,0,0) 70%);
  animation:lp-adem 14s ease-in-out infinite; }
.lp-wrap::after { content:''; position:absolute; inset:0 0 auto; height:900px; z-index:-1; pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px);
  background-size:56px 56px;
  -webkit-mask-image:radial-gradient(70% 60% at 50% 0%, #000 20%, transparent 78%);
  mask-image:radial-gradient(70% 60% at 50% 0%, #000 20%, transparent 78%); }
@keyframes lp-adem { 0%,100% { opacity:.85 } 50% { opacity:1 } }

.lp { max-width:1080px; margin:0 auto; padding:0 24px; position:relative; }

/* ── Topbalk ── */
.lp-top { position:sticky; top:0; z-index:20; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
  background:rgba(3,7,18,.72); border-bottom:1px solid rgba(255,255,255,.06); }
.lp-top-in { max-width:1080px; margin:0 auto; padding:13px 24px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
.lp-logo { display:flex; align-items:center; gap:9px; font-size:15px; font-weight:700; letter-spacing:-.3px; }
.lp-nav { display:flex; align-items:center; gap:8px; }
.lp-nav-link { font-size:12.5px; color:var(--lp-zacht); text-decoration:none; padding:8px 10px; border-radius:7px; transition:color .15s; }
.lp-nav-link:hover { color:var(--lp-ink); }

/* ── Taalvlaggetjes ── */
.lp-vlaggen { display:flex; align-items:center; gap:4px; margin-right:4px; }
.lp-vlag { display:flex; align-items:center; text-decoration:none; padding:6px; border-radius:7px; opacity:.42; transition:opacity .15s, background .15s; }
.lp-vlag svg { display:block; border-radius:2px; box-shadow:0 0 0 1px rgba(255,255,255,.18); }
.lp-vlag:hover { opacity:1; background:rgba(255,255,255,.06); }
.lp-vlag-actief { opacity:1; }

/* ── Pillen ── */
.lp-pil { display:inline-flex; align-items:center; gap:7px; border-radius:999px; padding:5px 13px; font-size:11.5px; font-weight:500;
  background:rgba(255,255,255,.03); border:1px solid var(--lp-rand); color:var(--lp-zacht);
  backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
.lp-pil-alpha { color:#d8b4fe; border-color:rgba(216,180,254,.32); background:rgba(168,85,247,.10); font-weight:600; }
.lp-stip { width:6px; height:6px; border-radius:50%; background:#3fb950; box-shadow:0 0 0 3px rgba(63,185,80,.16); flex-shrink:0; }

/* ── Knoppen ── */
.lp-btn { display:inline-block; border-radius:9px; font-weight:600; text-decoration:none; transition:all .18s; white-space:nowrap; }
.lp-btn-primair { background:linear-gradient(180deg,#6f72e8,#5457d8); color:#fff; padding:12px 24px; font-size:14px;
  border:1px solid rgba(255,255,255,.16); box-shadow:0 6px 22px rgba(99,102,241,.30); }
.lp-btn-primair:hover { transform:translateY(-2px); box-shadow:0 12px 34px rgba(99,102,241,.45); }
.lp-btn-stil { background:rgba(255,255,255,.03); color:var(--lp-ink); padding:11px 20px; font-size:13.5px; border:1px solid var(--lp-rand);
  backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
.lp-btn-stil:hover { border-color:var(--lp-rand2); background:rgba(255,255,255,.06); }
.lp-btn-klein { padding:8px 16px; font-size:12.5px; }

/* ── Hero ── */
.lp-hero { padding:76px 0 64px; display:grid; grid-template-columns:1.05fr .95fr; gap:52px; align-items:center; }
.lp-h1 { font-size:clamp(34px,5.4vw,64px); line-height:1.0; font-weight:700; letter-spacing:-2px; margin:20px 0 20px; }
.lp-gloed { background:linear-gradient(90deg,#a5b4fc 0%,#d8b4fe 45%,#f9a8d4 100%); background-size:200% 100%;
  -webkit-background-clip:text; background-clip:text; color:transparent; animation:lp-pan 9s ease-in-out infinite; }
@keyframes lp-pan { 0%,100% { background-position:0% 50% } 50% { background-position:100% 50% } }
.lp-lead { font-size:16.5px; line-height:1.7; color:var(--lp-zacht); margin:0 0 30px; max-width:520px; }
.lp-cta { display:flex; gap:11px; flex-wrap:wrap; align-items:center; }
.lp-noot { font-size:12px; color:var(--lp-vaag); margin-top:16px; line-height:1.6; }

/* ── Nagebouwd doelenbord ── */
.lp-bord { background:var(--lp-glas); border:1px solid var(--lp-rand); border-radius:16px; padding:16px;
  backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); box-shadow:0 24px 70px rgba(0,0,0,.5); }
.lp-bord-kop { display:flex; align-items:center; justify-content:space-between; margin-bottom:13px; }
.lp-bord-titel { font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:var(--lp-vaag); }
.lp-stoplicht { display:flex; gap:5px; }
.lp-stoplicht i { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.13); display:block; }
.lp-kolommen { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.lp-kolom { background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.07); border-radius:10px; padding:9px; }
.lp-kolom-kop { font-size:10px; font-weight:700; margin-bottom:8px; }
.lp-kaart { font-size:10.5px; line-height:1.4; color:var(--lp-zacht); background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.07); border-radius:6px; padding:6px 7px; margin-bottom:5px; }
.lp-kolom-doel { border-color:rgba(165,180,252,.55); background:rgba(99,102,241,.10); box-shadow:0 0 0 3px rgba(99,102,241,.08); }
.lp-kaart-sleep { border-color:rgba(165,180,252,.65); color:var(--lp-ink); background:rgba(99,102,241,.20);
  transform:rotate(-1.4deg); box-shadow:0 8px 20px rgba(0,0,0,.45); }

/* ── Secties ── */
.lp-sectie { padding:72px 0; }
.lp-streep { height:1px; background:linear-gradient(90deg, transparent, rgba(255,255,255,.10) 20%, rgba(255,255,255,.10) 80%, transparent); }
.lp-label { font-size:10px; font-weight:700; letter-spacing:1.3px; text-transform:uppercase;
  background:linear-gradient(90deg,#a5b4fc,#d8b4fe); -webkit-background-clip:text; background-clip:text; color:transparent; margin-bottom:12px; }
.lp-h2 { font-size:clamp(23px,3.2vw,34px); font-weight:700; letter-spacing:-1px; line-height:1.15; margin:0 0 14px; }
.lp-intro { font-size:14.5px; line-height:1.75; color:var(--lp-zacht); margin:0 0 36px; max-width:640px; }

/* ── Glaskaarten ── */
.lp-raster { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:13px; }
.lp-glas { background:var(--lp-glas); border:1px solid var(--lp-rand); border-radius:13px; padding:19px;
  backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); transition:border-color .18s, transform .18s, background .18s; }
.lp-glas:hover { border-color:var(--lp-rand2); background:rgba(255,255,255,.05); transform:translateY(-3px); }
.lp-emoji { font-size:21px; display:block; margin-bottom:11px; }
.lp-kop3 { font-size:13.5px; font-weight:700; margin:0 0 7px; letter-spacing:-.2px; }
.lp-tekst { font-size:12.5px; line-height:1.68; color:var(--lp-zacht); margin:0; }

/* ── AI-blok ── */
.lp-ai { border-radius:18px; padding:36px; border:1px solid rgba(165,180,252,.20);
  background:linear-gradient(150deg, rgba(99,102,241,.13) 0%, rgba(168,85,247,.09) 45%, rgba(244,114,182,.05) 100%);
  box-shadow:0 30px 80px rgba(79,70,229,.10); }
.lp-ai-split { display:grid; grid-template-columns:1fr 1fr; gap:34px; align-items:start; margin-top:28px; }
.lp-gesprek { background:rgba(0,0,0,.42); border:1px solid var(--lp-rand); border-radius:13px; padding:15px;
  backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
.lp-bubbel { font-size:12.5px; line-height:1.6; border-radius:11px; padding:10px 13px; margin-bottom:8px; max-width:90%; }
.lp-bubbel-jij { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; margin-left:auto; border-bottom-right-radius:3px; }
.lp-bubbel-ai { background:rgba(255,255,255,.05); color:var(--lp-ink); border:1px solid var(--lp-rand); border-bottom-left-radius:3px; }
.lp-bubbel-doen { font-size:11.5px; color:#7ee787; background:rgba(63,185,80,.09); border:1px solid rgba(63,185,80,.26); }
.lp-tools { display:flex; flex-wrap:wrap; gap:5px; margin-top:14px; }
.lp-tool { font-size:10.5px; font-family:ui-monospace,'SF Mono',Menlo,monospace; color:#d8b4fe;
  background:rgba(188,140,255,.09); border:1px solid rgba(188,140,255,.24); border-radius:6px; padding:3px 8px; }

/* ── Lijstjes ── */
.lp-lijst { list-style:none; padding:0; margin:0; }
.lp-lijst li { font-size:13px; line-height:1.65; color:var(--lp-zacht); padding:11px 0 11px 27px; position:relative;
  border-bottom:1px solid rgba(255,255,255,.06); }
.lp-lijst li:last-child { border-bottom:none; }
.lp-lijst li::before { content:'→'; position:absolute; left:0; color:#a5b4fc; font-weight:700; }
.lp-lijst b { color:var(--lp-ink); font-weight:600; }

/* ── Koppelingen ── */
.lp-koppel { display:flex; align-items:flex-start; gap:13px; }
.lp-koppel-emoji { font-size:20px; line-height:1.2; flex-shrink:0; }
.lp-badge { display:inline-block; font-size:9.5px; font-weight:700; letter-spacing:.4px; text-transform:uppercase;
  border-radius:5px; padding:1px 6px; margin-left:7px; vertical-align:middle;
  color:#d29922; background:rgba(210,153,34,.12); border:1px solid rgba(210,153,34,.32); }

/* ── Stappen (genummerde kaarten) ── */
.lp-stappen { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:14px; counter-reset:stap; }
.lp-stap { position:relative; padding:22px 18px 18px; background:var(--lp-glas); border:1px solid var(--lp-rand); border-radius:13px;
  backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
.lp-stap::before { counter-increment:stap; content:counter(stap); position:absolute; top:-13px; left:18px; width:26px; height:26px; border-radius:50%;
  background:linear-gradient(180deg,#6f72e8,#5457d8); color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center;
  border:1px solid rgba(255,255,255,.16); box-shadow:0 4px 14px rgba(99,102,241,.35); }
.lp-stap h3 { font-size:13.5px; font-weight:700; margin:8px 0 6px; letter-spacing:-.2px; color:var(--lp-ink); }
.lp-stap p { font-size:12.5px; line-height:1.65; color:var(--lp-zacht); margin:0; }

/* ── Updatelog ── */
.lp-log { display:flex; flex-direction:column; }
.lp-release { display:grid; grid-template-columns:170px 1fr; gap:24px; padding:22px 0; border-top:1px solid rgba(255,255,255,.07); }
.lp-release:first-child { border-top:none; padding-top:0; }
.lp-release-datum { font-size:11.5px; color:var(--lp-vaag); font-variant-numeric:tabular-nums; }
.lp-release-titel { font-size:13.5px; font-weight:700; margin:5px 0 0; letter-spacing:-.2px; }
.lp-nieuwste { display:inline-block; font-size:9.5px; font-weight:700; letter-spacing:.5px; text-transform:uppercase;
  border-radius:5px; padding:1px 6px; margin-top:7px; color:#d8b4fe; background:rgba(168,85,247,.14); border:1px solid rgba(216,180,254,.3); }
.lp-wijziging { display:flex; align-items:flex-start; gap:10px; padding:5px 0; }
.lp-soort { flex-shrink:0; font-size:9.5px; font-weight:700; letter-spacing:.4px; text-transform:uppercase;
  border-radius:5px; padding:2px 7px; margin-top:1px; min-width:66px; text-align:center; }
.lp-wijziging p { font-size:12.5px; line-height:1.65; color:var(--lp-zacht); margin:0; }

/* ── Slot ── */
.lp-slot { text-align:center; padding:84px 0; }
.lp-slot .lp-intro { margin-left:auto; margin-right:auto; }
.lp-voet { border-top:1px solid rgba(255,255,255,.07); padding:26px 0 34px; display:flex; justify-content:space-between;
  align-items:center; gap:14px; flex-wrap:wrap; font-size:11.5px; color:var(--lp-vaag); }
.lp-voet a { color:var(--lp-zacht); text-decoration:none; }
.lp-voet a:hover { color:var(--lp-ink); }

/* ── Smal scherm ── */
@media (max-width:880px) {
  .lp-hero { grid-template-columns:1fr; gap:38px; padding:44px 0 48px; }
  .lp-ai-split { grid-template-columns:1fr; gap:26px; }
  .lp-ai { padding:24px; }
  .lp-sectie { padding:52px 0; }
  .lp-release { grid-template-columns:1fr; gap:10px; }
  .lp { padding:0 18px; }
  .lp-top-in { padding:11px 18px; }
  .lp-nav-link { display:none; }
  .lp-slot { padding:56px 0; }
}

/* ── Heel smal: anders past de balk bovenin net niet ── */
@media (max-width:430px) {
  .lp-top-in { padding:10px 14px; gap:8px; }
  .lp-top-in .lp-pil-alpha { display:none; }   /* 'Alpha' staat ook in de hero en de voet */
  .lp-logo { font-size:14px; }
  .lp-btn-klein { padding:7px 12px; font-size:12px; }
  .lp { padding:0 14px; }
}

/* ── Wie liever geen beweging ziet ── */
@media (prefers-reduced-motion:reduce) {
  .lp-wrap::before, .lp-gloed { animation:none; }
  .lp-btn, .lp-glas { transition:none; }
}
`

/**
 * Balk, achtergrond en voet om elke publieke pagina heen.
 * `smal` maakt de kolom smaller — prettiger voor lezen dan voor vertellen.
 * `lang` bepaalt de taal van de balk/voet zelf (nog niet van elke pagina-inhoud —
 * dat gebeurt per pagina); `path` is waar de taalvlaggetjes naar terugsturen.
 */
export function LandingShell({ children, smal = false, lang = 'nl', path = '/' }: {
  children: React.ReactNode
  smal?: boolean
  lang?: Lang
  path?: string
}) {
  const t = LANDING[lang].nav
  const naarLang = (naar: Lang) => `/lang?to=${naar}&path=${encodeURIComponent(path)}`

  return (
    <div className="lp-wrap">
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      <header className="lp-top">
        <div className="lp-top-in">
          <Link href="/" className="lp-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontSize: 18 }}>⚡</span> Horizon
            <span className="lp-pil lp-pil-alpha" style={{ marginLeft: 4, padding: '3px 9px', fontSize: 10 }}>Alpha</span>
          </Link>
          <nav className="lp-nav">
            <span className="lp-vlaggen">
              <a href={naarLang('en')} aria-label="English" title="English" className={`lp-vlag ${lang === 'en' ? 'lp-vlag-actief' : ''}`}><VlagGB /></a>
              <a href={naarLang('nl')} aria-label="Nederlands" title="Nederlands" className={`lp-vlag ${lang === 'nl' ? 'lp-vlag-actief' : ''}`}><VlagNL /></a>
            </span>
            <Link href="/updates" className="lp-nav-link">{t.updates}</Link>
            <Link href="/over" className="lp-nav-link">{t.over}</Link>
            <Link href="/login" className="lp-btn lp-btn-stil lp-btn-klein">{t.inloggen}</Link>
            <Link href="/signup" className="lp-btn lp-btn-primair lp-btn-klein">{t.account}</Link>
          </nav>
        </div>
      </header>

      <div className="lp" style={smal ? { maxWidth: 760 } : undefined}>
        {children}

        <footer className="lp-voet">
          <span>{LANDING[lang].voet(MAKER.naam)}</span>
          <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link href="/login">{t.inloggen}</Link>
            <Link href="/signup">{t.account}</Link>
          </span>
        </footer>
      </div>
    </div>
  )
}

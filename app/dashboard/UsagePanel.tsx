'use client'
import { useMemo, useState } from 'react'
import type { UsageEvent } from '@/lib/usage'
import { TAB_LABELS } from '@/lib/usage'
import { buildReport, reportAsText, minuten, type Suggestion } from '@/lib/usage-report'

// ─── UsagePanel — wat gebruik je echt? ────────────────────────────────────────
// Meten is één ding; er iets mee doen is het punt. Elk voorstel hieronder is
// met één klik toe te passen, en het rapport is te kopiëren zodat de AI ermee
// mee kan denken over grotere veranderingen.

const KLEUR: Record<Suggestion['kind'], string> = {
  'start-tab': '#3fb950', 'hide-tab': '#d29922', 'drop-feature': '#58a6ff', 'te-weinig-data': '#8b949e',
}

export function UsagePanel({ events, tabs, hiddenTabs, startTab, tracking, onSetStartTab, onToggleHidden, onSetTracking, onClear }: {
  events: UsageEvent[]
  /** De tabs zoals ze nu in de balk staan. */
  tabs: string[]
  hiddenTabs: string[]
  startTab: string | null
  tracking: boolean
  onSetStartTab: (tab: string) => void
  onToggleHidden: (tab: string) => void
  onSetTracking: (aan: boolean) => void
  onClear: () => void
}) {
  const [gekopieerd, setGekopieerd] = useState(false)
  const report = useMemo(() => buildReport(events, new Date(), { tabs }), [events, tabs])
  const maxSec = Math.max(1, ...report.tabs.map(t => t.seconds))

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(reportAsText(report))
      setGekopieerd(true)
      setTimeout(() => setGekopieerd(false), 2000)
    } catch { /* geen klembord: dan niet */ }
  }

  return (
    <div role="complementary" aria-label="Gebruik"
      style={{ position:'absolute', inset:0, overflowY:'auto', padding:'18px 20px 32px', maxWidth:860, margin:'0 auto',
        display:'flex', flexDirection:'column', gap:16 }}>

      <div>
        <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>📈 Gebruik</div>
        <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>
          {report.totalEvents === 0
            ? 'Nog niets gemeten — vanaf nu wordt bijgehouden welke tabs en knoppen je gebruikt.'
            : `${report.totalEvents} regels over ${report.days} ${report.days === 1 ? 'dag' : 'dagen'}. Alleen sleutels en tijd, nooit de inhoud van je taken of dagboek.`}
        </div>
      </div>

      {/* Voorstellen — het punt van de hele meting */}
      {report.suggestions.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.4px', color:'#e3b341' }}>VOORSTELLEN</div>
          {report.suggestions.map((s, i) => (
            <div key={`${s.kind}-${s.target ?? i}`}
              style={{ background:'rgba(255,255,255,.03)', border:`1px solid ${KLEUR[s.kind]}22`, borderRadius:8, padding:'10px 11px', display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:12.5, color:'#e2e8f0', lineHeight:1.5 }}>{s.text}</div>
              <div style={{ fontSize:10.5, color:'#8b949e' }}>{s.evidence}</div>
              {s.kind === 'start-tab' && s.target && (
                <button onClick={() => onSetStartTab(s.target!)} disabled={startTab === s.target}
                  style={knop('#3fb950', startTab === s.target)}>
                  {startTab === s.target ? '✓ Staat al zo' : 'Doe dat'}
                </button>
              )}
              {s.kind === 'hide-tab' && s.target && (
                <button onClick={() => onToggleHidden(s.target!)}
                  style={knop('#d29922', false)}>
                  {hiddenTabs.includes(s.target) ? '↩ Weer laten zien' : 'Verbergen'}
                </button>
              )}
              {s.kind === 'drop-feature' && (
                <div style={{ fontSize:10.5, color:'#64748b' }}>
                  Dit vraagt een codewijziging — neem het mee in het rapport hieronder.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.4px', color:'#818cf8', marginBottom:8 }}>TABS</div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {report.tabs.map(t => (
            <div key={t.tab} style={{ display:'flex', alignItems:'center', gap:9, fontSize:12 }}>
              <span style={{ width:82, flexShrink:0, color: t.visits ? '#e2e8f0' : '#4b5563' }}>{t.label}</span>
              <div style={{ flex:1, minWidth:0, height:8, background:'rgba(255,255,255,.04)', borderRadius:4, overflow:'hidden' }}>
                <div style={{ width:`${Math.round(t.seconds / maxSec * 100)}%`, height:'100%', background: t.visits ? '#6366f1' : 'transparent', borderRadius:4 }} />
              </div>
              <span style={{ width:56, flexShrink:0, textAlign:'right', fontSize:10.5, color:'#8b949e', fontVariantNumeric:'tabular-nums' }}>
                {t.visits ? `${t.visits}×` : '—'}
              </span>
              <span style={{ width:52, flexShrink:0, textAlign:'right', fontSize:10.5, color:'#64748b', fontVariantNumeric:'tabular-nums' }}>
                {t.seconds ? minuten(t.seconds) : ''}
              </span>
              <button onClick={() => onToggleHidden(t.tab)}
                title={hiddenTabs.includes(t.tab) ? 'Weer laten zien' : 'Verbergen uit de balk'}
                aria-label={`${hiddenTabs.includes(t.tab) ? 'Weer laten zien' : 'Verbergen'}: ${t.label}`}
                style={{ background:'none', border:'none', color: hiddenTabs.includes(t.tab) ? '#d29922' : '#3f4a5a', cursor:'pointer', fontSize:11, padding:'0 2px' }}>
                {hiddenTabs.includes(t.tab) ? '🙈' : '👁'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Onderdelen */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.4px', color:'#818cf8', marginBottom:8 }}>
          ONDERDELEN {report.unused.length > 0 && <span style={{ color:'#64748b', fontWeight:400 }}>· {report.unused.length} nooit gebruikt</span>}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {report.features.map(f => (
            <span key={f.key} title={`${TAB_LABELS[f.tab] ?? f.tab} · ${f.clicks} ${f.clicks === 1 ? 'keer' : 'keer'}`}
              style={{ fontSize:10.5, padding:'2px 8px', borderRadius:6,
                background: f.clicks ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.02)',
                border:`1px solid ${f.clicks ? 'rgba(99,102,241,.3)' : 'rgba(255,255,255,.07)'}`,
                color: f.clicks ? '#c7d2fe' : '#4b5563' }}>
              {f.label} {f.clicks > 0 && <b style={{ color:'#818cf8' }}>{f.clicks}</b>}
            </span>
          ))}
        </div>
      </div>

      {/* Rapport + knoppen */}
      <div style={{ marginTop:'auto', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', paddingTop:8, borderTop:'1px solid rgba(255,255,255,.07)' }}>
        <button onClick={kopieer} style={knop('#6366f1', false)}>
          {gekopieerd ? '✓ Gekopieerd' : '📋 Rapport kopiëren voor de AI'}
        </button>
        <label style={{ fontSize:11, color:'#8b949e', display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
          <input type="checkbox" checked={tracking} onChange={e => onSetTracking(e.target.checked)} aria-label="Gebruik meten" />
          gebruik meten
        </label>
        <button onClick={onClear} style={{ ...knop('#f85149', false), marginLeft:'auto' }}
          title="Alle metingen weggooien en opnieuw beginnen">
          Meting wissen
        </button>
      </div>
    </div>
  )
}

function knop(kleur: string, uit: boolean): React.CSSProperties {
  return {
    alignSelf:'flex-start', fontSize:11, fontWeight:600, padding:'5px 11px', borderRadius:6,
    border:`1px solid ${kleur}${uit ? '22' : '55'}`, background: uit ? 'transparent' : `${kleur}18`,
    color: uit ? '#64748b' : kleur, cursor: uit ? 'default' : 'pointer',
  }
}

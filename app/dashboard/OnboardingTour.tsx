'use client'
import { useState } from 'react'
import type { Category } from '@/lib/types'
import { XP_AMOUNTS } from '@/lib/xp'

/**
 * Rondleiding voor nieuwe gebruikers. Begint met het invoeren van een eerste
 * doel (levert echte XP op via de goals-trigger) en legt daarna de app uit.
 */
export function OnboardingTour({
  categories, onCreateGoal, onFinish, onClose,
}: {
  categories: Category[]
  onCreateGoal: (text: string, catId: string | null) => Promise<void>
  onFinish: () => Promise<void>
  onClose: () => void
}) {
  const [step, setStep]       = useState(0)
  const [goalText, setGoalText] = useState('')
  const [goalCat, setGoalCat]   = useState<string>('')
  const [saving, setSaving]     = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)

  async function saveGoal() {
    if (!goalText.trim() || saving) return
    setSaving(true)
    await onCreateGoal(goalText.trim(), goalCat || null)
    setSaving(false)
    setGoalSaved(true)
    setStep(2)
  }

  async function finish() {
    if (saving) return
    setSaving(true)
    await onFinish()
    setSaving(false)
    onClose()
  }

  const dot = (i: number) => (
    <span key={i} style={{ width: i === step ? 18 : 6, height:6, borderRadius:99, background: i === step ? '#a855f7' : i < step ? '#6366f1' : 'rgba(255,255,255,.15)', transition:'all .25s' }} />
  )

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9800, background:'rgba(3,5,12,.82)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'min(460px, 100%)', background:'#0d1117', border:'1px solid rgba(99,102,241,.3)', borderRadius:18, boxShadow:'0 40px 100px rgba(0,0,0,.7), 0 0 0 1px rgba(99,102,241,.1)', overflow:'hidden', animation:'bubbleIn .28s cubic-bezier(.34,1.56,.64,1)' }}>

        {/* Header */}
        <div style={{ padding:'22px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:5, alignItems:'center' }}>{[0,1,2,3].map(dot)}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#4b5563', cursor:'pointer', fontSize:13 }}>overslaan</button>
        </div>

        <div style={{ padding:'18px 24px 24px' }}>

          {/* Stap 0 — welkom */}
          {step === 0 && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:44, marginBottom:12 }}>⚡</div>
              <h2 style={{ fontSize:21, fontWeight:800, color:'#f1f5f9', marginBottom:10 }}>Welkom bij Horizon</h2>
              <p style={{ fontSize:14, color:'#94a3b8', lineHeight:1.6, marginBottom:6 }}>
                Je persoonlijke systeem voor doelen, projecten en dagplanning — met een AI die meedenkt.
              </p>
              <p style={{ fontSize:13, color:'#818cf8', lineHeight:1.6 }}>
                Terwijl je het gebruikt verdien je <strong>XP</strong> en level je op. Nieuwe features komen zo vanzelf vrij.
              </p>
              <button onClick={() => setStep(1)} style={btn}>Laten we beginnen →</button>
            </div>
          )}

          {/* Stap 1 — eerste doel invoeren */}
          {step === 1 && (
            <div>
              <div style={{ fontSize:34, textAlign:'center', marginBottom:8 }}>🎯</div>
              <h2 style={{ fontSize:19, fontWeight:800, color:'#f1f5f9', marginBottom:8, textAlign:'center' }}>Begin met een doel</h2>
              <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.6, marginBottom:16, textAlign:'center' }}>
                Alles start bij weten waar je heen wilt. Voer één doel in — je verdient er <strong style={{ color:'#4ade80' }}>+{XP_AMOUNTS.goal} XP</strong> voor.
              </p>
              <input autoFocus value={goalText} onChange={e => setGoalText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveGoal() }}
                placeholder="Bijv. 10 solo-optredens dit jaar"
                style={{ width:'100%', background:'#161c2d', border:'1px solid rgba(99,102,241,.3)', color:'#e2e8f0', borderRadius:10, padding:'11px 13px', fontSize:14, outline:'none', fontFamily:'inherit', marginBottom:10 }} />
              {categories.length > 0 && (
                <select value={goalCat} onChange={e => setGoalCat(e.target.value)}
                  style={{ width:'100%', background:'#161c2d', border:'1px solid var(--border)', color:'#cbd5e1', borderRadius:10, padding:'10px 13px', fontSize:13, outline:'none', fontFamily:'inherit', marginBottom:16 }}>
                  <option value="">— Levensgebied (optioneel) —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <button onClick={saveGoal} disabled={!goalText.trim() || saving} style={{ ...btn, opacity: goalText.trim() && !saving ? 1 : .5, marginTop:0 }}>
                {saving ? 'Opslaan…' : `Doel opslaan (+${XP_AMOUNTS.goal} XP)`}
              </button>
            </div>
          )}

          {/* Stap 2 — XP uitleg + hoe verder */}
          {step === 2 && (
            <div>
              <div style={{ textAlign:'center', marginBottom:14 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(74,222,128,.1)', border:'1px solid rgba(74,222,128,.3)', borderRadius:99, padding:'6px 14px', fontSize:13, color:'#4ade80', fontWeight:700 }}>
                  ✓ Eerste doel opgeslagen · +{XP_AMOUNTS.goal} XP
                </div>
              </div>
              <h2 style={{ fontSize:18, fontWeight:800, color:'#f1f5f9', marginBottom:12, textAlign:'center' }}>Zo verdien je XP</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {[
                  ['🎯', 'Doelen invoeren', `+${XP_AMOUNTS.goal} XP`],
                  ['✅', 'Taken afvinken', `+${XP_AMOUNTS.task} XP`],
                  ['🏆', 'Prestaties loggen', `+${XP_AMOUNTS.achievement} XP`],
                ].map(([icon, label, xp]) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', gap:11, padding:'9px 12px', background:'rgba(99,102,241,.06)', border:'1px solid rgba(99,102,241,.16)', borderRadius:10 }}>
                    <span style={{ fontSize:18 }}>{icon}</span>
                    <span style={{ flex:1, fontSize:13, color:'#cbd5e1' }}>{label}</span>
                    <span style={{ fontSize:12, fontWeight:800, color:'#4ade80' }}>{xp}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:12, color:'#64748b', lineHeight:1.6, textAlign:'center', marginBottom:4 }}>
                Klik altijd op de <strong style={{ color:'#c7d2fe' }}>⭐ Lvl-balk</strong> bovenin om je voortgang, XP per levensgebied en je logboek te zien.
              </p>
              <button onClick={() => setStep(3)} style={btn}>Verder →</button>
            </div>
          )}

          {/* Stap 3 — de AI + afsluiten */}
          {step === 3 && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:34, marginBottom:10 }}>🤖</div>
              <h2 style={{ fontSize:19, fontWeight:800, color:'#f1f5f9', marginBottom:10 }}>Horizon AI helpt je</h2>
              <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.6, marginBottom:8 }}>
                Rechtsonder zit je AI-assistent (of open <strong style={{ color:'#c7d2fe' }}>💬</strong> voor volledig scherm). Vraag hem taken te plannen, je week te vullen of iets af te vinken — hij regelt het en jij krijgt de XP.
              </p>
              <p style={{ fontSize:13, color:'#818cf8', lineHeight:1.6 }}>
                Klaar om te beginnen? Je krijgt <strong style={{ color:'#4ade80' }}>+{XP_AMOUNTS.tutorial} XP</strong> voor het afronden van de rondleiding.
              </p>
              <button onClick={finish} disabled={saving} style={{ ...btn, opacity: saving ? .5 : 1 }}>
                {saving ? 'Even…' : `Aan de slag! (+${XP_AMOUNTS.tutorial} XP)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  marginTop: 18, width: '100%', padding: '12px', borderRadius: 11,
  border: 'none', background: 'linear-gradient(135deg,#4338ca,#6366f1)',
  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 8px 24px rgba(67,56,202,.4)',
}

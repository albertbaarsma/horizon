'use client'
// Interactieve gids om een AI aan je Horizon te koppelen. Vier paden naast
// elkaar (Claude Desktop/claude.ai, Claude Code, eigen scripts, lokale AI) —
// geen los stappenplan per weg, maar dezelfde kaart-stijl als Instellingen
// (Section/Field uit ../PageForm) zodat dit niet als een aparte marketingpagina
// aanvoelt.
import { useState } from 'react'
import Link from 'next/link'
import { Section, Field } from '../PageForm'
import { AI_SETUP } from '@/lib/i18n/ai-setup'
import type { Lang } from '@/lib/lang'

type Pad = 'desktop' | 'code' | 'rest' | 'model'

const codeStijl: React.CSSProperties = {
  flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '7px 10px', fontSize: 11, color: 'var(--text)', wordBreak: 'break-all',
}
const kopieerKnopStijl = (actief: boolean): React.CSSProperties => ({
  background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 12px',
  color: actief ? 'var(--green)' : 'var(--muted)', cursor: 'pointer', fontSize: 12, flexShrink: 0,
})

export default function AiSetupClient({ token, lang, origin, initialPad }: { token: string; lang: Lang; origin: string; initialPad?: Pad }) {
  const t = AI_SETUP[lang]
  const [pad, setPad] = useState<Pad>(initialPad ?? 'desktop')
  const [copied, setCopied] = useState<string | null>(null)
  const [testState, setTestState] = useState<'idle' | 'bezig' | 'ok' | 'fout'>('idle')
  const [testMsg, setTestMsg] = useState('')

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(c => (c === key ? null : c)), 2000)
  }

  async function testToken() {
    setTestState('bezig')
    try {
      const res = await fetch('/api/ai/xp', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('not ok')
      const data = await res.json()
      setTestMsg(t.test.ok(data.level, data.totalXp))
      setTestState('ok')
    } catch {
      setTestMsg(t.test.fout)
      setTestState('fout')
    }
  }

  const connectorUrl = `${origin}/api/mcp/${token}`
  const codeCommand = `claude mcp add --transport http horizon ${origin}/api/mcp --header "Authorization: Bearer ${token}"`

  const PADEN: { key: Pad; label: string }[] = [
    { key: 'desktop', label: t.paden.desktop },
    { key: 'code', label: t.paden.code },
    { key: 'rest', label: t.paden.rest },
    { key: 'model', label: t.paden.model },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 32 }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Link href="/dashboard" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 12 }}>← Dashboard</Link>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{t.titel}</h1>
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>{t.intro}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 20 }}>
          {PADEN.map(p => (
            <button key={p.key} onClick={() => setPad(p.key)}
              style={{
                padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${pad === p.key ? 'var(--accent)' : 'var(--border)'}`,
                background: pad === p.key ? 'var(--accent)22' : 'var(--bg2)',
                color: pad === p.key ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer', fontSize: 12.5, fontWeight: pad === p.key ? 700 : 500, textAlign: 'left',
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {pad === 'desktop' && (
          <Section title={t.paden.desktop}>
            <Field label={t.desktop.stap1}>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>{t.desktop.stap1Tekst}</p>
            </Field>
            <Field label={t.desktop.stap2} hint={t.desktop.urlLabel}>
              <div style={{ display: 'flex', gap: 8 }}>
                <code style={codeStijl}>{connectorUrl}</code>
                <button onClick={() => copy(connectorUrl, 'url')} style={kopieerKnopStijl(copied === 'url')}>
                  {copied === 'url' ? t.gekopieerd : t.kopieer}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>{t.desktop.stap2Tekst}</p>
            </Field>
          </Section>
        )}

        {pad === 'code' && (
          <Section title={t.paden.code}>
            <Field label={t.code.stap1} hint={t.code.commandoLabel}>
              <div style={{ display: 'flex', gap: 8 }}>
                <code style={codeStijl}>{codeCommand}</code>
                <button onClick={() => copy(codeCommand, 'code')} style={kopieerKnopStijl(copied === 'code')}>
                  {copied === 'code' ? t.gekopieerd : t.kopieer}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>{t.code.stap1Tekst}</p>
            </Field>
          </Section>
        )}

        {pad === 'rest' && (
          <Section title={t.paden.rest}>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>{t.rest.intro}</p>
            <Field label={t.rest.tokenLabel}>
              <div style={{ display: 'flex', gap: 8 }}>
                <code style={codeStijl}>{token}</code>
                <button onClick={() => copy(token, 'token')} style={kopieerKnopStijl(copied === 'token')}>
                  {copied === 'token' ? t.gekopieerd : t.kopieer}
                </button>
              </div>
            </Field>
            <div suppressHydrationWarning style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 11, color: 'var(--muted)', lineHeight: 2 }}>
              <div><span style={{ color: 'var(--green)' }}>GET</span>&nbsp;&nbsp;&nbsp;{origin}/api/ai/tasks</div>
              <div><span style={{ color: 'var(--blue)' }}>POST</span>&nbsp;&nbsp;{origin}/api/ai/tasks</div>
              <div><span style={{ color: 'var(--yellow)' }}>PATCH</span> {origin}/api/ai/tasks?id=123</div>
              <div><span style={{ color: 'var(--green)' }}>GET</span>&nbsp;&nbsp;&nbsp;{origin}/api/ai/week-items</div>
              <div><span style={{ color: 'var(--green)' }}>GET</span>&nbsp;&nbsp;&nbsp;{origin}/api/ai/xp</div>
            </div>
          </Section>
        )}

        {pad === 'model' && (
          <Section title={t.paden.model}>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.6 }}>{t.model.intro}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t.model.optie1Titel}</div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.7 }}>{t.model.optie1Tekst}</p>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t.model.optie2Titel}</div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.7 }}>{t.model.optie2Tekst}</p>
                <pre style={{ ...codeStijl, flex: 'none', whiteSpace: 'pre-wrap', display: 'block', margin: 0, fontFamily: 'inherit', lineHeight: 1.8 }}>{t.model.optie2Velden}</pre>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t.model.optie3Titel}</div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.7 }}>{t.model.optie3Tekst}</p>
              </div>
            </div>

            <div style={{ marginTop: 18, background: 'var(--bg3)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 6, padding: '10px 12px', fontSize: 11.5, color: 'var(--text)', lineHeight: 1.7 }}>
              {t.model.kiezen}
            </div>

            <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 12, lineHeight: 1.7 }}>{t.model.caveat}</p>

            <Link href="/settings" style={{ display: 'inline-block', marginTop: 14, fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{t.model.settingsLink}</Link>
          </Section>
        )}

        {pad !== 'model' && (
          <Section title={t.test.knop}>
            <button onClick={testToken} disabled={testState === 'bezig'}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '8px 16px', color: '#fff', cursor: testState === 'bezig' ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, opacity: testState === 'bezig' ? .6 : 1 }}>
              {testState === 'bezig' ? t.test.bezig : t.test.knop}
            </button>
            {testMsg && (
              <p style={{ fontSize: 12, marginTop: 10, color: testState === 'ok' ? 'var(--green)' : 'var(--red)' }}>{testMsg}</p>
            )}
            <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 10, lineHeight: 1.6 }}>{t.test.noot}</p>
          </Section>
        )}
      </div>
    </div>
  )
}

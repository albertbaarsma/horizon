'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile, AiProvider } from '@/lib/types'
import Link from 'next/link'
import { GOOGLE_OAUTH_SCOPE_STRING } from '@/lib/google-scopes'
import { Section, Field, Row, inputStyle } from '../PageForm'
import { resolveLang, type Lang } from '@/lib/lang'

const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: '⚡ Anthropic Claude',
  ollama:    '🦙 Ollama (lokaal)',
  lmstudio:  '🖥 LM Studio (lokaal)',
  openai:    '🤖 OpenAI-compatible',
}

const PROVIDER_DEFAULTS: Record<AiProvider, { model: string; baseUrl: string; needsKey: boolean }> = {
  anthropic: { model: 'claude-haiku-4-5-20251001', baseUrl: '',                         needsKey: true  },
  ollama:    { model: 'mistral',                    baseUrl: 'http://localhost:11434',   needsKey: false },
  lmstudio:  { model: '',                           baseUrl: 'http://localhost:1234',    needsKey: false },
  openai:    { model: 'gpt-4o-mini',                baseUrl: 'https://api.openai.com',  needsKey: true  },
}

// Zelfde 9 keys als DashboardClient's OverigeKey/OVERIGE_VIEW_KEYS — het
// 'Overige'-cluster, hier los aan/uit te zetten per surface (mobiel/desktop).
const FEATURE_TOGGLES: { key: string; icon: string; label: string }[] = [
  { key: 'graph',        icon: '📊', label: 'Inzicht' },
  { key: 'youtube',      icon: '📺', label: 'YouTube' },
  { key: 'mail',         icon: '✉️', label: 'Mail' },
  { key: 'voortgang',    icon: '⭐', label: 'Voortgang' },
  { key: 'plansessie',   icon: '🗓', label: 'Plansessie' },
  { key: 'weekreview',   icon: '📋', label: 'Weekreview' },
  { key: 'dagafsluiten', icon: '🌙', label: 'Dag afsluiten' },
  { key: 'ai',           icon: '🤖', label: 'AI-popup' },
  { key: 'chat',         icon: '💬', label: 'AI-chat' },
]

export default function SettingsClient({ profile, userEmail }: { profile: Profile, userEmail: string }) {
  const [copied, setCopied]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)
  const [saveErr, setSaveErr] = useState('')

  const [provider,  setProvider]  = useState<AiProvider>((profile.ai_provider  ?? 'anthropic') as AiProvider)
  const [model,     setModel]     = useState(profile.ai_model   ?? '')
  const [baseUrl,   setBaseUrl]   = useState(profile.ai_base_url ?? '')
  const [apiKey,    setApiKey]    = useState(profile.ai_api_key  ?? '')

  const [baseUrlWindow, setBaseUrlWindow] = useState('')
  useEffect(() => { setBaseUrlWindow(window.location.origin) }, [])
  const defaults = PROVIDER_DEFAULTS[provider]

  const [showAlertBanners, setShowAlertBannersState] = useState(profile.show_alert_banners === true)
  async function setShowAlertBanners(aan: boolean) {
    setShowAlertBannersState(aan)
    await createClient().from('profiles').update({ show_alert_banners: aan }).eq('id', profile.id)
  }

  const [language, setLanguageState] = useState<Lang>(resolveLang(profile.language))
  async function setLanguage(lang: Lang) {
    setLanguageState(lang)
    await createClient().from('profiles').update({ language: lang }).eq('id', profile.id)
  }

  // Overige-cluster (Inzicht, YouTube, Mail, Voortgang, Plansessie, Weekreview,
  // Dag afsluiten, AI, Chat) — los aan/uit per surface. Zelfde sleutels als
  // DashboardClient's OverigeKey/mobile_hidden_features.
  const [hiddenTabs, setHiddenTabsState] = useState<string[]>(profile.hidden_tabs ?? [])
  const [mobileHiddenFeatures, setMobileHiddenFeaturesState] = useState<string[]>(profile.mobile_hidden_features ?? [])
  async function toggleDesktopFeature(key: string) {
    const next = hiddenTabs.includes(key) ? hiddenTabs.filter(k => k !== key) : [...hiddenTabs, key]
    setHiddenTabsState(next)
    await createClient().from('profiles').update({ hidden_tabs: next }).eq('id', profile.id)
  }
  async function toggleMobileFeature(key: string) {
    const next = mobileHiddenFeatures.includes(key) ? mobileHiddenFeatures.filter(k => k !== key) : [...mobileHiddenFeatures, key]
    setMobileHiddenFeaturesState(next)
    await createClient().from('profiles').update({ mobile_hidden_features: next }).eq('id', profile.id)
  }

  function copyToken() {
    navigator.clipboard.writeText(profile.ai_token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function onProviderChange(p: AiProvider) {
    setProvider(p)
    const d = PROVIDER_DEFAULTS[p]
    if (!model || model === PROVIDER_DEFAULTS[provider].model) setModel(d.model)
    if (!baseUrl || baseUrl === PROVIDER_DEFAULTS[provider].baseUrl) setBaseUrl(d.baseUrl)
  }

  async function reconnectGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Scopes centraal in lib/google-scopes.ts (zie login-pagina).
        scopes: GOOGLE_OAUTH_SCOPE_STRING,
        queryParams: { access_type: 'offline', prompt: 'consent' },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  async function saveAiSettings() {
    setSaving(true); setSaved(false); setSaveErr('')
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      ai_provider:  provider,
      ai_model:     model     || PROVIDER_DEFAULTS[provider].model || null,
      ai_base_url:  baseUrl   || PROVIDER_DEFAULTS[provider].baseUrl || null,
      ai_api_key:   apiKey    || null,
    }).eq('id', profile.id)
    setSaving(false)
    if (error) setSaveErr(error.message)
    else { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 32 }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Link href="/dashboard" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 12 }}>← Dashboard</Link>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>⚙ Instellingen</h1>
        </div>

        {/* Account */}
        <Section title="Account">
          <Row label="Email" value={userEmail} />
          <Row label="Naam" value={profile.display_name} />
          <button
            onClick={async () => { await createClient().auth.signOut(); window.location.href = '/login' }}
            style={{ marginTop: 8, fontSize: 12, color: '#f87171', background: 'rgba(248,81,73,.06)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 600 }}>
            Uitloggen
          </button>
        </Section>

        {/* Taal */}
        <Section title="🌐 Taal / Language">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(['en', 'nl'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLanguage(l)}
                style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${language === l ? 'var(--accent)' : 'var(--border)'}`, background: language === l ? 'var(--accent)22' : 'var(--bg3)', color: language === l ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontSize: 11, fontWeight: language === l ? 700 : 400, textAlign: 'left' }}>
                {l === 'en' ? '🇬🇧 English' : '🇳🇱 Nederlands'}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
            Geldt voor het dashboard. De homepage kiest zelf een taal voor bezoekers die nog niet zijn ingelogd.
          </p>
        </Section>

        {/* Meldingen */}
        <Section title="🔔 Meldingen">
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Urgente taken, achterstallige items, de wekelijkse controle en &quot;nog niet SMART&quot; zitten altijd onder het belletje bovenin. Wil je ze daarnaast ook los als balkje bovenin de app zien?
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12 }}>
            <input type="checkbox" checked={showAlertBanners} onChange={e => setShowAlertBanners(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }} />
            Meldingen ook los bovenin tonen
          </label>
        </Section>

        {/* Onderdelen aan/uit */}
        <Section title="📱 Onderdelen aan/uit">
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Inzicht, YouTube, Mail, Voortgang, Plansessie, Weekreview, Dag afsluiten en AI/chat zitten op desktop
            samen onder &apos;Overige&apos;. Op mobiel staan ze standaard allemaal uit — te veel voor een klein
            scherm. Hier zet je los per surface aan of uit wat je wilt zien.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Op mobiel</div>
              {FEATURE_TOGGLES.map(f => (
                <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, marginBottom: 8 }}>
                  <input type="checkbox" checked={!mobileHiddenFeatures.includes(f.key)} onChange={() => toggleMobileFeature(f.key)}
                    style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                  <span>{f.icon} {f.label}</span>
                </label>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Op desktop</div>
              {FEATURE_TOGGLES.map(f => (
                <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, marginBottom: 8 }}>
                  <input type="checkbox" checked={!hiddenTabs.includes(f.key)} onChange={() => toggleDesktopFeature(f.key)}
                    style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                  <span>{f.icon} {f.label}</span>
                </label>
              ))}
            </div>
          </div>
        </Section>

        {/* Horizon AI */}
        <Section title="🤖 Horizon AI">
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
            Kies welk AI-model Horizon AI gebruikt. Lokale modellen (Ollama, LM Studio) zijn gratis; modellen met tool-support (gpt-oss, qwen3, llama3.1+) kunnen ook taken en planning aanpassen.
            {' '}<Link href="/ai-setup?pad=model" style={{ color: 'var(--accent)', fontWeight: 600 }}>Uitgebreide instelgids (gratis/lokaal/betaald) →</Link>
          </p>

          {/* Provider */}
          <Field label="AI provider">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map(p => (
                <button key={p} onClick={() => onProviderChange(p)}
                  style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${provider === p ? 'var(--accent)' : 'var(--border)'}`, background: provider === p ? 'var(--accent)22' : 'var(--bg3)', color: provider === p ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontSize: 11, fontWeight: provider === p ? 700 : 400, textAlign: 'left' }}>
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
          </Field>

          {/* Model */}
          <Field label="Model" hint={defaults.model ? `Standaard: ${defaults.model}` : 'Gebruik de naam van het model dat je in LM Studio hebt geladen'}>
            <input value={model} onChange={e => setModel(e.target.value)}
              placeholder={defaults.model || 'bijv. llama-3.2-3b-instruct'}
              style={inputStyle} />
          </Field>

          {/* API key — only for providers that need one */}
          {defaults.needsKey && (
            <Field label="API key" hint={provider === 'anthropic' ? 'Haal op via console.anthropic.com' : 'Alleen nodig voor betaalde endpoints'}>
              <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                type="password" placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                style={inputStyle} />
            </Field>
          )}

          {/* Base URL — only for non-Anthropic */}
          {provider !== 'anthropic' && (
            <Field label="Base URL" hint="Pas aan als je een ander poort of IP gebruikt">
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                placeholder={defaults.baseUrl}
                style={inputStyle} />
            </Field>
          )}

          {/* Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <button onClick={saveAiSettings} disabled={saving}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '8px 18px', color: '#fff', cursor: saving ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, opacity: saving ? .6 : 1 }}>
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
            {saved   && <span style={{ color: 'var(--green)', fontSize: 12 }}>✓ Opgeslagen</span>}
            {saveErr && <span style={{ color: 'var(--red)',   fontSize: 12 }}>{saveErr}</span>}
          </div>

          {provider !== 'anthropic' && (
            <div style={{ marginTop: 14, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
              {provider === 'ollama' && <>Start Ollama: <code style={{ color: 'var(--text)' }}>ollama serve</code> &amp; <code style={{ color: 'var(--text)' }}>ollama pull mistral</code></>}
              {provider === 'lmstudio' && <>Start LM Studio → Local Server tab → Start server op poort 1234</>}
              {provider === 'openai' && <>Voer je API key in en kies een model zoals <code style={{ color: 'var(--text)' }}>gpt-4o-mini</code>. Werkt ook met andere OpenAI-compatible aanbieders — bijv. gratis via Google Gemini: Base URL <code style={{ color: 'var(--text)' }}>https://generativelanguage.googleapis.com/v1beta/openai</code>, model <code style={{ color: 'var(--text)' }}>gemini-2.0-flash</code>.</>}
            </div>
          )}
        </Section>

        {/* Google verbinding */}
        <Section title="🔗 Google verbinding">
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Verbinding met Google Calendar en Gmail. Klik &apos;Herverbinden&apos; als mails of agenda niet werken, of na een wachtwoordwijziging.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: profile.google_calendar_connected && profile.google_access_token ? 'var(--green)' : 'var(--red)' }}>
                {profile.google_calendar_connected && profile.google_access_token ? '● Verbonden' : '● Niet verbonden'}
              </span>
              {profile.google_token_expires_at && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                  Token verloopt: {new Date(profile.google_token_expires_at).toLocaleString('nl-NL')}
                </div>
              )}
            </div>
            <button onClick={reconnectGoogle}
              style={{ background: profile.google_calendar_connected && profile.google_access_token ? 'var(--bg4)' : 'var(--accent)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 14px', color: profile.google_calendar_connected && profile.google_access_token ? 'var(--text)' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {profile.google_calendar_connected && profile.google_access_token ? 'Herverbinden' : 'Verbinden met Google'}
            </button>
          </div>
        </Section>

        {/* Externe AI-toegang */}
        <Section title="🔗 Externe AI-toegang">
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Geef een externe AI (bijv. Claude in een andere app) toegang tot je taken via de REST API.
            {' '}<Link href="/ai-setup" style={{ color: 'var(--accent)', fontWeight: 600 }}>Bekijk de stap-voor-stap gids →</Link>
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Jouw toegangstoken</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <code style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 11, color: 'var(--text)', wordBreak: 'break-all' }}>
                {profile.ai_token}
              </code>
              <button onClick={copyToken}
                style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 12px', color: copied ? 'var(--green)' : 'var(--muted)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>
                {copied ? '✓ Gekopieerd' : 'Kopieer'}
              </button>
            </div>
          </div>

          <div suppressHydrationWarning style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 11, color: 'var(--muted)', lineHeight: 2 }}>
            <div suppressHydrationWarning><span style={{ color: 'var(--green)' }}>GET</span>   {baseUrlWindow}/api/ai/tasks</div>
            <div suppressHydrationWarning><span style={{ color: 'var(--blue)' }}>POST</span>  {baseUrlWindow}/api/ai/tasks</div>
            <div suppressHydrationWarning><span style={{ color: 'var(--yellow)' }}>PATCH</span> {baseUrlWindow}/api/ai/tasks?id=123</div>
          </div>
        </Section>
      </div>
    </div>
  )
}


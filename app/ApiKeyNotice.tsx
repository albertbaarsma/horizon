'use client'
// Gedeelde weergave voor de "Geen API key geconfigureerd"-fout die Report-
// Tab/PlanningSessionModal/etc. terugkrijgen van hun AI-hulpjes (allemaal nog
// Anthropic-only, zie lib/i18n/ai-setup.ts's model.caveat) — i.p.v. de kale
// rode foutregel een duidelijke knop naar de instelgids. Niet-API-key-fouten
// (netwerk, 4xx van iets anders) vallen terug op die kale rode regel.
import Link from 'next/link'
import type { Lang } from '@/lib/lang'

const TXT: Record<Lang, { title: string; hint: string; link: string }> = {
  nl: {
    title: 'Geen API key geconfigureerd',
    hint: 'Deze AI-functie werkt via Anthropic Claude en heeft daar nog een sleutel voor nodig.',
    link: 'Bekijk de instelgids →',
  },
  en: {
    title: 'No API key configured',
    hint: 'This AI feature runs on Anthropic Claude and still needs a key for it.',
    link: 'View the setup guide →',
  },
}

export function ApiKeyNotice({ error, lang }: { error: string; lang: Lang }) {
  if (!error.toLowerCase().includes('api key')) {
    return <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>
  }
  const t = TXT[lang]
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 5,
      fontSize: 12, color: '#f87171',
      background: 'rgba(248,81,73,.07)', border: '1px solid rgba(248,81,73,.25)',
      borderRadius: 6, padding: '9px 12px',
    }}>
      <span><strong>{t.title}</strong> — {t.hint}</span>
      <Link href="/ai-setup?pad=model" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', width: 'fit-content' }}>
        {t.link}
      </Link>
    </div>
  )
}

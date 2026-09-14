'use client'
import { useState, useEffect } from 'react'

interface Video {
  id: string; title: string; publishedAt: string; thumbnail: string
  views: number; likes: number; comments: number; privacy: string; scheduledAt: string | null
}
interface Channel {
  id: string; name: string; description: string; thumbnail: string
  subscribers: number; totalViews: number; videoCount: number
}
interface YoutubeData {
  connected: boolean; error?: string
  channel?: Channel
  published?: Video[]; scheduled?: Video[]; drafts?: Video[]
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function VideoCard({ v, highlight }: { v: Video; highlight?: string }) {
  const age = Math.floor((Date.now() - new Date(v.publishedAt).getTime()) / 86_400_000)
  const ageLabel = age === 0 ? 'vandaag' : age === 1 ? 'gisteren' : `${age}d geleden`

  return (
    <a
      href={`https://www.youtube.com/watch?v=${v.id}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block', textDecoration: 'none', color: 'inherit',
        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 10, overflow: 'hidden', transition: 'all .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.14)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)' }}
    >
      {v.thumbnail ? (
        <div style={{ position: 'relative', paddingTop: '56.25%', background: '#0d1117' }}>
          <img src={v.thumbnail} alt={v.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          {highlight && (
            <div style={{ position: 'absolute', top: 6, right: 6, background: '#ff0000', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3 }}>
              {highlight}
            </div>
          )}
        </div>
      ) : (
        <div style={{ height: 100, background: '#1a1f2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>▶</div>
      )}

      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4, marginBottom: 6,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {v.title}
        </div>

        {v.privacy === 'public' ? (
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#64748b' }}>
            <span>👁 {fmt(v.views)}</span>
            <span>👍 {fmt(v.likes)}</span>
            <span>💬 {fmt(v.comments)}</span>
            <span style={{ marginLeft: 'auto' }}>{ageLabel}</span>
          </div>
        ) : v.scheduledAt ? (
          <div style={{ fontSize: 11, color: '#fbbf24' }}>🕐 Gepland: {fmtDate(v.scheduledAt)}</div>
        ) : (
          <div style={{ fontSize: 11, color: '#64748b' }}>📝 Concept · {fmtDate(v.publishedAt)}</div>
        )}
      </div>
    </a>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div style={{ flex: 1, minWidth: 120, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-.5px' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export function YouTubeTab() {
  const [data, setData] = useState<YoutubeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/youtube')
      .then(r => r.json())
      .then(setData)
      .catch(e => setData({ connected: false, error: String(e) }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#64748b' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1s linear infinite' }}>◌</div>
        <div style={{ fontSize: 13 }}>YouTube-data laden…</div>
      </div>
    </div>
  )

  if (!data?.connected || data.error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#64748b' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📺</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>YouTube niet verbonden</div>
        <div style={{ fontSize: 12, marginBottom: 16, maxWidth: 320 }}>
          {data?.error ?? 'Log opnieuw in met Google om je YouTube-kanaal te koppelen.'}
        </div>
        <a href="/login" style={{ display: 'inline-block', background: '#ff0000', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 18px', borderRadius: 6, textDecoration: 'none' }}>
          Opnieuw verbinden
        </a>
      </div>
    </div>
  )

  const { channel, published = [], scheduled = [], drafts = [] } = data

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Channel header */}
      {channel && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20, padding: '16px 20px', background: 'rgba(255,0,0,.06)', border: '1px solid rgba(255,0,0,.15)', borderRadius: 12 }}>
          {channel.thumbnail && (
            <img src={channel.thumbnail} alt={channel.name} style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(255,0,0,.3)' }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-.3px' }}>{channel.name}</div>
            {channel.description && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{channel.description}</div>
            )}
          </div>
          <a href={`https://studio.youtube.com`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 600, color: '#ff6b6b', textDecoration: 'none', padding: '6px 12px', border: '1px solid rgba(255,0,0,.25)', borderRadius: 6, whiteSpace: 'nowrap' }}>
            ▶ Studio openen
          </a>
        </div>
      )}

      {/* Stats row */}
      {channel && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard label="Abonnees" value={fmt(channel.subscribers)} icon="👥" />
          <StatCard label="Totale views" value={fmt(channel.totalViews)} icon="👁" />
          <StatCard label="Video's" value={String(channel.videoCount)} icon="🎬" />
          {scheduled.length > 0 && <StatCard label="Ingepland" value={String(scheduled.length)} icon="🕐" />}
          {drafts.length > 0 && <StatCard label="Concepten" value={String(drafts.length)} icon="📝" />}
        </div>
      )}

      {/* Scheduled / upcoming */}
      {scheduled.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            🕐 Ingepland ({scheduled.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {scheduled.map(v => <VideoCard key={v.id} v={v} highlight="GEPLAND" />)}
          </div>
        </section>
      )}

      {/* Recent public videos */}
      {published.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
            📹 Recente video&apos;s ({published.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {published.map((v, i) => <VideoCard key={v.id} v={v} highlight={i === 0 ? 'NIEUWSTE' : undefined} />)}
          </div>
        </section>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12 }}>
            📝 Concepten ({drafts.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {drafts.map(v => <VideoCard key={v.id} v={v} />)}
          </div>
        </section>
      )}

      {published.length === 0 && scheduled.length === 0 && drafts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 13 }}>
          Geen video&apos;s gevonden.
        </div>
      )}
    </div>
  )
}

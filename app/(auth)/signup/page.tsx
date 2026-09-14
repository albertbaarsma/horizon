'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 360, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⚡</div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Horizon</h1>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Account aanmaken</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📬</div>
            <p style={{ color: 'var(--green)', fontWeight: 600 }}>Check je email!</p>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>Bevestig je account via de link in de mail.</p>
          </div>
        ) : (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
            <input
              type="password"
              placeholder="Wachtwoord (min. 6 tekens)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
            {error && <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '9px 0', color: '#fff', fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Laden...' : 'Account aanmaken'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--muted)', fontSize: 12 }}>
          Al een account?{' '}
          <Link href="/login" style={{ color: 'var(--blue)' }}>Inloggen</Link>
        </p>
      </div>
    </div>
  )
}

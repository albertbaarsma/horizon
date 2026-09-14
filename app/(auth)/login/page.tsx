'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GOOGLE_OAUTH_SCOPE_STRING } from '@/lib/google-scopes'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard'); router.refresh()
  }

  async function handleGoogleLogin() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Request Calendar scope alongside login
        // Scopes staan centraal in lib/google-scopes.ts (met validatie tegen
        // combinaties die Google weigert). Niet hier inline uitbreiden.
        scopes: GOOGLE_OAUTH_SCOPE_STRING,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent', // always show consent screen → ensures refresh_token
        },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) { setError(error.message); setLoading(false) }
    // On success, browser redirects to Google → no further action needed here
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ width:360, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:32 }}>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:28, marginBottom:6 }}>⚡</div>
          <h1 style={{ fontSize:18, fontWeight:700, color:'var(--text)' }}>Horizon</h1>
          <p style={{ color:'var(--muted)', fontSize:12, marginTop:4 }}>Inloggen op je dashboard</p>
        </div>

        {/* Google login */}
        <button onClick={handleGoogleLogin} disabled={loading}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            padding:'10px 0', marginBottom:16, borderRadius:7, cursor: loading ? 'not-allowed' : 'pointer',
            background:'#fff', border:'1px solid #dadce0', color:'#3c4043', fontSize:14, fontWeight:500,
            opacity: loading ? 0.7 : 1, transition:'box-shadow .15s' }}
          onMouseEnter={e => !loading && (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.25)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
          {/* Google G logo */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Inloggen met Google
        </button>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
          <span style={{ fontSize:11, color:'var(--dim)' }}>of</span>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
        </div>

        {/* Email/password */}
        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
            style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 12px', color:'var(--text)', fontSize:13, outline:'none' }} />
          <input type="password" placeholder="Wachtwoord" value={password} onChange={e => setPassword(e.target.value)} required
            style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 12px', color:'var(--text)', fontSize:13, outline:'none' }} />
          {error && <p style={{ color:'#f87171', fontSize:12, margin:0 }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ background:'var(--accent)', border:'none', borderRadius:6, padding:'9px 0', color:'#fff', fontWeight:600, fontSize:13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Laden…' : 'Inloggen'}
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:16, color:'var(--muted)', fontSize:12 }}>
          Nog geen account?{' '}
          <Link href="/signup" style={{ color:'var(--blue)' }}>Aanmelden</Link>
        </p>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import type { Task } from '@/lib/types'
import { renderJarvisContent, extractSuggestions, stripSuggestionsLine } from '@/lib/jarvis-render'
import { AI_PRESETS } from '@/lib/ai-presets'

type ChatImgAttachment  = { type:'image'; mimeType:string; base64:string; name:string; preview:string }
type ChatTextAttachment = { type:'text';  content:string;  name:string }
type ChatAttachment = ChatImgAttachment | ChatTextAttachment
type ToolStep = { tool: string; label: string }
type ChatMsg  = { role:'user'|'assistant'; content:string; attachments?: ChatAttachment[]; steps?: ToolStep[]; suggestions?: string[] }
type Convo    = { id: string; title: string; messages: ChatMsg[]; updatedAt: number }

const CONVOS_KEY = 'albert-chat-convos'
const TEXT_EXTS  = new Set(['.txt','.md','.csv','.json','.js','.ts','.tsx','.jsx','.html','.css','.py','.sh'])

async function resizeImageToBase64(file: File, maxPx = 1024): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    img.src = url
  })
}

function loadConvos(): Convo[] {
  try {
    const raw = localStorage.getItem(CONVOS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  // Eenmalige migratie: neem het bestaande widget-gesprek mee
  try {
    const widget = localStorage.getItem('jarvis-messages')
    if (widget) {
      const messages = JSON.parse(widget) as ChatMsg[]
      if (messages.length) {
        return [{ id: crypto.randomUUID(), title: 'Widget-gesprek', messages, updatedAt: Date.now() }]
      }
    }
  } catch {}
  return []
}

function slimConvos(convos: Convo[]): Convo[] {
  // base64-blobs strippen zodat localStorage niet volloopt
  return convos.slice(0, 40).map(c => ({
    ...c,
    messages: c.messages.slice(-80).map(m => ({
      ...m,
      attachments: m.attachments?.map(a => a.type === 'image' ? { ...a, base64: '', preview: '' } : a),
    })),
  }))
}

export default function ChatClient({ tasks }: { tasks: Task[] }) {
  const [convos,      setConvos]      = useState<Convo[]>([])
  const [activeId,    setActiveId]    = useState<string | null>(null)
  const [messages,    setMessages]    = useState<ChatMsg[]>([])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [streaming,   setStreaming]   = useState(false)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isDragOver,  setIsDragOver]  = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [providerKey, setProviderKey] = useState('anthropic|claude-haiku-4-5-20251001')
  const [showPresets, setShowPresets] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<'unknown'|'running'|'offline'|'starting'>('unknown')
  const [recording,    setRecording]    = useState(false)
  const [recSecs,      setRecSecs]      = useState(0)
  const [transcribing, setTranscribing] = useState(false)
  const [isMobile,     setIsMobile]     = useState(false)
  const [sidebarOpen,  setSidebarOpen]  = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setConvos(loadConvos())
    setProviderKey(localStorage.getItem('jarvis-provider-key') ?? 'anthropic|claude-haiku-4-5-20251001')
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])
  useEffect(() => { if (!isMobile) inputRef.current?.focus() }, [activeId, isMobile])

  // Berichten van het actieve gesprek syncen naar de gesprekkenlijst + localStorage
  useEffect(() => {
    if (!activeId || !messages.length) return
    setConvos(prev => {
      const title = messages.find(m => m.role === 'user')?.content.slice(0, 48) ?? 'Nieuw gesprek'
      const existing = prev.find(c => c.id === activeId)
      const updated: Convo = { id: activeId, title: existing?.title ?? title, messages, updatedAt: Date.now() }
      const next = [updated, ...prev.filter(c => c.id !== activeId)]
      try { localStorage.setItem(CONVOS_KEY, JSON.stringify(slimConvos(next))) } catch {}
      return next
    })
  }, [messages, activeId])

  // ── Ollama status / autostart bij lokaal model ───────────────────────────
  const isLocalProvider = providerKey.startsWith('ollama|') || providerKey.startsWith('lmstudio|')

  useEffect(() => {
    if (!isLocalProvider) { setOllamaStatus('unknown'); return }
    setOllamaStatus('unknown')
    fetch('/api/ollama').then(r => r.json()).then(d => {
      if (d.running) { setOllamaStatus('running'); return }
      setOllamaStatus('starting')
      fetch('/api/ollama', { method: 'POST' }).then(r => r.json()).then(d2 => {
        setOllamaStatus(d2.error ? 'offline' : 'running')
      }).catch(() => setOllamaStatus('offline'))
    }).catch(() => setOllamaStatus('offline'))
  }, [providerKey, isLocalProvider])

  // ── Gesprekken beheer ─────────────────────────────────────────────────────
  function newChat() {
    setActiveId(null)
    setMessages([])
    setAttachments([])
    setSidebarOpen(false)
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  function openConvo(id: string) {
    const c = convos.find(c => c.id === id)
    if (!c) return
    setActiveId(id)
    setMessages(c.messages)
    setSidebarOpen(false)
  }

  function deleteConvo(id: string) {
    setConvos(prev => {
      const next = prev.filter(c => c.id !== id)
      try { localStorage.setItem(CONVOS_KEY, JSON.stringify(slimConvos(next))) } catch {}
      return next
    })
    if (activeId === id) newChat()
  }

  // ── Bijlagen ──────────────────────────────────────────────────────────────
  async function handleFiles(files: FileList) {
    const added: ChatAttachment[] = []
    for (const file of Array.from(files)) {
      const ext = '.' + file.name.split('.').pop()!.toLowerCase()
      if (file.type.startsWith('image/')) {
        const base64  = await resizeImageToBase64(file)
        const preview = URL.createObjectURL(file)
        added.push({ type:'image', mimeType: file.type, base64, name: file.name, preview })
      } else if (TEXT_EXTS.has(ext) || file.type.startsWith('text/')) {
        const content = await file.text()
        added.push({ type:'text', content, name: file.name })
      }
    }
    if (added.length) setAttachments(prev => [...prev, ...added])
  }

  // ── Spraak ────────────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (recTimerRef.current) clearInterval(recTimerRef.current)
        setRecSecs(0)
        setRecording(false)
        setTranscribing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
          const ext  = recorder.mimeType.includes('webm') ? 'webm' : 'ogg'
          const form = new FormData()
          form.append('audio', blob, `recording.${ext}`)
          const res  = await fetch('/api/transcribe', { method:'POST', body: form })
          const d    = await res.json()
          if (d.text) setInput(prev => (prev ? prev + ' ' : '') + d.text)
          else if (d.error) setInput(`[Transcriptie mislukt: ${d.error}]`)
        } finally {
          setTranscribing(false)
          setTimeout(() => inputRef.current?.focus(), 50)
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setRecSecs(0)
      recTimerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000)
    } catch {
      alert('Microfoon-toegang geweigerd of niet beschikbaar.')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
  }

  // ── Versturen ─────────────────────────────────────────────────────────────
  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim()
    if ((!text && !attachments.length) || loading) return

    if (!activeIdRef.current) {
      const id = crypto.randomUUID()
      activeIdRef.current = id
      setActiveId(id)
    }

    const userMsg: ChatMsg = { role:'user', content: text || '📎', attachments: attachments.length ? [...attachments] : undefined }
    const currentAttachments = [...attachments]
    const history = messages
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setAttachments([])
    setLoading(true)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    try {
      const historyForApi  = history.map(m => ({ role: m.role, content: m.content }))
      const apiAttachments = currentAttachments.map(a =>
        a.type === 'image'
          ? { type: 'image', mimeType: a.mimeType, base64: a.base64, name: a.name }
          : { type: 'text',  content: a.content,   name: a.name }
      )
      const [prov, mod] = providerKey.split('|')
      // 'profile' = "Mijn instellingen": geen override, dan gebruikt de server
      // gewoon wat er in Instellingen → Horizon AI staat.
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          messages: [...historyForApi, { role:'user', content: text || '(bijlage)' }],
          attachments: apiAttachments,
          ...(prov === 'profile' ? {} : { providerOverride: { provider: prov, model: mod } }),
        }),
      })

      if (res.headers.get('content-type')?.includes('text/event-stream') && res.body) {
        setStreaming(true)
        setMessages(prev => [...prev, { role:'assistant', content:'', steps: [] }])
        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let content = ''
        let buf     = ''
        const steps: ToolStep[] = []
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const chunk = line.slice(6).trim()
            if (chunk === '[DONE]') continue
            try {
              const parsed = JSON.parse(chunk)
              if (parsed.type === 'step') {
                steps.push({ tool: parsed.tool, label: parsed.label })
                setMessages(prev => [...prev.slice(0, -1), { role:'assistant', content, steps: [...steps] }])
              } else {
                const delta = (parsed as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content
                if (delta) {
                  content += delta
                  setMessages(prev => [...prev.slice(0, -1), { role:'assistant', content, steps: [...steps] }])
                }
              }
            } catch {}
          }
        }
        if (!content && !steps.length) setMessages(prev => [...prev.slice(0, -1), { role:'assistant', content:'Geen antwoord.' }])
        else if (!content) setMessages(prev => [...prev.slice(0, -1), { role:'assistant', content: steps.map(s => s.label).join('\n'), steps }])
        else {
          const { text: finalText, suggestions } = extractSuggestions(content)
          setMessages(prev => [...prev.slice(0, -1), { role:'assistant', content: finalText, steps, suggestions }])
        }
      } else {
        const d = await res.json()
        const { text: finalText, suggestions } = extractSuggestions(d.content ?? d.error ?? 'Geen antwoord.')
        setMessages(prev => [...prev, { role:'assistant', content: finalText, suggestions: d.error ? undefined : suggestions }])
      }
    } catch {
      setMessages(prev => [...prev, { role:'assistant', content:'Verbindingsfout. Probeer opnieuw.' }])
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !loading

  const STARTERS = [
    'Wat moet ik vandaag doen?',
    'Plan mijn dag',
    'Wat staat er deze week op de planning?',
    'Welke taken zijn urgent?',
  ]

  const sidebarContent = (
    <>
      <button onClick={newChat}
        style={{ margin:12, padding:'10px 14px', borderRadius:10, border:'1px solid rgba(99,102,241,.35)', background:'rgba(99,102,241,.1)', color:'#a5b4fc', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:'inherit' }}>
        <span style={{ fontSize:15 }}>＋</span> Nieuw gesprek
      </button>
      <div style={{ flex:1, overflowY:'auto', padding:'0 8px 8px' }}>
        {convos.length === 0 && (
          <div style={{ fontSize:11, color:'var(--dim)', textAlign:'center', padding:'20px 10px' }}>Nog geen gesprekken</div>
        )}
        {convos.map(c => (
          <div key={c.id}
            onClick={() => openConvo(c.id)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', borderRadius:8, cursor:'pointer', marginBottom:2,
              background: c.id === activeId ? 'rgba(99,102,241,.14)' : 'transparent',
              border: c.id === activeId ? '1px solid rgba(99,102,241,.3)' : '1px solid transparent' }}
            onMouseEnter={e => { if (c.id !== activeId) e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
            onMouseLeave={e => { if (c.id !== activeId) e.currentTarget.style.background = 'transparent' }}>
            <span style={{ fontSize:12, flexShrink:0 }}>💬</span>
            <span style={{ flex:1, fontSize:12, color: c.id === activeId ? '#c7d2fe' : 'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</span>
            <button onClick={e => { e.stopPropagation(); deleteConvo(c.id) }}
              title="Verwijder gesprek"
              style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:12, padding:'0 2px', lineHeight:1 }}
              onMouseEnter={e => e.currentTarget.style.color='#f85149'}
              onMouseLeave={e => e.currentTarget.style.color='var(--dim)'}>×</button>
          </div>
        ))}
      </div>
      <a href="/dashboard" style={{ margin:12, padding:'9px 14px', borderRadius:10, border:'1px solid var(--border)', color:'var(--muted)', fontSize:12, textDecoration:'none', textAlign:'center' }}>
        ← Dashboard
      </a>
    </>
  )

  return (
    <div style={{ display:'flex', height:'100dvh', background:'#0b0f1a', color:'#e2e8f0', overflow:'hidden' }}
      onDragOver={e => { e.preventDefault(); if ([...e.dataTransfer.items].some(i => i.kind === 'file')) setIsDragOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false) }}
      onDrop={e => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files) }}>

      {isDragOver && (
        <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(99,102,241,.12)', border:'3px dashed rgba(99,102,241,.6)', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <div style={{ textAlign:'center', color:'#818cf8' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🖼️</div>
            <div style={{ fontSize:15, fontWeight:600 }}>Laat los om toe te voegen</div>
          </div>
        </div>
      )}

      {/* ── Zijbalk ── */}
      {isMobile ? (
        sidebarOpen && (
          <div style={{ position:'fixed', inset:0, zIndex:40 }} onClick={() => setSidebarOpen(false)}>
            <div onClick={e => e.stopPropagation()}
              style={{ position:'absolute', top:0, bottom:0, left:0, width:270, background:'#0d1117', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', animation:'slideInRight .18s ease reverse' }}>
              {sidebarContent}
            </div>
          </div>
        )
      ) : (
        <aside style={{ width:260, flexShrink:0, background:'#0d1117', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column' }}>
          {sidebarContent}
        </aside>
      )}

      {/* ── Hoofdkolom ── */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

        {/* Topbalk */}
        <header style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, position:'relative', flexShrink:0 }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:7, color:'var(--muted)', fontSize:14, padding:'4px 9px', cursor:'pointer' }}>☰</button>
          )}
          <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, color:'#fff', letterSpacing:'-.5px', flexShrink:0 }}>AI</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', letterSpacing:'-.3px' }}>Horizon AI</div>
            <button onClick={() => setShowPresets(p => !p)} style={{ background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
              <span style={{
                width:5, height:5, borderRadius:'50%', display:'inline-block', flexShrink:0,
                background: !isLocalProvider ? '#4ade80'
                          : ollamaStatus === 'running'  ? '#4ade80'
                          : ollamaStatus === 'starting' ? '#f59e0b'
                          : ollamaStatus === 'offline'  ? '#ef4444'
                          : '#94a3b8',
                animation: ollamaStatus === 'starting' ? 'pulse 1s ease infinite' : 'none',
              }} />
              <span style={{ fontSize:10, color:'#818cf8' }}>
                {AI_PRESETS.find(p => `${p.provider}|${p.model}` === providerKey)?.label ?? 'Claude Haiku'}
              </span>
              <span style={{ fontSize:8, color:'#4f5a6e' }}>▼</span>
            </button>
          </div>
          <div style={{ flex:1 }} />
          <a href="/settings" title="AI instellingen" style={{ background:'rgba(255,255,255,.05)', border:'1px solid var(--border)', color:'var(--muted)', fontSize:12, padding:'5px 9px', borderRadius:7, textDecoration:'none' }}>⚙</a>

          {/* Model dropdown */}
          {showPresets && (
            <div style={{ position:'absolute', top:'100%', left: isMobile ? 12 : 52, zIndex:100, background:'#0d1117', border:'1px solid rgba(99,102,241,.35)', borderRadius:10, boxShadow:'0 16px 40px rgba(0,0,0,.7)', overflow:'hidden', minWidth:220 }}>
              {AI_PRESETS.map(p => {
                const key = `${p.provider}|${p.model}`
                const active = key === providerKey
                return (
                  <button key={key} onClick={() => { setProviderKey(key); localStorage.setItem('jarvis-provider-key', key); setShowPresets(false) }}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'9px 14px', background: active ? 'rgba(99,102,241,.15)' : 'none', border:'none', borderBottom:'1px solid rgba(255,255,255,.05)', color: active ? '#a5b4fc' : '#94a3b8', cursor:'pointer', fontSize:12, textAlign:'left', fontFamily:'inherit' }}>
                    <span style={{ fontSize:14 }}>{p.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight: active ? 700 : 400 }}>{p.label}</div>
                      <div style={{ fontSize:9, color:'#4b5563' }}>{p.provider === 'profile' ? 'Instellingen → Horizon AI' : p.model}</div>
                    </div>
                    {active && <span style={{ color:'#6366f1', fontSize:12 }}>✓</span>}
                  </button>
                )
              })}
              {isLocalProvider && (
                <div style={{ padding:'8px 14px', borderTop:'1px solid rgba(255,255,255,.05)', fontSize:10, color: ollamaStatus === 'running' ? '#4ade80' : ollamaStatus === 'starting' ? '#f59e0b' : '#ef4444' }}>
                  {ollamaStatus === 'running'  ? '● Ollama actief' :
                   ollamaStatus === 'starting' ? '◌ Ollama start…' :
                   ollamaStatus === 'offline'  ? '● Ollama offline' : '◌ Controleren…'}
                </div>
              )}
            </div>
          )}
        </header>

        {/* Berichten */}
        <div style={{ flex:1, overflowY:'auto' }}>
          <div style={{ maxWidth:760, margin:'0 auto', padding:'24px 16px 12px', display:'flex', flexDirection:'column', gap:18 }}>

            {messages.length === 0 && (
              <div style={{ textAlign:'center', paddingTop:'14vh' }}>
                <div style={{ fontSize:38, fontWeight:900, color:'#6366f1', filter:'drop-shadow(0 0 18px rgba(99,102,241,.5))', marginBottom:14 }}>AI</div>
                <div style={{ fontSize:20, fontWeight:700, color:'#e2e8f0', marginBottom:6 }}>Hey Jordan, waar wil je aan werken?</div>
                <div style={{ fontSize:13, color:'var(--muted)', marginBottom:26 }}>Taken, planning, mails, weer — of gewoon even sparren.</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', maxWidth:520, margin:'0 auto' }}>
                  {STARTERS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      style={{ cursor:'pointer', padding:'9px 16px', borderRadius:12, border:'1px solid rgba(99,102,241,.25)', background:'rgba(99,102,241,.07)', color:'#a5b4fc', fontSize:13, fontFamily:'inherit', transition:'all .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(99,102,241,.16)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(99,102,241,.07)'}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'stretch',
                maxWidth: m.role === 'user' ? '80%' : '100%',
                display:'flex', flexDirection:'column', gap:6,
              }}>
                {m.role === 'assistant' && m.steps && m.steps.length > 0 && (
                  <div style={{ fontSize:11 }}>
                    <button
                      onClick={() => setExpandedSteps(prev => {
                        const next = new Set(prev)
                        if (next.has(i)) next.delete(i); else next.add(i)
                        return next
                      })}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#4b5563', display:'flex', alignItems:'center', gap:5, padding:'2px 0', fontSize:11, fontFamily:'inherit' }}>
                      <span style={{ color:'#6366f1' }}>{expandedSteps.has(i) ? '▾' : '▸'}</span>
                      <span style={{ color:'#6366f1', fontWeight:600 }}>{m.steps.length} stap{m.steps.length !== 1 ? 'pen' : ''}</span>
                    </button>
                    {expandedSteps.has(i) && (
                      <div style={{ marginTop:4, padding:'10px 12px', background:'rgba(99,102,241,.07)', border:'1px solid rgba(99,102,241,.18)', borderRadius:10, display:'flex', flexDirection:'column', gap:5 }}>
                        {m.steps.map((s, si) => (
                          <div key={si} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#64748b' }}>
                            <span style={{ color:'#4b5563', fontSize:10, fontWeight:700, fontVariantNumeric:'tabular-nums', minWidth:16, textAlign:'right' }}>{si + 1}.</span>
                            <span style={{ color:'#818cf8' }}>{s.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {m.attachments?.length ? (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {m.attachments.map((a, j) =>
                      a.type === 'image' ? (
                        a.preview
                          ? <img key={j} src={a.preview} alt={a.name} style={{ width:110, height:110, objectFit:'cover', borderRadius:12, border:'1px solid rgba(255,255,255,.15)' }} />
                          : <div key={j} style={{ fontSize:11, padding:'5px 10px', borderRadius:7, background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'#94a3b8' }}>🖼️ {a.name}</div>
                      ) : (
                        <div key={j} style={{ fontSize:11, padding:'5px 10px', borderRadius:7, background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'#94a3b8' }}>📄 {a.name}</div>
                      )
                    )}
                  </div>
                ) : null}

                {(m.content && m.content !== '📎') || m.role === 'assistant' ? (
                  m.role === 'user' ? (
                    <div style={{ padding:'11px 16px', borderRadius:'18px 18px 4px 18px', background:'linear-gradient(135deg,#4338ca,#6366f1)', color:'#f1f5f9', fontSize:14, lineHeight:1.65, whiteSpace:'pre-wrap', boxShadow:'0 4px 16px rgba(79,70,229,.3)' }}>
                      {m.content}
                    </div>
                  ) : (
                    <div style={{ fontSize:14, lineHeight:1.75, color:'#cbd5e1', whiteSpace:'pre-wrap', padding:'2px 2px 0' }}>
                      {renderJarvisContent(
                        stripSuggestionsLine(m.content) + (streaming && i === messages.length - 1 ? '▍' : ''),
                        tasks,
                        () => { window.location.href = '/dashboard' }
                      )}
                    </div>
                  )
                ) : null}
              </div>
            ))}

            {loading && !streaming && (
              <div style={{ display:'flex', gap:8, alignItems:'center', padding:'4px 2px' }}>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#818cf8', display:'inline-block', animation:`dot 1.4s ease ${i*.22}s infinite` }} />
                  ))}
                </div>
                <span style={{ fontSize:12, color:'#4b5563' }}>
                  {isLocalProvider ? 'Nadenken… (lokaal model kan even duren)' : 'Nadenken…'}
                </span>
              </div>
            )}

            {!loading && messages.length > 0 && (() => {
              const last = messages[messages.length - 1]
              if (last.role !== 'assistant' || !last.suggestions?.length) return null
              return (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {last.suggestions.map((s, i) => (
                    <button key={i} onClick={() => send(s)}
                      style={{ fontSize:12, padding:'6px 14px', borderRadius:99, border:'1px solid rgba(99,102,241,.3)', background:'rgba(99,102,241,.08)', color:'#a5b4fc', cursor:'pointer', fontFamily:'inherit', transition:'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(99,102,241,.18)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(99,102,241,.08)'}>
                      {s}
                    </button>
                  ))}
                </div>
              )
            })()}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Invoer */}
        <div style={{ flexShrink:0, padding:'8px 16px 18px' }}>
          <div style={{ maxWidth:760, margin:'0 auto' }}>

            {attachments.length > 0 && (
              <div style={{ padding:'0 4px 8px', display:'flex', flexWrap:'wrap', gap:6 }}>
                {attachments.map((a, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 8px 4px 4px', borderRadius:8, background:'rgba(99,102,241,.12)', border:'1px solid rgba(99,102,241,.25)', fontSize:12, color:'#a5b4fc' }}>
                    {a.type === 'image'
                      ? <img src={a.preview} alt={a.name} style={{ width:26, height:26, objectFit:'cover', borderRadius:5 }} />
                      : <span>📄</span>}
                    <span style={{ maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</span>
                    <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}
                      style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {(recording || transcribing) && (
              <div style={{ padding:'0 4px 6px', display:'flex', alignItems:'center', gap:8, fontSize:12, color: transcribing ? '#64748b' : '#f87171' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background: transcribing ? '#64748b' : '#f87171', display:'inline-block', animation: recording ? 'dot 1s ease 0s infinite' : 'none' }} />
                {transcribing ? 'Transcriberen…' : `Opnemen… ${recSecs}s`}
              </div>
            )}

            <div style={{ display:'flex', gap:8, alignItems:'flex-end', background:'#131a2c', border:'1px solid rgba(99,102,241,.25)', borderRadius:18, padding:'10px 12px', boxShadow:'0 8px 32px rgba(0,0,0,.35)' }}>
              <input ref={fileRef} type="file" multiple
                accept="image/*,.txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.html,.css,.py"
                style={{ display:'none' }}
                onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />

              <button onClick={() => fileRef.current?.click()} disabled={loading}
                title="Bijlage toevoegen"
                style={{ width:36, height:36, flexShrink:0, background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:17, display:'flex', alignItems:'center', justifyContent:'center' }}>
                📎
              </button>

              <textarea ref={inputRef} value={input} rows={1}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 240) + 'px'
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                onPaste={e => {
                  const files = e.clipboardData.files
                  if (files.length && [...files].some(f => f.type.startsWith('image/'))) { e.preventDefault(); handleFiles(files) }
                }}
                placeholder={recording ? 'Opnemen…' : transcribing ? 'Transcriberen…' : 'Stuur een bericht… (Shift+Enter = nieuwe regel)'}
                disabled={loading || recording || transcribing}
                style={{ flex:1, background:'none', border:'none', color:'#e2e8f0', fontSize:14, lineHeight:1.6, outline:'none', fontFamily:'inherit', resize:'none', maxHeight:240, padding:'7px 2px' }} />

              <button
                onClick={() => recording ? stopRecording() : startRecording()}
                disabled={loading || transcribing}
                title={recording ? 'Stop opname' : 'Spraakbericht opnemen'}
                style={{ width:36, height:36, flexShrink:0, background: recording ? 'rgba(248,81,73,.15)' : 'none', border:'none', color: recording ? '#f87171' : '#64748b', borderRadius:10, cursor: loading || transcribing ? 'default' : 'pointer', fontSize:17, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {recording ? '⏹' : '🎤'}
              </button>

              <button onClick={() => send()} disabled={!canSend}
                style={{ width:38, height:38, flexShrink:0, background: canSend ? 'linear-gradient(135deg,#4338ca,#6366f1)' : '#1e2843', border:'none', color: canSend ? '#fff' : '#2d3a55', borderRadius:12, cursor: canSend ? 'pointer' : 'default', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}>
                ↑
              </button>
            </div>
            <div style={{ fontSize:10, color:'var(--dim)', textAlign:'center', marginTop:8 }}>
              Horizon AI kan taken, planning en projecten aanpassen via tools · Enter = versturen
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

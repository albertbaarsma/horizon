'use client'
import { useState, useEffect, useRef } from 'react'
import type { Task, Project, Category } from '@/lib/types'
import { renderJarvisContent, extractSuggestions, stripSuggestionsLine } from '@/lib/jarvis-render'

type ChatImgAttachment  = { type:'image'; mimeType:string; base64:string; name:string; preview:string }
type ChatTextAttachment = { type:'text';  content:string;  name:string }
type ChatAttachment = ChatImgAttachment | ChatTextAttachment
type ToolStep = { tool: string; label: string }
type ChatMsg  = { role:'user'|'assistant'; content:string; attachments?: ChatAttachment[]; steps?: ToolStep[]; suggestions?: string[] }

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

const TEXT_EXTS = new Set(['.txt','.md','.csv','.json','.js','.ts','.tsx','.jsx','.html','.css','.py','.sh'])

import { AI_PRESETS as PRESETS } from '@/lib/ai-presets'

export function JarvisWidget({ tasks, projects, categories, onTaskClick, onMutated }: {
  tasks: Task[]; projects: Project[]; categories: Category[]; onTaskClick: (t:Task) => void; onMutated?: (tabs?: string[]) => void
}) {
  const [open,        setOpen]       = useState(false)
  const [providerKey, setProviderKey] = useState<string>(() => {
    if (typeof window === 'undefined') return 'anthropic|claude-haiku-4-5-20251001'
    return localStorage.getItem('jarvis-provider-key') ?? 'anthropic|claude-haiku-4-5-20251001'
  })
  const [showPresets,   setShowPresets]   = useState(false)
  const [ollamaStatus,  setOllamaStatus]  = useState<'unknown'|'running'|'offline'|'starting'>('unknown')
  const [messages,    setMessages]   = useState<ChatMsg[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem('jarvis-messages')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [input,       setInput]      = useState('')
  const [loading,     setLoading]    = useState(false)
  const [attachments, setAttachments]= useState<ChatAttachment[]>([])
  const [isDragOver,    setIsDragOver]    = useState(false)
  const [streaming,     setStreaming]     = useState(false)
  const [taskDragging,  setTaskDragging]  = useState<{ id: number; name: string } | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [recording,   setRecording]  = useState(false)
  const [recSecs,     setRecSecs]    = useState(0)
  const [transcribing,setTranscribing]= useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 80) }, [open])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  // Ctrl+J toggles the chat panel from anywhere on the page
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'j' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // open-jarvis custom event — lets other components open the widget programmatically
  useEffect(() => {
    const open = () => setOpen(true)
    window.addEventListener('open-jarvis', open)
    return () => window.removeEventListener('open-jarvis', open)
  }, [])

  // jarvis-prompt custom event — open + verstuur direct een prompt (bijv. "Plan mijn dag")
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  useEffect(() => {
    const onPrompt = (e: Event) => {
      const text = (e as CustomEvent<{ text?: string }>).detail?.text
      if (text) { setOpen(true); setPendingPrompt(text) }
    }
    window.addEventListener('jarvis-prompt', onPrompt)
    return () => window.removeEventListener('jarvis-prompt', onPrompt)
  }, [])

  useEffect(() => {
    if (pendingPrompt && !loading) {
      const text = pendingPrompt
      setPendingPrompt(null)
      send(text)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt, loading])

  // Listen for task drag events from MiniKanban so the FAB can act as a drop target
  useEffect(() => {
    const onStart = (e: Event) => setTaskDragging((e as CustomEvent<{ id: number; name: string }>).detail)
    const onEnd   = () => setTaskDragging(null)
    window.addEventListener('task-drag-start', onStart)
    window.addEventListener('task-drag-end',   onEnd)
    return () => {
      window.removeEventListener('task-drag-start', onStart)
      window.removeEventListener('task-drag-end',   onEnd)
    }
  }, [])

  // Check / auto-start Ollama when a local preset is active
  const isLocalProvider = providerKey.startsWith('ollama|') || providerKey.startsWith('lmstudio|')

  useEffect(() => {
    if (!isLocalProvider) { setOllamaStatus('unknown'); return }
    setOllamaStatus('unknown')
    fetch('/api/ollama').then(r => r.json()).then(d => {
      if (d.running) { setOllamaStatus('running'); return }
      // Not running → auto-start
      setOllamaStatus('starting')
      fetch('/api/ollama', { method: 'POST' }).then(r => r.json()).then(d2 => {
        setOllamaStatus(d2.error ? 'offline' : 'running')
      }).catch(() => setOllamaStatus('offline'))
    }).catch(() => setOllamaStatus('offline'))
  }, [providerKey, isLocalProvider])

  async function startOllama() {
    setOllamaStatus('starting')
    try {
      const d = await fetch('/api/ollama', { method: 'POST' }).then(r => r.json())
      setOllamaStatus(d.error ? 'offline' : 'running')
    } catch { setOllamaStatus('offline') }
  }

  // Persist messages to localStorage (strip base64 blobs to save space)
  useEffect(() => {
    if (messages.length === 0) return
    const slim = messages.slice(-60).map(m => ({
      ...m,
      attachments: m.attachments?.map(a =>
        a.type === 'image' ? { ...a, base64: '', preview: '' } : a
      ),
    }))
    try { localStorage.setItem('jarvis-messages', JSON.stringify(slim)) } catch {}
  }, [messages])

  // Clean up object-URL previews when component unmounts
  useEffect(() => () => {
    messages.forEach(m => m.attachments?.forEach(a => {
      if (a.type === 'image') URL.revokeObjectURL(a.preview)
    }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if ([...e.dataTransfer.items].some(i => i.kind === 'file')) setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const files = e.clipboardData.files
    if (files.length && [...files].some(f => f.type.startsWith('image/'))) {
      e.preventDefault()
      handleFiles(files)
    }
  }

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

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim()
    if ((!text && !attachments.length) || loading) return

    const userMsg: ChatMsg = { role:'user', content: text || '📎', attachments: attachments.length ? [...attachments] : undefined }
    const currentAttachments = [...attachments]
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setAttachments([])
    setLoading(true)

    try {
      const historyForApi = messages.map(m => ({ role: m.role, content: m.content }))
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
        // Read mutation metadata from header before consuming the body
        const mutationTabs = res.headers.get('X-Mutations')?.split(',').filter(Boolean)
        setStreaming(true)
        setMessages(prev => [...prev, { role:'assistant', content:'', steps: [] }])
        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let content      = ''
        let buf          = ''
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
        onMutated?.(mutationTabs)
      } else {
        const d = await res.json()
        const { text: finalText, suggestions } = extractSuggestions(d.content ?? d.error ?? 'Geen antwoord.')
        setMessages(prev => [...prev, { role:'assistant', content: finalText, suggestions: d.error ? undefined : suggestions }])
        if (!d.error) onMutated?.(d.mutations ?? [])
      }
    } catch {
      setMessages(prev => [...prev, { role:'assistant', content:'Verbindingsfout. Probeer opnieuw.' }])
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !loading

  const SUGGESTIONS = ['"Wat moet ik vandaag doen?"', '"Heb ik nog interessante nieuwe mails?"', '"Hoe is het weer vandaag?"', '"Welke taken zijn urgent?"']

  return (
    <div style={{ position:'fixed', bottom: isMobile ? 86 : 24, right:24, zIndex:1000, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:12, pointerEvents:'none' }}>

      {open && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            pointerEvents:'all',
            ...(isMobile ? {
              position:'fixed',
              bottom: 152,
              left: 8,
              right: 8,
              height: 'min(75dvh, 520px)',
              borderRadius: 16,
            } : {
              width: 390,
              height: 520,
              borderRadius: 20,
              position: 'relative',
            }),
            background:'#0b0f1a',
            border: isDragOver ? '1px solid rgba(99,102,241,.8)' : '1px solid rgba(99,102,241,.35)',
            boxShadow:'0 32px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(99,102,241,.08), inset 0 1px 0 rgba(255,255,255,.05)',
            display:'flex', flexDirection:'column', overflow:'hidden',
            animation:'bubbleIn .22s cubic-bezier(.34,1.56,.64,1)',
          }}
        >
          {isDragOver && (
            <div style={{ position:'absolute', inset:0, zIndex:10, borderRadius:20, background:'rgba(99,102,241,.12)', border:'2px dashed rgba(99,102,241,.6)', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
              <div style={{ textAlign:'center', color:'#818cf8' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🖼️</div>
                <div style={{ fontSize:13, fontWeight:600 }}>Laat los om toe te voegen</div>
              </div>
            </div>
          )}

          {/* Header */}
          <div style={{ padding:'13px 16px', background:'linear-gradient(135deg,rgba(79,70,229,.25) 0%,rgba(11,15,26,.95) 100%)', borderBottom:'1px solid rgba(99,102,241,.2)', display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#fff', boxShadow:'0 0 18px rgba(99,102,241,.45)', letterSpacing:'-.5px' }}>AI</div>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9', letterSpacing:'-.3px' }}>Horizon AI</div>
                {/* Model pill — click to switch */}
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
                    {PRESETS.find(p => `${p.provider}|${p.model}` === providerKey)?.label ?? 'Claude Haiku'}
                  </span>
                  <span style={{ fontSize:8, color:'#4f5a6e' }}>▼</span>
                </button>
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); localStorage.removeItem('jarvis-messages') }}
                  title="Wis gesprek"
                  style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', color:'#64748b', cursor:'pointer', fontSize:12, padding:'5px 9px', borderRadius:7, transition:'all .15s' }}
                  onMouseEnter={e => e.currentTarget.style.color='#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color='#64748b'}>🗑</button>
              )}
              <a href="/chat" title="Open volledig scherm" style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', color:'#64748b', cursor:'pointer', fontSize:12, padding:'5px 9px', borderRadius:7, textDecoration:'none', display:'flex', alignItems:'center' }}>⛶</a>
              <a href="/settings" title="AI instellingen" style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', color:'#64748b', cursor:'pointer', fontSize:12, padding:'5px 9px', borderRadius:7, textDecoration:'none', display:'flex', alignItems:'center' }}>⚙</a>
              <button onClick={() => setOpen(false)} style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', color:'#94a3b8', cursor:'pointer', fontSize:15, padding:'5px 9px', borderRadius:7, transition:'all .15s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.12)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.07)'}>✕</button>
            </div>

            {/* Provider dropdown */}
            {showPresets && (
              <div style={{ position:'absolute', top:'100%', left:16, zIndex:100, background:'#0d1117', border:'1px solid rgba(99,102,241,.35)', borderRadius:10, boxShadow:'0 16px 40px rgba(0,0,0,.7)', overflow:'hidden', minWidth:210 }}>
                {PRESETS.map(p => {
                  const key = `${p.provider}|${p.model}`
                  const active = key === providerKey
                  return (
                    <button key={key} onClick={() => { setProviderKey(key); localStorage.setItem('jarvis-provider-key', key); setShowPresets(false) }}
                      style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'9px 14px', background: active ? 'rgba(99,102,241,.15)' : 'none', border:'none', borderBottom:'1px solid rgba(255,255,255,.05)', color: active ? '#a5b4fc' : '#94a3b8', cursor:'pointer', fontSize:12, textAlign:'left' }}>
                      <span style={{ fontSize:14 }}>{p.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight: active ? 700 : 400 }}>{p.label}</div>
                        <div style={{ fontSize:9, color:'#4b5563' }}>{p.provider === 'profile' ? 'Instellingen → Horizon AI' : p.model}</div>
                      </div>
                      {active && <span style={{ color:'#6366f1', fontSize:12 }}>✓</span>}
                    </button>
                  )
                })}
                {/* Ollama status row */}
                {isLocalProvider && (
                  <div style={{ padding:'8px 14px', borderTop:'1px solid rgba(255,255,255,.05)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <span style={{ fontSize:10, color: ollamaStatus === 'running' ? '#4ade80' : ollamaStatus === 'starting' ? '#f59e0b' : '#ef4444' }}>
                      {ollamaStatus === 'running'  ? '● Ollama actief' :
                       ollamaStatus === 'starting' ? '◌ Ollama start…' :
                       ollamaStatus === 'offline'  ? '● Ollama offline' : '◌ Controleren…'}
                    </span>
                    {(ollamaStatus === 'offline') && (
                      <button onClick={startOllama}
                        style={{ fontSize:10, padding:'3px 9px', borderRadius:5, background:'rgba(99,102,241,.2)', border:'1px solid rgba(99,102,241,.4)', color:'#a5b4fc', cursor:'pointer' }}>
                        Start
                      </button>
                    )}
                  </div>
                )}
                <a href="/settings" style={{ display:'block', padding:'8px 14px', fontSize:11, color:'#4b5563', textDecoration:'none', borderTop:'1px solid rgba(255,255,255,.05)' }}
                  onMouseEnter={e => e.currentTarget.style.color='#818cf8'}
                  onMouseLeave={e => e.currentTarget.style.color='#4b5563'}>
                  ⚙ Meer instellingen…
                </a>
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'14px 14px 8px', display:'flex', flexDirection:'column', gap:10 }}>
            {messages.length === 0 && (
              <div style={{ color:'#334155', fontSize:12, textAlign:'center', padding:'20px 10px', lineHeight:2 }}>
                <div style={{ fontSize:24, fontWeight:900, marginBottom:10, color:'#6366f1', filter:'drop-shadow(0 0 14px rgba(99,102,241,.55))' }}>AI</div>
                <div style={{ color:'#475569', fontWeight:500, marginBottom:12 }}>Hey Jordan, wat kan ik voor je doen?</div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {SUGGESTIONS.map(s => (
                    <span key={s} onClick={() => { setInput(s.slice(1,-1)); setTimeout(()=>inputRef.current?.focus(),30) }}
                      style={{ cursor:'pointer', padding:'5px 12px', borderRadius:8, border:'1px solid rgba(99,102,241,.15)', background:'rgba(99,102,241,.06)', color:'#818cf8', transition:'all .15s', fontSize:12 }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(99,102,241,.14)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(99,102,241,.06)'}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m,i) => (
              <div key={i} style={{
                alignSelf: m.role==='user' ? 'flex-end' : 'flex-start',
                maxWidth:'88%', fontSize:13, lineHeight:1.65,
                display:'flex', flexDirection:'column', gap:6,
              }}>
                {/* Tool steps / thinking section */}
                {m.role === 'assistant' && m.steps && m.steps.length > 0 && (
                  <div style={{ fontSize:11 }}>
                    <button
                      onClick={() => setExpandedSteps(prev => {
                        const next = new Set(prev)
                        next.has(i) ? next.delete(i) : next.add(i)
                        return next
                      })}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#4b5563', display:'flex', alignItems:'center', gap:5, padding:'2px 0', fontSize:10 }}>
                      <span style={{ color:'#6366f1', fontSize:11 }}>
                        {expandedSteps.has(i) ? '▾' : '▸'}
                      </span>
                      <span style={{ color:'#6366f1', fontWeight:600 }}>
                        {m.steps.length} stap{m.steps.length !== 1 ? 'pen' : ''}
                      </span>
                      <span style={{ color:'#374151' }}>— klik om te {expandedSteps.has(i) ? 'sluiten' : 'zien'}</span>
                    </button>
                    {expandedSteps.has(i) && (
                      <div style={{ marginTop:4, padding:'8px 10px', background:'rgba(99,102,241,.07)', border:'1px solid rgba(99,102,241,.18)', borderRadius:10, display:'flex', flexDirection:'column', gap:5 }}>
                        {m.steps.map((s, si) => (
                          <div key={si} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:'#64748b' }}>
                            <span style={{ color:'#4b5563', fontSize:9, fontWeight:700, fontVariantNumeric:'tabular-nums', minWidth:14, textAlign:'right' }}>{si + 1}.</span>
                            <span style={{ color:'#818cf8' }}>{s.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {m.attachments?.length ? (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, justifyContent: m.role==='user' ? 'flex-end' : 'flex-start' }}>
                    {m.attachments.map((a,j) =>
                      a.type === 'image' ? (
                        <img key={j} src={a.preview || ''} alt={a.name}
                          style={{ width:90, height:90, objectFit:'cover', borderRadius:10, border:'1px solid rgba(255,255,255,.15)' }} />
                      ) : (
                        <div key={j} style={{ fontSize:10, padding:'4px 9px', borderRadius:6, background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'#94a3b8', display:'flex', alignItems:'center', gap:4 }}>
                          📄 {a.name}
                        </div>
                      )
                    )}
                  </div>
                ) : null}
                {(m.content && m.content !== '📎') || m.role === 'assistant' ? (
                  <div style={{
                    padding:'9px 14px',
                    borderRadius: m.role==='user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                    background: m.role==='user' ? 'linear-gradient(135deg,#4338ca,#6366f1)' : '#161c2d',
                    color: m.role==='user' ? '#f1f5f9' : '#cbd5e1',
                    border: m.role==='user' ? 'none' : '1px solid rgba(255,255,255,.07)',
                    boxShadow: m.role==='user' ? '0 4px 16px rgba(79,70,229,.35)' : 'none',
                    whiteSpace:'pre-wrap',
                  }}>
                    {m.role === 'assistant'
                      ? renderJarvisContent(
                          stripSuggestionsLine(m.content) + (streaming && i === messages.length - 1 ? '▍' : ''),
                          tasks, t => onTaskClick(t)
                        )
                      : m.content}
                  </div>
                ) : null}
              </div>
            ))}

            {loading && !streaming && (
              <div style={{ alignSelf:'flex-start', background:'rgba(99,102,241,.06)', border:'1px solid rgba(99,102,241,.18)', borderRadius:'4px 18px 18px 18px', padding:'10px 14px', display:'flex', gap:8, alignItems:'center', maxWidth:'88%' }}>
                <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width:5, height:5, borderRadius:'50%', background:'#818cf8', display:'inline-block', animation:`dot 1.4s ease ${i*.22}s infinite` }} />
                  ))}
                </div>
                <span style={{ fontSize:11, color:'#4b5563' }}>Nadenken…</span>
              </div>
            )}

            {/* Vervolgsuggesties van het laatste antwoord */}
            {!loading && messages.length > 0 && (() => {
              const last = messages[messages.length - 1]
              if (last.role !== 'assistant' || !last.suggestions?.length) return null
              return (
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, alignSelf:'flex-start', maxWidth:'92%' }}>
                  {last.suggestions.map((s, i) => (
                    <button key={i} onClick={() => send(s)}
                      style={{ fontSize:11, padding:'4px 11px', borderRadius:99, border:'1px solid rgba(99,102,241,.3)', background:'rgba(99,102,241,.08)', color:'#a5b4fc', cursor:'pointer', fontFamily:'inherit', transition:'background .15s' }}
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

          {/* Input area */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,.06)' }}>
            {attachments.length > 0 && (
              <div style={{ padding:'8px 12px 0', display:'flex', flexWrap:'wrap', gap:5 }}>
                {attachments.map((a,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 6px 3px 3px', borderRadius:7, background:'rgba(99,102,241,.12)', border:'1px solid rgba(99,102,241,.25)', fontSize:11, color:'#a5b4fc' }}>
                    {a.type === 'image'
                      ? <img src={a.preview} alt={a.name} style={{ width:22, height:22, objectFit:'cover', borderRadius:4 }} />
                      : <span>📄</span>
                    }
                    <span style={{ maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</span>
                    <button onClick={() => setAttachments(p => p.filter((_,j) => j !== i))}
                      style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', fontSize:13, lineHeight:1, padding:'0 2px' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {(recording || transcribing) && (
              <div style={{ padding:'6px 12px 0', display:'flex', alignItems:'center', gap:8, fontSize:11, color: transcribing ? '#64748b' : '#f87171' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background: transcribing ? '#64748b' : '#f87171', display:'inline-block', animation: recording ? 'dot 1s ease 0s infinite' : 'none' }} />
                {transcribing ? 'Transcriberen…' : `Opnemen… ${recSecs}s`}
              </div>
            )}

            <div style={{ padding:'8px 10px 12px', display:'flex', gap:6, alignItems:'center' }}>
              <input ref={fileRef} type="file" multiple
                accept="image/*,.txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.html,.css,.py"
                style={{ display:'none' }}
                onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />

              <button onClick={() => fileRef.current?.click()} disabled={loading}
                title="Bijlage toevoegen (afbeelding of tekstbestand)"
                style={{ width:34, height:34, flexShrink:0, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'#64748b', borderRadius:9, cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}
                onMouseEnter={e => e.currentTarget.style.color='#94a3b8'}
                onMouseLeave={e => e.currentTarget.style.color='#64748b'}>
                📎
              </button>

              <input ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                onPaste={handlePaste}
                placeholder={recording ? 'Opnemen…' : transcribing ? 'Transcriberen…' : 'Stuur een bericht…'}
                disabled={loading || recording || transcribing}
                style={{ flex:1, background:'#161c2d', border:'1px solid rgba(255,255,255,.1)', color:'#e2e8f0', borderRadius:12, padding:'9px 12px', fontSize:13, outline:'none', fontFamily:'inherit', transition:'border-color .15s' }}
                onFocus={e => e.target.style.borderColor='rgba(99,102,241,.6)'}
                onBlur={e  => e.target.style.borderColor='rgba(255,255,255,.1)'} />

              <button
                onClick={() => recording ? stopRecording() : startRecording()}
                disabled={loading || transcribing}
                title={recording ? 'Stop opname' : 'Spraakbericht opnemen'}
                style={{ width:34, height:34, flexShrink:0, background: recording ? 'rgba(248,81,73,.15)' : 'rgba(255,255,255,.05)', border:`1px solid ${recording?'rgba(248,81,73,.35)':'rgba(255,255,255,.1)'}`, color: recording ? '#f87171' : '#64748b', borderRadius:9, cursor: loading||transcribing ? 'default':'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}>
                {recording ? '⏹' : '🎤'}
              </button>

              <button onClick={() => send()} disabled={!canSend}
                style={{ width:36, height:36, flexShrink:0, background: canSend ? 'linear-gradient(135deg,#4338ca,#6366f1)' : '#1e2843', border:'none', color: canSend ? '#fff' : '#2d3a55', borderRadius:12, cursor: canSend ?'pointer':'default', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s' }}>
                ↑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB button — Ctrl+J also toggles; accepts task drops from MiniKanban */}
      <button
        onClick={() => setOpen(o=>!o)}
        title={taskDragging ? `Sleep "${taskDragging.name}" naar AI` : 'Horizon AI (Ctrl+J)'}
        onDragOver={e => { if (taskDragging) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
        onDrop={e => {
          if (!taskDragging) return
          e.preventDefault()
          setOpen(true)
          setInput(`Wat moet ik doen met de taak "${taskDragging.name}"?`)
          setTaskDragging(null)
          setTimeout(() => inputRef.current?.focus(), 120)
        }}
        style={{
          pointerEvents:'all',
          width:58, height:58, borderRadius:'50%',
          background: taskDragging ? 'linear-gradient(135deg,#059669,#10b981)' : open ? '#13192b' : 'linear-gradient(135deg,#4338ca,#6366f1)',
          border: taskDragging ? '2px solid #34d399' : `2px solid ${open?'rgba(99,102,241,.45)':'transparent'}`,
          color:'#fff', fontSize: open ? 20 : taskDragging ? 22 : 13,
          fontWeight:800, letterSpacing:-.5,
          cursor:'pointer',
          boxShadow: taskDragging ? '0 0 0 6px rgba(16,185,129,.25), 0 8px 32px rgba(16,185,129,.4)' : open ? '0 4px 20px rgba(0,0,0,.4)' : '0 8px 32px rgba(67,56,202,.55)',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all .25s cubic-bezier(.34,1.56,.64,1)',
        }}>
        {open ? '✕' : taskDragging ? '💬' : 'AI'}
      </button>
    </div>
  )
}

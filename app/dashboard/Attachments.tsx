'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { AttachmentEntityType, Attachment } from '@/lib/types'

const BUCKET = 'attachments'
const MAX_BYTES = 15 * 1024 * 1024

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

export function Attachments({ entityType, entityId }: { entityType: AttachmentEntityType; entityId: string }) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Attachment[]>([])
  const [urls, setUrls] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setRows([]); setLoading(false); return }
      const { data } = await supabase.from('attachments').select('*')
        .eq('user_id', user.id).eq('entity_type', entityType).eq('entity_id', entityId)
        .order('created_at', { ascending: false })
      const list = (data ?? []) as Attachment[]
      setRows(list)
      const images = list.filter(r => isImage(r.mime_type))
      if (images.length > 0) {
        const { data: signed } = await supabase.storage.from(BUCKET)
          .createSignedUrls(images.map(r => r.storage_path), 3600)
        const map: Record<number, string> = {}
        signed?.forEach((s, i) => { if (s?.signedUrl) map[images[i].id] = s.signedUrl })
        setUrls(map)
      }
    } catch {
      setError('Kon bijlagen niet laden')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Niet ingelogd'); return }
      setUploading(true)
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) { setError(`"${file.name}" is groter dan 15MB — niet geüpload.`); continue }
        const path = `${user.id}/${entityType}/${entityId}/${Date.now()}-${file.name}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file)
        if (upErr) { setError(`Uploaden van "${file.name}" mislukt: ${upErr.message}`); continue }
        await supabase.from('attachments').insert({
          user_id: user.id, entity_type: entityType, entity_id: entityId,
          file_name: file.name, storage_path: path, mime_type: file.type || null, size_bytes: file.size,
        })
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      load()
    }
  }

  async function remove(row: Attachment) {
    setRows(prev => prev.filter(r => r.id !== row.id))
    await supabase.storage.from(BUCKET).remove([row.storage_path])
    await supabase.from('attachments').delete().eq('id', row.id)
  }

  async function openFile(row: Attachment) {
    const cached = urls[row.id]
    if (cached) { window.open(cached, '_blank'); return }
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div>
      <input ref={fileInputRef} type="file" multiple aria-label="Bestand kiezen"
        accept="image/*,application/pdf,.doc,.docx" onChange={e => handleFiles(e.target.files)} style={{ display:'none' }} />
      <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
        style={{ fontSize:11, fontWeight:600, padding:'6px 14px', borderRadius:6, border:'1px solid rgba(244,114,182,.35)',
          background: uploading ? 'rgba(255,255,255,.04)' : 'rgba(244,114,182,.1)', color: uploading ? '#64748b' : '#f472b6',
          cursor: uploading ? 'default' : 'pointer' }}>
        {uploading ? 'Bezig met uploaden…' : '📎 Bestand toevoegen'}
      </button>
      {error && <div style={{ fontSize:11, color:'#f87171', marginTop:8 }}>{error}</div>}

      {!loading && rows.length === 0 && !error && (
        <div style={{ fontSize:12, color:'#64748b', fontStyle:'italic', marginTop:10 }}>Nog geen bijlagen.</div>
      )}

      {rows.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginTop:12 }}>
          {rows.map(row => {
            const img = isImage(row.mime_type) && urls[row.id]
            return (
              <div key={row.id} style={{ position:'relative', width:84 }}>
                {img ? (
                  <img src={urls[row.id]} alt={row.file_name} onClick={() => openFile(row)} title={row.file_name}
                    style={{ width:84, height:84, borderRadius:8, objectFit:'cover', cursor:'pointer', border:'1px solid rgba(244,114,182,.25)', display:'block' }} />
                ) : (
                  <div onClick={() => openFile(row)} title={row.file_name}
                    style={{ width:84, height:84, borderRadius:8, cursor:'pointer', background:'rgba(244,114,182,.08)', border:'1px solid rgba(244,114,182,.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:24 }}>{row.mime_type === 'application/pdf' ? '📄' : isImage(row.mime_type) ? '🖼' : '📎'}</span>
                  </div>
                )}
                <div style={{ fontSize:9, color:'#64748b', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={row.file_name}>
                  {row.file_name}
                </div>
                {row.size_bytes != null && <div style={{ fontSize:8, color:'#475569' }}>{fmtSize(row.size_bytes)}</div>}
                <button onClick={() => remove(row)} title="Verwijderen" aria-label={`${row.file_name} verwijderen`}
                  style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'#1c2128', border:'1px solid rgba(248,81,73,.4)', color:'#f87171', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, padding:0 }}>
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

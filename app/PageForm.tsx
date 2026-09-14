// ─── Gedeelde bouwstenen voor eenvoudige formulier-pagina's ───────────────────
// Zoals /settings en /finance: een kolom met kaarten (Section), elk met
// gelabelde velden (Field) of alleen-lezen rijen (Row). Eerst gebouwd voor
// Instellingen, hier gedeeld zodat nieuwe pagina's van dezelfde stijl niet
// per pagina een eigen kopie hoeven te maken.
export const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--text)', outline: 'none',
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</label>
        {hint && <span style={{ fontSize: 10, color: 'var(--dim)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>{title}</h2>
      {children}
    </div>
  )
}

export function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  )
}

export function Row({ label, value }: { label: string, value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

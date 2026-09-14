'use client'
import type { WeekItem, Achievement } from '@/lib/types'

// ─── ProductivityHeatmap — GitHub-stijl jaaroverzicht van afgeronde taken ─────

export const HEAT = ['#151b23','#0e4429','#006d32','#26a641','#39d353']
const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
const DAY_LABELS = ['Ma','Di','Wo','Do','Vr','Za','Zo']
const CELL = 13, GAP = 2

export function heatColor(n: number) {
  if (n === 0) return HEAT[0]
  if (n <= 1)  return HEAT[1]
  if (n <= 3)  return HEAT[2]
  if (n <= 5)  return HEAT[3]
  return HEAT[4]
}

export function ProductivityHeatmap({ weekItems, achievements }: { weekItems: WeekItem[]; achievements: Achievement[] }) {
  const doneCounts = new Map<string, number>()
  const achDates   = new Set<string>()
  for (const w of weekItems) if (w.done) doneCounts.set(w.date, (doneCounts.get(w.date) ?? 0) + 1)
  for (const a of achievements) achDates.add(a.date)

  const now = new Date(); now.setHours(12, 0, 0, 0)
  const todayStr = now.toISOString().slice(0, 10)

  // Grid start op maandag, 52 weken terug
  const start = new Date(now)
  start.setDate(start.getDate() - 363)
  const dow = start.getDay()
  start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))

  // Kolom-per-week grid (ma–zo per kolom)
  const weeks: (string | null)[][] = []
  const cur = new Date(start)
  while (weeks.length < 54) {
    const col: (string | null)[] = []
    for (let r = 0; r < 7; r++) {
      const ds = cur.toISOString().slice(0, 10)
      col.push(ds <= todayStr ? ds : null)
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(col)
    if (col.every(c => c === null)) break
  }

  // Maandlabels: eerste kolom waar de maand wisselt
  const monthLabels: { col: number; label: string }[] = []
  let lastMon = -1
  for (let col = 0; col < weeks.length; col++) {
    const first = weeks[col].find(d => d !== null)
    if (first) {
      const m = new Date(first + 'T12:00:00').getMonth()
      if (m !== lastMon) { monthLabels.push({ col, label: MONTHS_NL[m] }); lastMon = m }
    }
  }

  const totalDone = weekItems.filter(w => w.done).length
  const activeDays = doneCounts.size
  const best = doneCounts.size ? Math.max(...doneCounts.values()) : 0

  return (
    <div style={{ padding: '20px 24px', overflowX: 'auto', minHeight: '100%' }}>
      <div role="region" aria-label="Productiviteitsstatistieken" style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Taken gedaan', value: totalDone, color: '#39d353' },
          { label: 'Actieve dagen', value: activeDays, color: '#818cf8' },
          { label: 'Prestaties', value: achievements.length, color: '#fbbf24' },
          { label: 'Beste dag', value: best, color: '#f472b6' },
        ].map(s => (
          <div key={s.label} role="article" style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3, letterSpacing: '.3px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* Daglabels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, paddingTop: 18, flexShrink: 0 }}>
          {DAY_LABELS.map((d, i) => (
            i % 2 === 1
              ? <div key={d} style={{ width: 18, height: CELL, fontSize: 9, color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{d}</div>
              : <div key={d} style={{ width: 18, height: CELL }} />
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Maandlabels */}
          <div style={{ position: 'relative', height: 16, marginBottom: 2 }}>
            {monthLabels.map(({ col, label }) => (
              <div key={`${col}-${label}`} style={{ position: 'absolute', left: col * (CELL + GAP), fontSize: 9, color: 'var(--dim)', fontWeight: 600, lineHeight: 1 }}>
                {label}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: 'flex', gap: GAP }}>
            {weeks.map((week, col) => (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                {week.map((dateStr, row) => {
                  if (!dateStr) return <div key={row} style={{ width: CELL, height: CELL }} />
                  const count = doneCounts.get(dateStr) ?? 0
                  const hasAch = achDates.has(dateStr)
                  const isToday = dateStr === todayStr
                  return (
                    <div key={row}
                      title={`${dateStr}${count ? `: ${count} taken` : ''}${hasAch ? ' 🏆' : ''}`}
                      style={{
                        width: CELL, height: CELL, borderRadius: 2, boxSizing: 'border-box',
                        background: heatColor(count),
                        border: isToday ? '1px solid #818cf8' : hasAch ? '1px solid rgba(251,191,36,.6)' : '1px solid rgba(255,255,255,.04)',
                        position: 'relative',
                      }}
                    >
                      {hasAch && (
                        <div style={{ position: 'absolute', bottom: 2, right: 2, width: 3, height: 3, borderRadius: '50%', background: '#fbbf24' }} />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, marginLeft: 28 }}>
        <span style={{ fontSize: 10, color: 'var(--dim)', marginRight: 2 }}>Minder</span>
        {HEAT.map((c, i) => (
          <div key={i} style={{ width: CELL, height: CELL, borderRadius: 2, background: c, border: '1px solid rgba(255,255,255,.04)' }} />
        ))}
        <span style={{ fontSize: 10, color: 'var(--dim)', marginLeft: 2 }}>Meer</span>
        <span style={{ fontSize: 10, color: 'var(--dim)', marginLeft: 12 }}>· 🏆 = prestatie · blauw = vandaag</span>
      </div>
    </div>
  )
}

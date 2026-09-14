'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Task } from '@/lib/types'

const DEFAULT_MIN = 25

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// SVG circle circumference for the progress ring
const R   = 28
const C   = 2 * Math.PI * R  // ~175.9

// ─── FocusTimer ───────────────────────────────────────────────────────────────

export function FocusTimer({ task, onStop, onElapsed }: {
  task:      Task
  onStop:    () => void
  onElapsed?: (minutes: number) => void
}) {
  const totalSec  = (task.duration_min ?? DEFAULT_MIN) * 60
  const [left,    setLeft]    = useState(totalSec)
  const [running, setRunning] = useState(true)
  const [done,    setDone]    = useState(false)
  const [rounds,  setRounds]  = useState(0)   // volledig afgeronde pomodoro's (via ↻ Opnieuw)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    setRunning(false)
  }, [])

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setLeft(prev => {
        if (prev <= 1) {
          stop()
          setDone(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, stop])

  function togglePause() {
    if (done) return
    if (running) stop()
    else setRunning(true)
  }

  function reset() {
    stop()
    setRounds(r => r + 1)
    setLeft(totalSec)
    setDone(false)
    setRunning(true)
  }

  function close() {
    const elapsedSec = rounds * totalSec + (totalSec - left)
    const minutes = Math.round(elapsedSec / 60)
    if (minutes >= 1) onElapsed?.(minutes)
    onStop()
  }

  const progress  = left / totalSec            // 1 → 0
  const dashOffset = C * (1 - progress)         // grows as time passes

  const ringColor = done ? '#3fb950' : running ? '#6366f1' : '#f59e0b'

  return (
    <div
      aria-label="Focus timer"
      role="timer"
      style={{
        position: 'fixed', bottom: 80, right: 20, zIndex: 9500,
        background: '#0d1117', border: `1px solid ${ringColor}60`,
        borderRadius: 16, boxShadow: `0 8px 32px rgba(0,0,0,.7), 0 0 0 1px ${ringColor}20`,
        padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
        minWidth: 260, userSelect: 'none',
        animation: 'bubbleIn .25s ease',
      }}
    >
      {/* Progress ring */}
      <svg width={68} height={68} viewBox="0 0 68 68" style={{ flexShrink: 0 }}>
        <circle cx={34} cy={34} r={R} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={5} />
        <circle
          cx={34} cy={34} r={R}
          fill="none"
          stroke={ringColor}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 34 34)"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke .3s' }}
        />
        <text x={34} y={38} textAnchor="middle" fill={ringColor} fontSize={13} fontWeight={700} fontFamily="monospace">
          {done ? '🍅' : fmtTime(left)}
        </text>
      </svg>

      {/* Task + controls */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: ringColor, marginBottom: 3 }}>
          {done ? 'Klaar!' : running ? 'Focus bezig' : 'Gepauzeerd'}
        </div>
        <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
          {task.name}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!done && (
            <button
              onClick={togglePause}
              aria-label={running ? 'Pauzeren' : 'Hervatten'}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: `1px solid ${ringColor}50`, background: `${ringColor}12`, color: ringColor, cursor: 'pointer', fontWeight: 600 }}>
              {running ? '⏸ Pauze' : '▶ Start'}
            </button>
          )}
          {done && (
            <button onClick={reset} aria-label="Opnieuw"
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(99,102,241,.4)', background: 'rgba(99,102,241,.12)', color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}>
              ↻ Opnieuw
            </button>
          )}
          <button onClick={close} aria-label="Sluiten"
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: '#64748b', cursor: 'pointer' }}>
            Sluiten
          </button>
        </div>
      </div>
    </div>
  )
}

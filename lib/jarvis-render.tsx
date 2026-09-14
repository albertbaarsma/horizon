import type { Task } from './types'

/**
 * Splits een assistant-antwoord in zichtbare tekst + vervolgsuggesties.
 * De AI sluit af met een regel `SUGGESTIES: ["...","..."]` — die strippen we
 * uit de weergave en tonen we als klikbare chips.
 */
export function extractSuggestions(content: string): { text: string; suggestions: string[] } {
  const m = content.match(/(?:^|\n)SUGGESTIES:\s*(\[[\s\S]*?\])\s*$/)
  if (!m) return { text: content, suggestions: [] }
  const text = content.slice(0, m.index).trimEnd()
  try {
    const arr = JSON.parse(m[1]) as unknown
    if (Array.isArray(arr)) {
      const suggestions = arr.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 3)
      return { text, suggestions }
    }
  } catch { /* kapotte JSON → alleen strippen */ }
  return { text, suggestions: [] }
}

/**
 * Verbergt een (eventueel nog half gestreamde) SUGGESTIES-regel in de weergave.
 */
export function stripSuggestionsLine(content: string): string {
  return content.replace(/(?:^|\n)SUGGESTIES:[\s\S]*$/, '').trimEnd()
}

/**
 * Parses Jarvis assistant content and makes [ID] task references clickable.
 * Pattern: [23] anywhere in text → purple clickable button that opens TaskModal.
 */
export function renderJarvisContent(
  content: string,
  tasks: Task[],
  onTaskClick: (t: Task) => void
): React.ReactNode[] {
  const parts = content.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/)
    if (m) {
      const taskId = parseInt(m[1])
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        return (
          <button
            key={i}
            onClick={() => onTaskClick(task)}
            title={`Taak: ${task.name}`}
            style={{
              display: 'inline',
              background: 'rgba(99,102,241,.18)',
              border: '1px solid rgba(99,102,241,.4)',
              color: '#a5b4fc',
              borderRadius: 5,
              padding: '0 5px',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: 'inherit',
              lineHeight: 1.4,
            }}
          >
            [{m[1]}]
          </button>
        )
      }
    }
    return <span key={i}>{part}</span>
  })
}

/**
 * Pure logic: extract all task IDs mentioned in a Jarvis response string.
 * Used in tests without needing React/DOM.
 */
export function extractTaskIds(content: string): number[] {
  const matches = [...content.matchAll(/\[(\d+)\]/g)]
  return matches.map(m => parseInt(m[1]))
}

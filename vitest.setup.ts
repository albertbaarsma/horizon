import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom implementeert het Clipboard API niet. CopyPromptButton (en alles wat
// erop leunt) heeft navigator.clipboard.writeText nodig — één keer hier
// stubben zodat elke test hem kan gebruiken en erop kan controleren.
if (typeof navigator !== 'undefined' && !navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    configurable: true,
  })
}

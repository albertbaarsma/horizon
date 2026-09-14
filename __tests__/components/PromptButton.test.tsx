import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CopyPromptButton } from '@/app/dashboard/PromptButton'

beforeEach(() => { vi.clearAllMocks() })

describe('CopyPromptButton', () => {
  it('kopieert de gegeven tekst naar het klembord', async () => {
    render(<CopyPromptButton text="hallo prompt" />)
    fireEvent.click(screen.getByText('📋 Copy prompt'))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hallo prompt'))
  })

  it('toont een bevestiging die na verloop van tijd weer weggaat', async () => {
    vi.useFakeTimers()
    try {
      render(<CopyPromptButton text="hallo" />)
      fireEvent.click(screen.getByText('📋 Copy prompt'))
      await vi.waitFor(() => expect(screen.getByText('✓ Gekopieerd')).toBeTruthy())
      await vi.advanceTimersByTimeAsync(2100)
      expect(screen.getByText('📋 Copy prompt')).toBeTruthy()
    } finally { vi.useRealTimers() }
  })

  it('gebruikt een eigen label als dat is meegegeven', () => {
    render(<CopyPromptButton text="x" label="Copy prompt (3)" />)
    expect(screen.getByText('📋 Copy prompt (3)')).toBeTruthy()
  })

  it('gaat stilletjes verder als er geen klembordtoegang is', async () => {
    const orig = navigator.clipboard.writeText
    navigator.clipboard.writeText = () => Promise.reject(new Error('geen toestemming'))
    render(<CopyPromptButton text="x" />)
    fireEvent.click(screen.getByText('📋 Copy prompt'))
    // geen crash, geen onafgehandelde promise-afwijzing
    await new Promise(r => setTimeout(r, 10))
    expect(screen.getByText('📋 Copy prompt')).toBeTruthy()
    navigator.clipboard.writeText = orig
  })
})

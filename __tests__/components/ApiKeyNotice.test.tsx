import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApiKeyNotice } from '@/app/ApiKeyNotice'

describe('ApiKeyNotice', () => {
  it('renders a helpful notice with a setup-guide link for an API-key error', () => {
    render(<ApiKeyNotice error="Geen API key geconfigureerd" lang="nl" />)
    expect(screen.getByText('Geen API key geconfigureerd')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /instelgids/i })
    expect(link).toHaveAttribute('href', '/ai-setup?pad=model')
  })

  it('renders the English copy for lang="en"', () => {
    render(<ApiKeyNotice error="No API key configured" lang="en" />)
    expect(screen.getByText('No API key configured')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /setup guide/i })).toBeInTheDocument()
  })

  it('matches case-insensitively and on the longer Anthropic-specific message', () => {
    render(<ApiKeyNotice error="Geen Anthropic API key geconfigureerd. Ga naar Instellingen → AI om een key in te voeren." lang="nl" />)
    expect(screen.getByRole('link', { name: /instelgids/i })).toBeInTheDocument()
  })

  it('falls back to a plain error line for a non-API-key error', () => {
    render(<ApiKeyNotice error="Kon het rapport niet genereren" lang="nl" />)
    expect(screen.getByText('Kon het rapport niet genereren')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

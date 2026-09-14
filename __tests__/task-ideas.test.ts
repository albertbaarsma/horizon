import { describe, it, expect } from 'vitest'
import { taskWantsIdeas } from '@/lib/task-ideas'

describe('taskWantsIdeas — welke taken krijgen een ✨', () => {
  it('herkent open/brainstorm-taken', () => {
    expect(taskWantsIdeas('🎪 Activiteit/uitje verzinnen voor Mika & zonen')).toBe(true)
    expect(taskWantsIdeas('Mamma cadeau regelen (30 juni!)')).toBe(true)
    expect(taskWantsIdeas('Verblijf regelen (Barbara/BeWelcome)')).toBe(true)
    expect(taskWantsIdeas('Weekend bedenken voor de kids')).toBe(true)
    expect(taskWantsIdeas('Ideeën voor de tuin')).toBe(true)
    expect(taskWantsIdeas('Feestje organiseren')).toBe(true)
    expect(taskWantsIdeas('Kies een cadeau')).toBe(true)
  })

  it('laat concrete klusjes met rust (geen ✨)', () => {
    expect(taskWantsIdeas('🔨 Plankjes ophangen')).toBe(false)
    expect(taskWantsIdeas('🧺 Was doen')).toBe(false)
    expect(taskWantsIdeas('🛒 Boodschappen doen')).toBe(false)
    expect(taskWantsIdeas('🌾 Gras maaien achter')).toBe(false)
    expect(taskWantsIdeas('Website vertalen naar Engels')).toBe(false)
    expect(taskWantsIdeas('Kinderen ophalen uit school')).toBe(false)
  })

  it('trapt niet in deelwoorden zoals "Plankjes" (plan) of "inplannen"', () => {
    expect(taskWantsIdeas('Plankjes ophangen')).toBe(false)
    expect(taskWantsIdeas('Opnames inplannen')).toBe(false)
  })

  it('gaat veilig om met lege invoer', () => {
    expect(taskWantsIdeas('')).toBe(false)
    expect(taskWantsIdeas(null)).toBe(false)
    expect(taskWantsIdeas(undefined)).toBe(false)
  })
})

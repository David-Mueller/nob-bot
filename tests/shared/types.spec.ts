import { describe, it, expect } from 'vitest'
import type { Activity } from '@shared/types'

describe('Activity type', () => {
  it('should have correct structure', () => {
    const activity: Activity = {
      beschreibung: 'Test description',
      auftraggeber: 'Test Client',
      thema: 'Test Theme',
      datum: '2026-01-15',
      minuten: 60,
      km: null,
      auslagen: null
    }

    expect(activity.beschreibung).toBe('Test description')
    expect(activity.auftraggeber).toBe('Test Client')
    expect(activity.thema).toBe('Test Theme')
    expect(activity.datum).toBe('2026-01-15')
    expect(activity.minuten).toBe(60)
    expect(activity.km).toBeNull()
    expect(activity.auslagen).toBeNull()
  })

  it('should allow null for optional fields', () => {
    const activity: Activity = {
      beschreibung: 'Minimal activity',
      auftraggeber: null,
      thema: null,
      datum: '2026-01-15',
      minuten: null,
      km: null,
      auslagen: null
    }

    expect(activity.auftraggeber).toBeNull()
    expect(activity.thema).toBeNull()
    expect(activity.minuten).toBeNull()
  })
})

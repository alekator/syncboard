import { describe, expect, it } from 'vitest'

import { nextRealtimeSequence, shouldApplyRealtimeSequence } from './sequence-gate'

describe('realtime sequence gate', () => {
  it('rejects duplicate and stale sequence values', () => {
    expect(shouldApplyRealtimeSequence(5, 5)).toBe(false)
    expect(shouldApplyRealtimeSequence(5, 4)).toBe(false)
  })

  it('accepts strictly newer sequence values', () => {
    expect(shouldApplyRealtimeSequence(5, 6)).toBe(true)
  })

  it('tracks latest known sequence safely', () => {
    expect(nextRealtimeSequence(5, 4)).toBe(5)
    expect(nextRealtimeSequence(5, 6)).toBe(6)
  })
})

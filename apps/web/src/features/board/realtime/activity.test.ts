import { describe, expect, it } from 'vitest'
import type { RealtimeEventEnvelope } from '@syncboard/shared'

import { applyActivityEvent } from './activity'

function activityEnvelope(userId: string, dragging: boolean): RealtimeEventEnvelope {
  return {
    boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sequence: 1,
    version: 1,
    timestamp: '2026-03-05T00:00:00.000Z',
    event: {
      type: 'activity.update',
      payload: {
        boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId,
        dragging,
      },
    },
  }
}

function offlineEnvelope(userId: string): RealtimeEventEnvelope {
  return {
    boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sequence: 2,
    version: 2,
    timestamp: '2026-03-05T00:00:01.000Z',
    event: {
      type: 'presence.update',
      payload: {
        boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId,
        online: false,
      },
    },
  }
}

describe('applyActivityEvent', () => {
  it('sets dragging state for user', () => {
    const next = applyActivityEvent({}, activityEnvelope('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true))
    expect(next['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']).toBe(true)
  })

  it('removes dragging state when user goes offline', () => {
    const next = applyActivityEvent(
      { 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': true },
      offlineEnvelope('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    )
    expect(next['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import type { RealtimeEventEnvelope } from '@syncboard/shared'

import { applyPresenceEvent } from './presence'

function presenceEnvelope(userId: string, online: boolean): RealtimeEventEnvelope {
  return {
    boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sequence: 1,
    version: 1,
    timestamp: '2026-03-05T00:00:00.000Z',
    event: {
      type: 'presence.update',
      payload: {
        boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId,
        online,
      },
    },
  }
}

describe('applyPresenceEvent', () => {
  it('adds user for online event', () => {
    const next = applyPresenceEvent([], presenceEnvelope('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true))
    expect(next).toEqual(['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'])
  })

  it('removes user for offline event', () => {
    const next = applyPresenceEvent(
      ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      presenceEnvelope('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false),
    )
    expect(next).toEqual([])
  })
})

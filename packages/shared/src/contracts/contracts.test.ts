import { describe, expect, it } from 'vitest'

import {
  boardSnapshotSchema,
  createBoardBodySchema,
  realtimeEventEnvelopeSchema,
} from '../index.js'

describe('shared board contracts', () => {
  it('validates board creation payload', () => {
    const parsed = createBoardBodySchema.safeParse({ name: 'Engineering Board' })

    expect(parsed.success).toBe(true)
  })

  it('validates board snapshot payload shape', () => {
    const parsed = boardSnapshotSchema.safeParse({
      board: {
        id: '0a4d53f6-5317-4d8e-8f7f-58d4c5a15412',
        name: 'Roadmap',
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
      },
      columns: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          boardId: '0a4d53f6-5317-4d8e-8f7f-58d4c5a15412',
          title: 'Backlog',
          position: 1000,
          createdAt: '2026-03-05T00:00:00.000Z',
          updatedAt: '2026-03-05T00:00:00.000Z',
          cards: [],
        },
      ],
    })

    expect(parsed.success).toBe(true)
  })
})

describe('shared realtime contracts', () => {
  it('validates typed realtime envelope', () => {
    const parsed = realtimeEventEnvelopeSchema.safeParse({
      boardId: '0a4d53f6-5317-4d8e-8f7f-58d4c5a15412',
      entityId: '22222222-2222-4222-8222-222222222222',
      version: 1,
      sequence: 42,
      timestamp: '2026-03-05T00:00:00.000Z',
      event: {
        type: 'card.moved',
        payload: {
          id: '22222222-2222-4222-8222-222222222222',
          boardId: '0a4d53f6-5317-4d8e-8f7f-58d4c5a15412',
          columnId: '33333333-3333-4333-8333-333333333333',
          position: 1500,
          updatedAt: '2026-03-05T00:00:00.000Z',
        },
      },
    })

    expect(parsed.success).toBe(true)
  })

  it('validates activity update realtime envelope', () => {
    const parsed = realtimeEventEnvelopeSchema.safeParse({
      boardId: '0a4d53f6-5317-4d8e-8f7f-58d4c5a15412',
      entityId: '22222222-2222-4222-8222-222222222222',
      version: 1,
      sequence: 43,
      timestamp: '2026-03-05T00:00:01.000Z',
      event: {
        type: 'activity.update',
        payload: {
          userId: '22222222-2222-4222-8222-222222222222',
          boardId: '0a4d53f6-5317-4d8e-8f7f-58d4c5a15412',
          dragging: true,
        },
      },
    })

    expect(parsed.success).toBe(true)
  })
})

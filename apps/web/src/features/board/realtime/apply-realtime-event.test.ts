import { describe, expect, it } from 'vitest'
import type { BoardSnapshot, RealtimeEventEnvelope } from '@syncboard/shared'

import { applyRealtimeEventToSnapshot } from './apply-realtime-event'

function baseSnapshot(): BoardSnapshot {
  return {
    board: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Realtime',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
    },
    columns: [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Todo',
        position: 1000,
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
        cards: [
          {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            columnId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            title: 'Initial card',
            description: '',
            position: 1000,
            createdAt: '2026-03-05T00:00:00.000Z',
            updatedAt: '2026-03-05T00:00:00.000Z',
          },
        ],
      },
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Doing',
        position: 2000,
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
        cards: [],
      },
    ],
  }
}

function envelope(event: RealtimeEventEnvelope['event']): RealtimeEventEnvelope {
  return {
    boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sequence: 1,
    version: 1,
    timestamp: '2026-03-05T00:00:00.000Z',
    event,
  }
}

describe('applyRealtimeEventToSnapshot', () => {
  it('updates and reorders column on column.updated event', () => {
    const next = applyRealtimeEventToSnapshot(
      baseSnapshot(),
      envelope({
        type: 'column.updated',
        payload: {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          title: 'In progress',
          position: 500,
          createdAt: '2026-03-05T00:00:00.000Z',
          updatedAt: '2026-03-05T00:02:00.000Z',
        },
      }),
    )

    expect(next.columns[0].id).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd')
    expect(next.columns[0].title).toBe('In progress')
  })

  it('adds card on card.created event', () => {
    const next = applyRealtimeEventToSnapshot(
      baseSnapshot(),
      envelope({
        type: 'card.created',
        payload: {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          columnId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          title: 'New card',
          description: '',
          position: 2000,
          createdAt: '2026-03-05T00:00:00.000Z',
          updatedAt: '2026-03-05T00:00:00.000Z',
        },
      }),
    )

    expect(next.columns[0].cards).toHaveLength(2)
    expect(next.columns[0].cards[1].title).toBe('New card')
  })

  it('updates card content on card.updated event', () => {
    const next = applyRealtimeEventToSnapshot(
      baseSnapshot(),
      envelope({
        type: 'card.updated',
        payload: {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          columnId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          title: 'Updated card',
          description: 'Updated description',
          position: 1000,
          createdAt: '2026-03-05T00:00:00.000Z',
          updatedAt: '2026-03-05T00:03:00.000Z',
        },
      }),
    )

    expect(next.columns[0].cards[0].title).toBe('Updated card')
    expect(next.columns[0].cards[0].description).toBe('Updated description')
  })

  it('moves card on card.moved event', () => {
    const next = applyRealtimeEventToSnapshot(
      baseSnapshot(),
      envelope({
        type: 'card.moved',
        payload: {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          columnId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          position: 1000,
          updatedAt: '2026-03-05T00:01:00.000Z',
        },
      }),
    )

    expect(next.columns[0].cards).toHaveLength(0)
    expect(next.columns[1].cards).toHaveLength(1)
    expect(next.columns[1].cards[0].id).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  })

  it('removes card on card.deleted event', () => {
    const next = applyRealtimeEventToSnapshot(
      baseSnapshot(),
      envelope({
        type: 'card.deleted',
        payload: {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
      }),
    )

    expect(next.columns[0].cards).toHaveLength(0)
  })
})

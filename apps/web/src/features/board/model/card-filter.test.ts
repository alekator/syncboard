import { describe, expect, it } from 'vitest'
import type { BoardSnapshot } from '@syncboard/shared'

import { filterSnapshotCards } from './card-filter'

function createSnapshot(): BoardSnapshot {
  return {
    board: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Board',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
    },
    columns: [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Backlog',
        position: 1000,
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
        cards: [
          {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            columnId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            title: 'Auth flow',
            description: 'Implement login',
            position: 1000,
            createdAt: '2026-03-05T00:00:00.000Z',
            updatedAt: '2026-03-05T00:00:00.000Z',
          },
          {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            columnId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            title: 'Realtime sync',
            description: 'WebSocket updates',
            position: 2000,
            createdAt: '2026-03-05T00:00:00.000Z',
            updatedAt: '2026-03-05T00:00:00.000Z',
          },
        ],
      },
    ],
  }
}

describe('filterSnapshotCards', () => {
  it('returns all cards when query is empty', () => {
    const snapshot = createSnapshot()
    const filtered = filterSnapshotCards(snapshot, '')

    expect(filtered[0].cards).toHaveLength(2)
  })

  it('filters cards by title and description case-insensitively', () => {
    const snapshot = createSnapshot()
    const byTitle = filterSnapshotCards(snapshot, 'realTIME')
    const byDescription = filterSnapshotCards(snapshot, 'LOGIN')

    expect(byTitle[0].cards).toHaveLength(1)
    expect(byTitle[0].cards[0].title).toBe('Realtime sync')
    expect(byDescription[0].cards).toHaveLength(1)
    expect(byDescription[0].cards[0].title).toBe('Auth flow')
  })
})

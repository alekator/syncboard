import { describe, expect, it } from 'vitest'
import type { BoardSnapshot } from '@syncboard/shared'

import { moveCardOptimistic } from './card-dnd'

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
        title: 'Todo',
        position: 1000,
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
        cards: [
          {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            columnId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            title: 'Card A',
            description: '',
            position: 1000,
            createdAt: '2026-03-05T00:00:00.000Z',
            updatedAt: '2026-03-05T00:00:00.000Z',
          },
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            columnId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            title: 'Card B',
            description: '',
            position: 2000,
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

describe('moveCardOptimistic', () => {
  it('moves card between columns', () => {
    const result = moveCardOptimistic(createSnapshot(), {
      cardId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      toColumnId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })

    expect(result).not.toBeNull()
    expect(result?.snapshot.columns[0].cards).toHaveLength(1)
    expect(result?.snapshot.columns[1].cards).toHaveLength(1)
    expect(result?.movedCard.columnId).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd')
  })

  it('inserts card before over target', () => {
    const snapshot = createSnapshot()
    snapshot.columns[1].cards = [
      {
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        columnId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        title: 'Card C',
        description: '',
        position: 3000,
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
      },
    ]

    const result = moveCardOptimistic(snapshot, {
      cardId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      toColumnId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      overCardId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    })

    expect(result).not.toBeNull()
    expect((result?.movedCard.position ?? 0) < 3000).toBe(true)
  })
})

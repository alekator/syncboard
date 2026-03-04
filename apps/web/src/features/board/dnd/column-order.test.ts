import { describe, expect, it } from 'vitest'
import type { BoardSnapshot } from '@syncboard/shared'

import { reorderColumnOptimistic } from './column-order'

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
        cards: [],
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Doing',
        position: 2000,
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
        cards: [],
      },
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        boardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Done',
        position: 3000,
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
        cards: [],
      },
    ],
  }
}

describe('reorderColumnOptimistic', () => {
  it('moves column to the left', () => {
    const result = reorderColumnOptimistic(createSnapshot(), {
      columnId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      toIndex: 0,
    })

    expect(result).not.toBeNull()
    expect(result?.snapshot.columns[0]?.id).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  })

  it('moves column to the right', () => {
    const result = reorderColumnOptimistic(createSnapshot(), {
      columnId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      toIndex: 2,
    })

    expect(result).not.toBeNull()
    expect(result?.snapshot.columns[2]?.id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  })
})

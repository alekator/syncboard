import { describe, expect, it } from 'vitest'

import { InMemoryPresenceStore } from './presence-store.js'

describe('InMemoryPresenceStore', () => {
  it('tracks online users per board', async () => {
    const store = new InMemoryPresenceStore()

    await store.markOnline('board-1', 'user-a')
    await store.markOnline('board-1', 'user-b')
    await store.markOnline('board-2', 'user-c')

    expect(await store.listOnline('board-1')).toEqual(['user-a', 'user-b'])
    expect(await store.listOnline('board-2')).toEqual(['user-c'])
  })

  it('removes user from board presence', async () => {
    const store = new InMemoryPresenceStore()

    await store.markOnline('board-1', 'user-a')
    await store.markOffline('board-1', 'user-a')

    expect(await store.listOnline('board-1')).toEqual([])
  })
})

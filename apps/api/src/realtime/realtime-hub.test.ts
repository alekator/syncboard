import { describe, expect, it, vi } from 'vitest'

import { RealtimeHub } from './realtime-hub.js'
import { InMemoryRealtimeReplayStore } from './replay-store.js'

function createSocketMock() {
  return {
    readyState: 1,
    send: vi.fn<(payload: string) => void>(),
  }
}

describe('RealtimeHub replay store integration', () => {
  it('replays missed events after hub restart when using the same replay store', async () => {
    const boardId = '00000000-0000-4000-8000-000000000123'
    const userId = '00000000-0000-4000-8000-000000000124'
    const replayStore = new InMemoryRealtimeReplayStore()

    const firstHub = new RealtimeHub(undefined, replayStore)
    const firstClientSocket = createSocketMock()
    const firstClient = firstHub.registerClient(firstClientSocket as never, userId)
    await firstHub.joinBoard(firstClient, boardId)

    await firstHub.publishBoardEvent({
      boardId,
      event: {
        type: 'activity.update',
        payload: {
          boardId,
          userId,
          dragging: true,
        },
      },
    })

    const secondHub = new RealtimeHub(undefined, replayStore)
    const reconnectSocket = createSocketMock()
    const reconnectClient = secondHub.registerClient(reconnectSocket as never, userId)
    await secondHub.joinBoard(reconnectClient, boardId, 0)

    const sentMessages = reconnectSocket.send.mock.calls.map(([payload]) => JSON.parse(payload) as { event: { type: string } })
    const replayedTypes = sentMessages.map((message) => message.event.type)

    expect(replayedTypes).toContain('activity.update')
    expect(replayedTypes).toContain('presence.update')
  })
})

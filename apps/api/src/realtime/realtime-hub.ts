import type WebSocket from 'ws'
import type { RealtimeEventEnvelope } from '@syncboard/shared'
import { InMemoryPresenceStore, type PresenceStore } from './presence-store.js'
import { InMemoryRealtimeReplayStore, type RealtimeReplayStore } from './replay-store.js'

type RealtimeClient = {
  socket: WebSocket
  userId: string
  boardIds: Set<string>
}

export class RealtimeHub {
  private readonly boardClients = new Map<string, Set<RealtimeClient>>()

  constructor(
    private readonly presenceStore: PresenceStore = new InMemoryPresenceStore(),
    private readonly replayStore: RealtimeReplayStore = new InMemoryRealtimeReplayStore(),
  ) {}

  registerClient(socket: WebSocket, userId: string) {
    return {
      socket,
      userId,
      boardIds: new Set<string>(),
    } satisfies RealtimeClient
  }

  async unregisterClient(client: RealtimeClient) {
    for (const boardId of client.boardIds) {
      await this.leaveBoard(client, boardId)
    }
  }

  async joinBoard(client: RealtimeClient, boardId: string, fromSequence?: number) {
    let clients = this.boardClients.get(boardId)
    if (!clients) {
      clients = new Set<RealtimeClient>()
      this.boardClients.set(boardId, clients)
    }

    clients.add(client)
    client.boardIds.add(boardId)
    await this.presenceStore.markOnline(boardId, client.userId)
    await this.replayMissedEvents(client, boardId, fromSequence)

    await this.publishBoardEvent({
      boardId,
      event: {
        type: 'presence.update',
        payload: {
          boardId,
          userId: client.userId,
          online: true,
        },
      },
    })
  }

  async leaveBoard(client: RealtimeClient, boardId: string) {
    const clients = this.boardClients.get(boardId)
    if (!clients || !clients.has(client)) {
      return
    }

    clients.delete(client)
    client.boardIds.delete(boardId)

    if (clients.size === 0) {
      this.boardClients.delete(boardId)
    }
    await this.presenceStore.markOffline(boardId, client.userId)

    await this.publishBoardEvent({
      boardId,
      event: {
        type: 'presence.update',
        payload: {
          boardId,
          userId: client.userId,
          online: false,
        },
      },
    })
  }

  async publishActivity(client: RealtimeClient, boardId: string, dragging: boolean) {
    const clients = this.boardClients.get(boardId)
    if (!clients || !clients.has(client)) {
      return
    }

    await this.publishBoardEvent({
      boardId,
      event: {
        type: 'activity.update',
        payload: {
          boardId,
          userId: client.userId,
          dragging,
        },
      },
    })
  }

  async publishBoardEvent(input: {
    boardId: string
    entityId?: string
    event: RealtimeEventEnvelope['event']
  }) {
    const envelope = await this.replayStore.append(input)
    this.broadcast(input.boardId, envelope)
  }

  private async replayMissedEvents(client: RealtimeClient, boardId: string, fromSequence?: number) {
    if (fromSequence === undefined) {
      return
    }

    const events = await this.replayStore.getSince(boardId, fromSequence)

    for (const envelope of events) {
      this.sendToClient(client, envelope)
    }
  }

  private sendToClient(client: RealtimeClient, envelope: RealtimeEventEnvelope) {
    if (client.socket.readyState !== 1) {
      return
    }

    client.socket.send(JSON.stringify(envelope))
  }

  private broadcast(boardId: string, envelope: RealtimeEventEnvelope) {
    const clients = this.boardClients.get(boardId)
    if (!clients || clients.size === 0) {
      return
    }

    for (const client of clients) {
      this.sendToClient(client, envelope)
    }
  }
}

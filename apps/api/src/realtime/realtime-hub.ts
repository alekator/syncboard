import type WebSocket from 'ws'
import { realtimeEventEnvelopeSchema, type RealtimeEventEnvelope } from '@syncboard/shared'
import { InMemoryPresenceStore, type PresenceStore } from './presence-store.js'

type RealtimeClient = {
  socket: WebSocket
  userId: string
  boardIds: Set<string>
}

export class RealtimeHub {
  private readonly boardClients = new Map<string, Set<RealtimeClient>>()
  private readonly sequenceByBoard = new Map<string, number>()
  private readonly versionByBoard = new Map<string, number>()

  constructor(private readonly presenceStore: PresenceStore = new InMemoryPresenceStore()) {}

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

  async joinBoard(client: RealtimeClient, boardId: string) {
    let clients = this.boardClients.get(boardId)
    if (!clients) {
      clients = new Set<RealtimeClient>()
      this.boardClients.set(boardId, clients)
    }

    clients.add(client)
    client.boardIds.add(boardId)
    await this.presenceStore.markOnline(boardId, client.userId)

    this.publishBoardEvent({
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

    this.publishBoardEvent({
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

  publishActivity(client: RealtimeClient, boardId: string, dragging: boolean) {
    const clients = this.boardClients.get(boardId)
    if (!clients || !clients.has(client)) {
      return
    }

    this.publishBoardEvent({
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

  publishBoardEvent(input: {
    boardId: string
    entityId?: string
    event: RealtimeEventEnvelope['event']
  }) {
    const sequence = (this.sequenceByBoard.get(input.boardId) ?? 0) + 1
    const version = (this.versionByBoard.get(input.boardId) ?? 0) + 1

    this.sequenceByBoard.set(input.boardId, sequence)
    this.versionByBoard.set(input.boardId, version)

    const envelope = realtimeEventEnvelopeSchema.parse({
      boardId: input.boardId,
      entityId: input.entityId,
      sequence,
      version,
      timestamp: new Date().toISOString(),
      event: input.event,
    })

    this.broadcast(input.boardId, envelope)
  }

  private broadcast(boardId: string, envelope: RealtimeEventEnvelope) {
    const clients = this.boardClients.get(boardId)
    if (!clients || clients.size === 0) {
      return
    }

    const message = JSON.stringify(envelope)

    for (const client of clients) {
      if (client.socket.readyState === 1) {
        client.socket.send(message)
      }
    }
  }
}

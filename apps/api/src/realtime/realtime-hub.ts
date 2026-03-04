import type WebSocket from 'ws'
import { realtimeEventEnvelopeSchema, type RealtimeEventEnvelope } from '@syncboard/shared'

type RealtimeClient = {
  socket: WebSocket
  userId: string
  boardIds: Set<string>
}

export class RealtimeHub {
  private readonly boardClients = new Map<string, Set<RealtimeClient>>()
  private readonly sequenceByBoard = new Map<string, number>()
  private readonly versionByBoard = new Map<string, number>()

  registerClient(socket: WebSocket, userId: string) {
    return {
      socket,
      userId,
      boardIds: new Set<string>(),
    } satisfies RealtimeClient
  }

  unregisterClient(client: RealtimeClient) {
    for (const boardId of client.boardIds) {
      this.leaveBoard(client, boardId)
    }
  }

  joinBoard(client: RealtimeClient, boardId: string) {
    let clients = this.boardClients.get(boardId)
    if (!clients) {
      clients = new Set<RealtimeClient>()
      this.boardClients.set(boardId, clients)
    }

    clients.add(client)
    client.boardIds.add(boardId)

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

  leaveBoard(client: RealtimeClient, boardId: string) {
    const clients = this.boardClients.get(boardId)
    if (!clients || !clients.has(client)) {
      return
    }

    clients.delete(client)
    client.boardIds.delete(boardId)

    if (clients.size === 0) {
      this.boardClients.delete(boardId)
    }

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

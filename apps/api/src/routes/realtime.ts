import { randomUUID } from 'node:crypto'

import type { FastifyInstance } from 'fastify'
import type { RawData } from 'ws'
import { z } from 'zod'
import { entityIdSchema } from '@syncboard/shared'

import { RealtimeHub } from '../realtime/realtime-hub.js'
import type { SessionStore } from '../auth/session-store.js'
import type { BoardStore } from '../domain/board-store.js'

const CLIENT_EVENT_SCHEMA = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('board.join'),
    boardId: entityIdSchema,
  }),
  z.object({
    type: z.literal('board.leave'),
    boardId: entityIdSchema,
  }),
  z.object({
    type: z.literal('activity.update'),
    boardId: entityIdSchema,
    dragging: z.boolean(),
  }),
])

const CLIENT_QUERY_SCHEMA = z.object({
  token: z.string().min(1),
})

function parseClientMessage(raw: RawData) {
  const asText = typeof raw === 'string' ? raw : raw.toString('utf-8')

  try {
    const payload = JSON.parse(asText)
    return CLIENT_EVENT_SCHEMA.safeParse(payload)
  } catch {
    return null
  }
}

export async function registerRealtimeRoutes(
  app: FastifyInstance,
  realtimeHub: RealtimeHub,
  sessionStore: SessionStore,
  boardStore: BoardStore,
) {
  app.get('/ws', { websocket: true }, async (socket, request) => {
    const query = CLIENT_QUERY_SCHEMA.safeParse(request.query)
    if (!query.success) {
      socket.close(1008, 'Unauthorized')
      return
    }

    const sessionUser = await sessionStore.getUserByToken(query.data.token)
    if (!sessionUser) {
      socket.close(1008, 'Unauthorized')
      return
    }

    const userId = entityIdSchema.safeParse(sessionUser.id).success ? sessionUser.id : randomUUID()
    const client = realtimeHub.registerClient(socket, userId)

    socket.on('message', async (raw) => {
      const parsed = parseClientMessage(raw)
      if (!parsed || !parsed.success) {
        return
      }

      if (parsed.data.type === 'board.join') {
        const role = await boardStore.getBoardMemberRole(parsed.data.boardId, userId)
        if (!role) {
          socket.close(1008, 'Forbidden')
          return
        }

        await realtimeHub.joinBoard(client, parsed.data.boardId)
      }

      if (parsed.data.type === 'board.leave') {
        await realtimeHub.leaveBoard(client, parsed.data.boardId)
      }

      if (parsed.data.type === 'activity.update') {
        realtimeHub.publishActivity(client, parsed.data.boardId, parsed.data.dragging)
      }
    })

    socket.on('close', () => {
      void realtimeHub.unregisterClient(client)
    })
  })
}

import { randomUUID } from 'node:crypto'

import type { FastifyInstance } from 'fastify'
import type { RawData } from 'ws'
import { z } from 'zod'
import { entityIdSchema } from '@syncboard/shared'

import { RealtimeHub } from '../realtime/realtime-hub.js'

const CLIENT_EVENT_SCHEMA = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('board.join'),
    boardId: entityIdSchema,
  }),
  z.object({
    type: z.literal('board.leave'),
    boardId: entityIdSchema,
  }),
])

const CLIENT_QUERY_SCHEMA = z.object({
  userId: entityIdSchema.optional(),
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
) {
  app.get('/ws', { websocket: true }, (socket, request) => {
    const query = CLIENT_QUERY_SCHEMA.safeParse(request.query)
    const userId = query.success ? (query.data.userId ?? randomUUID()) : randomUUID()
    const client = realtimeHub.registerClient(socket, userId)

    socket.on('message', async (raw) => {
      const parsed = parseClientMessage(raw)
      if (!parsed || !parsed.success) {
        return
      }

      if (parsed.data.type === 'board.join') {
        await realtimeHub.joinBoard(client, parsed.data.boardId)
      }

      if (parsed.data.type === 'board.leave') {
        await realtimeHub.leaveBoard(client, parsed.data.boardId)
      }
    })

    socket.on('close', () => {
      void realtimeHub.unregisterClient(client)
    })
  })
}

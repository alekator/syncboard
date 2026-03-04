import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  createBoardBodySchema,
  createCardBodySchema,
  createColumnBodySchema,
  entityIdSchema,
  updateCardBodySchema,
  updateColumnBodySchema,
} from '@syncboard/shared'

import type { BoardStore } from '../domain/board-store.js'
import type { RealtimeHub } from '../realtime/realtime-hub.js'
import { requireWriteRole } from '../auth/rbac.js'

const BOARD_ID_PARAMS_SCHEMA = z.object({
  boardId: entityIdSchema,
})

const COLUMN_ID_PARAMS_SCHEMA = z.object({
  columnId: entityIdSchema,
})

const CARD_ID_PARAMS_SCHEMA = z.object({
  cardId: entityIdSchema,
})

function replyValidationError(reply: FastifyReply, message: string) {
  return reply.status(400).send({ message })
}

export async function registerBoardRoutes(
  app: FastifyInstance,
  store: BoardStore,
  realtimeHub: RealtimeHub,
) {
  app.get('/boards', async () => {
    const boards = await store.listBoards()
    return { boards }
  })

  app.post('/boards', async (request, reply) => {
    if (!requireWriteRole(request, reply)) {
      return
    }

    const parsed = createBoardBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return replyValidationError(reply, 'Invalid board payload')
    }

    const board = await store.createBoard(parsed.data.name)
    return reply.status(201).send(board)
  })

  app.get('/boards/:boardId', async (request, reply) => {
    const params = BOARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid board id')
    }

    const snapshot = await store.getBoardSnapshot(params.data.boardId)
    if (!snapshot) {
      return reply.status(404).send({ message: 'Board not found' })
    }

    return snapshot
  })

  app.post('/boards/:boardId/columns', async (request, reply) => {
    if (!requireWriteRole(request, reply)) {
      return
    }

    const params = BOARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid board id')
    }

    const body = createColumnBodySchema.safeParse(request.body)
    if (!body.success) {
      return replyValidationError(reply, 'Invalid column payload')
    }

    const column = await store.createColumn(params.data.boardId, body.data.title)
    if (!column) {
      return reply.status(404).send({ message: 'Board not found' })
    }

    realtimeHub.publishBoardEvent({
      boardId: column.boardId,
      entityId: column.id,
      event: {
        type: 'column.created',
        payload: column,
      },
    })

    return reply.status(201).send(column)
  })

  app.patch('/columns/:columnId', async (request, reply) => {
    if (!requireWriteRole(request, reply)) {
      return
    }

    const params = COLUMN_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid column id')
    }

    const body = updateColumnBodySchema.safeParse(request.body)
    if (!body.success) {
      return replyValidationError(reply, 'Invalid column payload')
    }

    const column = await store.updateColumn(params.data.columnId, body.data)
    if (!column) {
      return reply.status(404).send({ message: 'Column not found' })
    }

    realtimeHub.publishBoardEvent({
      boardId: column.boardId,
      entityId: column.id,
      event: {
        type: 'column.updated',
        payload: column,
      },
    })

    return column
  })

  app.post('/columns/:columnId/cards', async (request, reply) => {
    if (!requireWriteRole(request, reply)) {
      return
    }

    const params = COLUMN_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid column id')
    }

    const body = createCardBodySchema.safeParse(request.body)
    if (!body.success) {
      return replyValidationError(reply, 'Invalid card payload')
    }

    const card = await store.createCard(params.data.columnId, body.data)
    if (!card) {
      return reply.status(404).send({ message: 'Column not found' })
    }

    realtimeHub.publishBoardEvent({
      boardId: card.boardId,
      entityId: card.id,
      event: {
        type: 'card.created',
        payload: card,
      },
    })

    return reply.status(201).send(card)
  })

  app.patch('/cards/:cardId', async (request, reply) => {
    if (!requireWriteRole(request, reply)) {
      return
    }

    const params = CARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid card id')
    }

    const body = updateCardBodySchema.safeParse(request.body)
    if (!body.success) {
      return replyValidationError(reply, 'Invalid card payload')
    }

    const card = await store.updateCard(params.data.cardId, body.data)
    if (!card) {
      return reply.status(404).send({ message: 'Card not found or invalid target column' })
    }

    const isMoveEvent = body.data.columnId !== undefined || body.data.position !== undefined
    if (isMoveEvent) {
      realtimeHub.publishBoardEvent({
        boardId: card.boardId,
        entityId: card.id,
        event: {
          type: 'card.moved',
          payload: {
            id: card.id,
            boardId: card.boardId,
            columnId: card.columnId,
            position: card.position,
            updatedAt: card.updatedAt,
          },
        },
      })
    } else {
      realtimeHub.publishBoardEvent({
        boardId: card.boardId,
        entityId: card.id,
        event: {
          type: 'card.updated',
          payload: card,
        },
      })
    }

    return card
  })

  app.delete('/cards/:cardId', async (request, reply) => {
    if (!requireWriteRole(request, reply)) {
      return
    }

    const params = CARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid card id')
    }

    const card = await store.getCard(params.data.cardId)
    if (!card) {
      return reply.status(404).send({ message: 'Card not found' })
    }

    const deleted = await store.deleteCard(params.data.cardId)
    if (!deleted) {
      return reply.status(404).send({ message: 'Card not found' })
    }

    realtimeHub.publishBoardEvent({
      boardId: card.boardId,
      entityId: card.id,
      event: {
        type: 'card.deleted',
        payload: {
          id: card.id,
          boardId: card.boardId,
        },
      },
    })

    return reply.status(204).send()
  })
}

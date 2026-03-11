import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  boardRoleSchema,
  createBoardBodySchema,
  createCardBodySchema,
  createColumnBodySchema,
  entityIdSchema,
  updateCardBodySchema,
  updateColumnBodySchema,
} from '@syncboard/shared'

import type { BoardStore } from '../domain/board-store.js'
import type { RealtimeHub } from '../realtime/realtime-hub.js'
import type { SessionStore } from '../auth/session-store.js'
import { requireAuth, requireWriteRole } from '../auth/rbac.js'

const BOARD_ID_PARAMS_SCHEMA = z.object({
  boardId: entityIdSchema,
})

const COLUMN_ID_PARAMS_SCHEMA = z.object({
  columnId: entityIdSchema,
})

const CARD_ID_PARAMS_SCHEMA = z.object({
  cardId: entityIdSchema,
})

const UPSERT_MEMBER_BODY_SCHEMA = z.object({
  userId: entityIdSchema,
  role: boardRoleSchema,
})

function replyValidationError(reply: FastifyReply, message: string) {
  return reply.status(400).send({ message })
}

async function resolveMemberRole(store: BoardStore, boardId: string, userId: string) {
  return store.getBoardMemberRole(boardId, userId)
}

export async function registerBoardRoutes(
  app: FastifyInstance,
  store: BoardStore,
  realtimeHub: RealtimeHub,
  sessionStore: SessionStore,
) {
  app.get('/boards', async (request, reply) => {
    const authUser = requireAuth(request, reply)
    if (!authUser) {
      return
    }

    const boards = await store.listBoardsForUser(authUser.id)
    return { boards }
  })

  app.post('/boards', async (request, reply) => {
    const authUser = requireAuth(request, reply)
    if (!authUser) {
      return
    }

    if (!requireWriteRole(authUser.role, reply)) {
      return
    }

    const parsed = createBoardBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return replyValidationError(reply, 'Invalid board payload')
    }

    const board = await store.createBoard(parsed.data.name, authUser.id)
    return reply.status(201).send(board)
  })

  app.get('/boards/:boardId', async (request, reply) => {
    const authUser = requireAuth(request, reply)
    if (!authUser) {
      return
    }

    const params = BOARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid board id')
    }

    const role = await resolveMemberRole(store, params.data.boardId, authUser.id)
    if (!role) {
      return reply.status(403).send({ message: 'Forbidden: board access denied' })
    }

    const snapshot = await store.getBoardSnapshot(params.data.boardId)
    if (!snapshot) {
      return reply.status(404).send({ message: 'Board not found' })
    }

    return snapshot
  })

  app.patch('/boards/:boardId', async (request, reply) => {
    const authUser = requireAuth(request, reply)
    if (!authUser) {
      return
    }

    const params = BOARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid board id')
    }

    const role = await resolveMemberRole(store, params.data.boardId, authUser.id)
    if (!role) {
      return reply.status(403).send({ message: 'Forbidden: board access denied' })
    }
    if (!requireWriteRole(role, reply)) {
      return
    }

    const body = createBoardBodySchema.safeParse(request.body)
    if (!body.success) {
      return replyValidationError(reply, 'Invalid board payload')
    }

    const board = await store.updateBoard(params.data.boardId, { name: body.data.name })
    if (!board) {
      return reply.status(404).send({ message: 'Board not found' })
    }

    return board
  })

  app.delete('/boards/:boardId', async (request, reply) => {
    const authUser = requireAuth(request, reply)
    if (!authUser) {
      return
    }

    const params = BOARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid board id')
    }

    const role = await resolveMemberRole(store, params.data.boardId, authUser.id)
    if (!role) {
      return reply.status(403).send({ message: 'Forbidden: board access denied' })
    }
    if (!requireWriteRole(role, reply)) {
      return
    }

    const deleted = await store.deleteBoard(params.data.boardId)
    if (!deleted) {
      return reply.status(404).send({ message: 'Board not found' })
    }

    return reply.status(204).send()
  })

  app.post('/boards/:boardId/members', async (request, reply) => {
    const authUser = requireAuth(request, reply)
    if (!authUser) {
      return
    }

    const params = BOARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid board id')
    }

    const ownerRole = await resolveMemberRole(store, params.data.boardId, authUser.id)
    if (ownerRole !== 'owner') {
      return reply.status(403).send({ message: 'Forbidden: only owner can manage members' })
    }

    const body = UPSERT_MEMBER_BODY_SCHEMA.safeParse(request.body)
    if (!body.success) {
      return replyValidationError(reply, 'Invalid board member payload')
    }

    const targetUser = await sessionStore.getUserById(body.data.userId)
    if (!targetUser) {
      return reply.status(404).send({ message: 'User not found' })
    }

    const added = await store.addBoardMember(params.data.boardId, body.data.userId, body.data.role)
    if (!added) {
      return reply.status(404).send({ message: 'Board not found' })
    }

    return reply.status(204).send()
  })

  app.post('/boards/:boardId/columns', async (request, reply) => {
    const authUser = requireAuth(request, reply)
    if (!authUser) {
      return
    }

    const params = BOARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid board id')
    }

    const role = await resolveMemberRole(store, params.data.boardId, authUser.id)
    if (!role) {
      return reply.status(403).send({ message: 'Forbidden: board access denied' })
    }
    if (!requireWriteRole(role, reply)) {
      return
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
    const authUser = requireAuth(request, reply)
    if (!authUser) {
      return
    }

    const params = COLUMN_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid column id')
    }

    const column = await store.getColumn(params.data.columnId)
    if (!column) {
      return reply.status(404).send({ message: 'Column not found' })
    }

    const role = await resolveMemberRole(store, column.boardId, authUser.id)
    if (!role) {
      return reply.status(403).send({ message: 'Forbidden: board access denied' })
    }
    if (!requireWriteRole(role, reply)) {
      return
    }

    const body = updateColumnBodySchema.safeParse(request.body)
    if (!body.success) {
      return replyValidationError(reply, 'Invalid column payload')
    }

    const updatedColumn = await store.updateColumn(params.data.columnId, body.data)
    if (!updatedColumn) {
      return reply.status(404).send({ message: 'Column not found' })
    }

    realtimeHub.publishBoardEvent({
      boardId: updatedColumn.boardId,
      entityId: updatedColumn.id,
      event: {
        type: 'column.updated',
        payload: updatedColumn,
      },
    })

    return updatedColumn
  })

  app.post('/columns/:columnId/cards', async (request, reply) => {
    const authUser = requireAuth(request, reply)
    if (!authUser) {
      return
    }

    const params = COLUMN_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid column id')
    }

    const column = await store.getColumn(params.data.columnId)
    if (!column) {
      return reply.status(404).send({ message: 'Column not found' })
    }

    const role = await resolveMemberRole(store, column.boardId, authUser.id)
    if (!role) {
      return reply.status(403).send({ message: 'Forbidden: board access denied' })
    }
    if (!requireWriteRole(role, reply)) {
      return
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
    const authUser = requireAuth(request, reply)
    if (!authUser) {
      return
    }

    const params = CARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid card id')
    }

    const existingCard = await store.getCard(params.data.cardId)
    if (!existingCard) {
      return reply.status(404).send({ message: 'Card not found or invalid target column' })
    }

    const role = await resolveMemberRole(store, existingCard.boardId, authUser.id)
    if (!role) {
      return reply.status(403).send({ message: 'Forbidden: board access denied' })
    }
    if (!requireWriteRole(role, reply)) {
      return
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
    const authUser = requireAuth(request, reply)
    if (!authUser) {
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

    const role = await resolveMemberRole(store, card.boardId, authUser.id)
    if (!role) {
      return reply.status(403).send({ message: 'Forbidden: board access denied' })
    }
    if (!requireWriteRole(role, reply)) {
      return
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

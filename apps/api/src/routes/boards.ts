import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'

import type { InMemoryBoardStore } from '../domain/board-store.js'

const BOARD_ID_PARAMS_SCHEMA = z.object({
  boardId: z.uuid(),
})

const COLUMN_ID_PARAMS_SCHEMA = z.object({
  columnId: z.uuid(),
})

const CARD_ID_PARAMS_SCHEMA = z.object({
  cardId: z.uuid(),
})

const CREATE_BOARD_BODY_SCHEMA = z.object({
  name: z.string().trim().min(1).max(120),
})

const CREATE_COLUMN_BODY_SCHEMA = z.object({
  title: z.string().trim().min(1).max(120),
})

const UPDATE_COLUMN_BODY_SCHEMA = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    position: z.number().finite().optional(),
  })
  .refine((value) => value.title !== undefined || value.position !== undefined, {
    message: 'At least one field is required',
  })

const CREATE_CARD_BODY_SCHEMA = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(10_000).optional(),
})

const UPDATE_CARD_BODY_SCHEMA = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(10_000).optional(),
    columnId: z.uuid().optional(),
    position: z.number().finite().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.columnId !== undefined ||
      value.position !== undefined,
    { message: 'At least one field is required' },
  )

function replyValidationError(reply: FastifyReply, message: string) {
  return reply.status(400).send({ message })
}

export async function registerBoardRoutes(app: FastifyInstance, store: InMemoryBoardStore) {
  app.get('/boards', async () => {
    const boards = store.listBoards()
    return { boards }
  })

  app.post('/boards', async (request, reply) => {
    const parsed = CREATE_BOARD_BODY_SCHEMA.safeParse(request.body)
    if (!parsed.success) {
      return replyValidationError(reply, 'Invalid board payload')
    }

    const board = store.createBoard(parsed.data.name)
    return reply.status(201).send(board)
  })

  app.get('/boards/:boardId', async (request, reply) => {
    const params = BOARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid board id')
    }

    const snapshot = store.getBoardSnapshot(params.data.boardId)
    if (!snapshot) {
      return reply.status(404).send({ message: 'Board not found' })
    }

    return snapshot
  })

  app.post('/boards/:boardId/columns', async (request, reply) => {
    const params = BOARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid board id')
    }

    const body = CREATE_COLUMN_BODY_SCHEMA.safeParse(request.body)
    if (!body.success) {
      return replyValidationError(reply, 'Invalid column payload')
    }

    const column = store.createColumn(params.data.boardId, body.data.title)
    if (!column) {
      return reply.status(404).send({ message: 'Board not found' })
    }

    return reply.status(201).send(column)
  })

  app.patch('/columns/:columnId', async (request, reply) => {
    const params = COLUMN_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid column id')
    }

    const body = UPDATE_COLUMN_BODY_SCHEMA.safeParse(request.body)
    if (!body.success) {
      return replyValidationError(reply, 'Invalid column payload')
    }

    const column = store.updateColumn(params.data.columnId, body.data)
    if (!column) {
      return reply.status(404).send({ message: 'Column not found' })
    }

    return column
  })

  app.post('/columns/:columnId/cards', async (request, reply) => {
    const params = COLUMN_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid column id')
    }

    const body = CREATE_CARD_BODY_SCHEMA.safeParse(request.body)
    if (!body.success) {
      return replyValidationError(reply, 'Invalid card payload')
    }

    const card = store.createCard(params.data.columnId, body.data)
    if (!card) {
      return reply.status(404).send({ message: 'Column not found' })
    }

    return reply.status(201).send(card)
  })

  app.patch('/cards/:cardId', async (request, reply) => {
    const params = CARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid card id')
    }

    const body = UPDATE_CARD_BODY_SCHEMA.safeParse(request.body)
    if (!body.success) {
      return replyValidationError(reply, 'Invalid card payload')
    }

    const card = store.updateCard(params.data.cardId, body.data)
    if (!card) {
      return reply.status(404).send({ message: 'Card not found or invalid target column' })
    }

    return card
  })

  app.delete('/cards/:cardId', async (request, reply) => {
    const params = CARD_ID_PARAMS_SCHEMA.safeParse(request.params)
    if (!params.success) {
      return replyValidationError(reply, 'Invalid card id')
    }

    const deleted = store.deleteCard(params.data.cardId)
    if (!deleted) {
      return reply.status(404).send({ message: 'Card not found' })
    }

    return reply.status(204).send()
  })
}

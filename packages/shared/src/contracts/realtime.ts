import { z } from 'zod'

import { boardCardSchema, boardColumnSchema, entityIdSchema, timestampSchema } from './board.js'

export const realtimeEventTypeSchema = z.enum([
  'board.join',
  'board.leave',
  'presence.update',
  'activity.update',
  'card.created',
  'card.updated',
  'card.deleted',
  'card.moved',
  'column.created',
  'column.updated',
  'column.reordered',
])

export type RealtimeEventType = z.infer<typeof realtimeEventTypeSchema>

export const presencePayloadSchema = z.object({
  userId: entityIdSchema,
  boardId: entityIdSchema,
  online: z.boolean(),
})

export const activityPayloadSchema = z.object({
  userId: entityIdSchema,
  boardId: entityIdSchema,
  dragging: z.boolean(),
})

export const realtimeEventPayloadSchema = z.union([
  z.object({
    type: z.literal('presence.update'),
    payload: presencePayloadSchema,
  }),
  z.object({
    type: z.literal('activity.update'),
    payload: activityPayloadSchema,
  }),
  z.object({
    type: z.literal('card.created'),
    payload: boardCardSchema,
  }),
  z.object({
    type: z.literal('card.updated'),
    payload: boardCardSchema,
  }),
  z.object({
    type: z.literal('card.moved'),
    payload: boardCardSchema.pick({
      id: true,
      boardId: true,
      columnId: true,
      position: true,
      updatedAt: true,
    }),
  }),
  z.object({
    type: z.literal('card.deleted'),
    payload: z.object({
      id: entityIdSchema,
      boardId: entityIdSchema,
    }),
  }),
  z.object({
    type: z.literal('column.created'),
    payload: boardColumnSchema,
  }),
  z.object({
    type: z.literal('column.updated'),
    payload: boardColumnSchema,
  }),
  z.object({
    type: z.literal('column.reordered'),
    payload: z.object({
      boardId: entityIdSchema,
      columnIds: z.array(entityIdSchema),
    }),
  }),
  z.object({
    type: z.literal('board.join'),
    payload: z.object({
      boardId: entityIdSchema,
      fromSequence: z.number().int().nonnegative().optional(),
    }),
  }),
  z.object({
    type: z.literal('board.leave'),
    payload: z.object({ boardId: entityIdSchema }),
  }),
])

export const realtimeEventEnvelopeSchema = z.object({
  boardId: entityIdSchema,
  entityId: entityIdSchema.optional(),
  version: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
  timestamp: timestampSchema,
  event: realtimeEventPayloadSchema,
})

export type RealtimeEventEnvelope = z.infer<typeof realtimeEventEnvelopeSchema>

import { z } from 'zod'

export const entityIdSchema = z.uuid()
export type EntityId = z.infer<typeof entityIdSchema>

export const timestampSchema = z.iso.datetime()

export const boardSchema = z.object({
  id: entityIdSchema,
  name: z.string().trim().min(1).max(120),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export type Board = z.infer<typeof boardSchema>

export const boardColumnSchema = z.object({
  id: entityIdSchema,
  boardId: entityIdSchema,
  title: z.string().trim().min(1).max(120),
  position: z.number().finite(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export type BoardColumn = z.infer<typeof boardColumnSchema>

export const boardCardSchema = z.object({
  id: entityIdSchema,
  boardId: entityIdSchema,
  columnId: entityIdSchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().max(10_000),
  position: z.number().finite(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export type BoardCard = z.infer<typeof boardCardSchema>

export const boardSnapshotColumnSchema = boardColumnSchema.extend({
  cards: z.array(boardCardSchema),
})

export const boardSnapshotSchema = z.object({
  board: boardSchema,
  columns: z.array(boardSnapshotColumnSchema),
})

export type BoardSnapshot = z.infer<typeof boardSnapshotSchema>

export const listBoardsResponseSchema = z.object({
  boards: z.array(boardSchema),
})

export const createBoardBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
})

export type CreateBoardBody = z.infer<typeof createBoardBodySchema>

export const createColumnBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
})

export type CreateColumnBody = z.infer<typeof createColumnBodySchema>

export const updateColumnBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    position: z.number().finite().optional(),
  })
  .refine((value) => value.title !== undefined || value.position !== undefined, {
    message: 'At least one field is required',
  })

export type UpdateColumnBody = z.infer<typeof updateColumnBodySchema>

export const createCardBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(10_000).optional(),
})

export type CreateCardBody = z.infer<typeof createCardBodySchema>

export const updateCardBodySchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(10_000).optional(),
    columnId: entityIdSchema.optional(),
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

export type UpdateCardBody = z.infer<typeof updateCardBodySchema>

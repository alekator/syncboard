import {
  boardCardSchema,
  boardSchema,
  boardSnapshotSchema,
  createBoardBodySchema,
  createCardBodySchema,
  createColumnBodySchema,
  entityIdSchema,
  listBoardsResponseSchema,
  updateCardBodySchema,
} from '@syncboard/shared'

import { requestJson } from '@/shared/api/http-client'

export async function listBoards() {
  const payload = await requestJson('/boards')
  return listBoardsResponseSchema.parse(payload)
}

export async function createBoard(input: { name: string }) {
  const body = createBoardBodySchema.parse(input)
  const payload = await requestJson('/boards', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return boardSchema.parse(payload)
}

export async function getBoardSnapshot(boardId: string) {
  const id = entityIdSchema.parse(boardId)
  const payload = await requestJson(`/boards/${id}`)
  return boardSnapshotSchema.parse(payload)
}

export async function createColumn(boardId: string, input: { title: string }) {
  const id = entityIdSchema.parse(boardId)
  const body = createColumnBodySchema.parse(input)
  const payload = await requestJson(`/boards/${id}/columns`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return payload
}

export async function createCard(
  columnId: string,
  input: { title: string; description?: string },
) {
  const id = entityIdSchema.parse(columnId)
  const body = createCardBodySchema.parse(input)
  const payload = await requestJson(`/columns/${id}/cards`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return payload
}

export async function updateCard(
  cardId: string,
  input: { title?: string; description?: string; columnId?: string; position?: number },
) {
  const id = entityIdSchema.parse(cardId)
  const body = updateCardBodySchema.parse(input)
  const payload = await requestJson(`/cards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  return boardCardSchema.parse(payload)
}

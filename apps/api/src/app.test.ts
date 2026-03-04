import { afterEach, describe, expect, it } from 'vitest'

import { buildApp } from './app.js'

describe('buildApp', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined

  afterEach(async () => {
    if (app) {
      await app.close()
      app = undefined
    }
  })

  it('returns health status for /health', async () => {
    app = await buildApp({ origin: '*' })

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('supports board snapshot CRUD flow', async () => {
    app = await buildApp({ origin: '*' })

    const createBoard = await app.inject({
      method: 'POST',
      url: '/boards',
      payload: { name: 'Product Roadmap' },
    })

    expect(createBoard.statusCode).toBe(201)
    const board = createBoard.json()
    expect(board.name).toBe('Product Roadmap')

    const createColumn = await app.inject({
      method: 'POST',
      url: `/boards/${board.id}/columns`,
      payload: { title: 'Backlog' },
    })

    expect(createColumn.statusCode).toBe(201)
    const column = createColumn.json()
    expect(column.title).toBe('Backlog')

    const createCard = await app.inject({
      method: 'POST',
      url: `/columns/${column.id}/cards`,
      payload: { title: 'Sync websocket events', description: 'Implement initial WS contract' },
    })

    expect(createCard.statusCode).toBe(201)
    const card = createCard.json()
    expect(card.columnId).toBe(column.id)

    const updateCard = await app.inject({
      method: 'PATCH',
      url: `/cards/${card.id}`,
      payload: { title: 'Sync WS events v1', position: 2500 },
    })

    expect(updateCard.statusCode).toBe(200)
    const updatedCard = updateCard.json()
    expect(updatedCard.title).toBe('Sync WS events v1')
    expect(updatedCard.position).toBe(2500)

    const snapshot = await app.inject({
      method: 'GET',
      url: `/boards/${board.id}`,
    })

    expect(snapshot.statusCode).toBe(200)
    expect(snapshot.json()).toEqual({
      board: expect.objectContaining({ id: board.id, name: 'Product Roadmap' }),
      columns: [
        expect.objectContaining({
          id: column.id,
          title: 'Backlog',
          cards: [expect.objectContaining({ id: card.id, title: 'Sync WS events v1' })],
        }),
      ],
    })

    const deleteCard = await app.inject({
      method: 'DELETE',
      url: `/cards/${card.id}`,
    })

    expect(deleteCard.statusCode).toBe(204)
  })

  it('rejects invalid board payload', async () => {
    app = await buildApp({ origin: '*' })

    const response = await app.inject({
      method: 'POST',
      url: '/boards',
      payload: { name: '' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ message: 'Invalid board payload' })
  })
})

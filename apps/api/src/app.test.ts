import { once } from 'node:events'
import type { AddressInfo } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import type { RawData } from 'ws'

import { buildApp } from './app.js'

async function waitForRealtimeMessage(
  socket: WebSocket,
  predicate: (payload: unknown) => boolean,
  timeoutMs = 2_000,
) {
  return new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for realtime message'))
    }, timeoutMs)

    const onMessage = (raw: RawData) => {
      const text = typeof raw === 'string' ? raw : raw.toString('utf-8')

      try {
        const payload = JSON.parse(text) as unknown
        if (predicate(payload)) {
          cleanup()
          resolve(payload)
        }
      } catch {
        // Ignore invalid payloads.
      }
    }

    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', onMessage)
    }

    socket.on('message', onMessage)
  })
}

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

  it('allows CORS preflight for PATCH and DELETE methods', async () => {
    app = await buildApp({ origin: 'http://localhost:5173' })

    const patchPreflight = await app.inject({
      method: 'OPTIONS',
      url: '/cards/00000000-0000-4000-8000-000000000000',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PATCH',
      },
    })

    expect(patchPreflight.statusCode).toBe(204)
    expect(patchPreflight.headers['access-control-allow-methods']).toContain('PATCH')

    const deletePreflight = await app.inject({
      method: 'OPTIONS',
      url: '/cards/00000000-0000-4000-8000-000000000000',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'DELETE',
      },
    })

    expect(deletePreflight.statusCode).toBe(204)
    expect(deletePreflight.headers['access-control-allow-methods']).toContain('DELETE')
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

  it('forbids board mutations for viewer role', async () => {
    app = await buildApp({ origin: '*' })

    const createBoard = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        'x-syncboard-role': 'viewer',
      },
      payload: { name: 'Read only board' },
    })

    expect(createBoard.statusCode).toBe(403)
    expect(createBoard.json()).toEqual({
      message: 'Forbidden: viewer role cannot modify board state',
    })
  })

  it('creates auth session and returns current user via /me', async () => {
    app = await buildApp({ origin: '*' })

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { name: 'Azazel', role: 'editor' },
    })

    expect(login.statusCode).toBe(200)
    const session = login.json()
    expect(session.user.name).toBe('Azazel')
    expect(session.user.role).toBe('editor')
    expect(typeof session.token).toBe('string')

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        authorization: `Bearer ${session.token}`,
      },
    })

    expect(me.statusCode).toBe(200)
    expect(me.json()).toEqual({
      user: expect.objectContaining({
        name: 'Azazel',
        role: 'editor',
      }),
    })
  })

  it('enforces viewer role from bearer session token', async () => {
    app = await buildApp({ origin: '*' })

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { name: 'Readonly', role: 'viewer' },
    })
    const session = login.json()

    const createBoard = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${session.token}`,
      },
      payload: { name: 'Blocked board' },
    })

    expect(createBoard.statusCode).toBe(403)
    expect(createBoard.json()).toEqual({
      message: 'Forbidden: viewer role cannot modify board state',
    })
  })

  it('broadcasts realtime events for board clients over websocket', async () => {
    app = await buildApp({ origin: '*' })
    await app.listen({ host: '127.0.0.1', port: 0 })

    const createBoard = await app.inject({
      method: 'POST',
      url: '/boards',
      payload: { name: 'Realtime Board' },
    })
    const board = createBoard.json()

    const address = app.server.address() as AddressInfo
    const userId = '11111111-1111-4111-8111-111111111111'
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws?userId=${userId}`)
    await once(socket, 'open')

    const presencePromise = waitForRealtimeMessage(
      socket,
      (payload) =>
        typeof payload === 'object' &&
        payload !== null &&
        'event' in payload &&
        typeof payload.event === 'object' &&
        payload.event !== null &&
        'type' in payload.event &&
        payload.event.type === 'presence.update',
    )

    socket.send(JSON.stringify({ type: 'board.join', boardId: board.id }))
    const presenceEvent = (await presencePromise) as {
      boardId: string
      event: { type: string; payload: { online: boolean } }
    }
    expect(presenceEvent.boardId).toBe(board.id)
    expect(presenceEvent.event.payload.online).toBe(true)

    const columnEventPromise = waitForRealtimeMessage(
      socket,
      (payload) =>
        typeof payload === 'object' &&
        payload !== null &&
        'event' in payload &&
        typeof payload.event === 'object' &&
        payload.event !== null &&
        'type' in payload.event &&
        payload.event.type === 'column.created',
    )

    const createColumn = await app.inject({
      method: 'POST',
      url: `/boards/${board.id}/columns`,
      payload: { title: 'Incoming' },
    })
    expect(createColumn.statusCode).toBe(201)

    const columnEvent = (await columnEventPromise) as {
      event: {
        type: string
        payload: { boardId: string; title: string }
      }
      sequence: number
      version: number
    }

    expect(columnEvent.event.type).toBe('column.created')
    expect(columnEvent.event.payload.boardId).toBe(board.id)
    expect(columnEvent.event.payload.title).toBe('Incoming')
    expect(columnEvent.sequence).toBeGreaterThan(0)
    expect(columnEvent.version).toBeGreaterThan(0)

    socket.close()
    await once(socket, 'close')
  })
})

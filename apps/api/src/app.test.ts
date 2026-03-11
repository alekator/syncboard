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

function metricValue(metricsText: string, name: string) {
  const line = metricsText
    .split('\n')
    .find((entry) => entry.startsWith(`${name} `))

  if (!line) {
    return null
  }

  const value = Number(line.split(' ')[1])
  return Number.isFinite(value) ? value : null
}

describe('buildApp', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined

  async function login(name: string, role: 'owner' | 'editor' | 'viewer') {
    const response = await app!.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { name, role },
    })

    expect(response.statusCode).toBe(200)
    return response.json() as { token: string; user: { id: string; role: string; name: string } }
  }

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
    expect(typeof response.headers['x-request-id']).toBe('string')
  })

  it('returns observability metrics for /metrics', async () => {
    app = await buildApp({ origin: '*' })

    const response = await app.inject({
      method: 'GET',
      url: '/metrics',
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.body).toContain('syncboard_ws_active_connections')
    expect(response.body).toContain('syncboard_ws_reconnect_total')
    expect(response.body).toContain('syncboard_failed_mutations_total')
    expect(response.body).toContain('syncboard_forbidden_total')
  })

  it('tracks forbidden and failed mutation counters', async () => {
    app = await buildApp({ origin: '*' })
    const owner = await login('Owner', 'owner')
    const outsider = await login('Outsider', 'editor')

    const board = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { name: 'Secured board' },
    })
    const boardPayload = board.json()

    const forbiddenMutation = await app.inject({
      method: 'PATCH',
      url: `/boards/${boardPayload.id}`,
      headers: {
        authorization: `Bearer ${outsider.token}`,
      },
      payload: { name: 'Hacked board' },
    })
    expect(forbiddenMutation.statusCode).toBe(403)

    const invalidMutation = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { name: '' },
    })
    expect(invalidMutation.statusCode).toBe(400)

    const metrics = await app.inject({
      method: 'GET',
      url: '/metrics',
    })
    expect(metricValue(metrics.body, 'syncboard_forbidden_total')).toBeGreaterThanOrEqual(1)
    expect(metricValue(metrics.body, 'syncboard_failed_mutations_total')).toBeGreaterThanOrEqual(2)
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

  it('requires authentication for board routes', async () => {
    app = await buildApp({ origin: '*' })

    const listBoards = await app.inject({
      method: 'GET',
      url: '/boards',
    })

    expect(listBoards.statusCode).toBe(401)
    expect(listBoards.json()).toEqual({ message: 'Unauthorized' })
  })

  it('supports board snapshot CRUD flow for authorized owner', async () => {
    app = await buildApp({ origin: '*' })
    const owner = await login('Owner', 'owner')

    const createBoard = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { name: 'Product Roadmap' },
    })

    expect(createBoard.statusCode).toBe(201)
    const board = createBoard.json()
    expect(board.name).toBe('Product Roadmap')

    const createColumn = await app.inject({
      method: 'POST',
      url: `/boards/${board.id}/columns`,
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { title: 'Backlog' },
    })

    expect(createColumn.statusCode).toBe(201)
    const column = createColumn.json()
    expect(column.title).toBe('Backlog')

    const createCard = await app.inject({
      method: 'POST',
      url: `/columns/${column.id}/cards`,
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { title: 'Sync websocket events', description: 'Implement initial WS contract' },
    })

    expect(createCard.statusCode).toBe(201)
    const card = createCard.json()
    expect(card.columnId).toBe(column.id)

    const updateCard = await app.inject({
      method: 'PATCH',
      url: `/cards/${card.id}`,
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { title: 'Sync WS events v1', position: 2500 },
    })

    expect(updateCard.statusCode).toBe(200)
    const updatedCard = updateCard.json()
    expect(updatedCard.title).toBe('Sync WS events v1')
    expect(updatedCard.position).toBe(2500)

    const snapshot = await app.inject({
      method: 'GET',
      url: `/boards/${board.id}`,
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
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
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
    })

    expect(deleteCard.statusCode).toBe(204)

    const updateBoard = await app.inject({
      method: 'PATCH',
      url: `/boards/${board.id}`,
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { name: 'Product Roadmap Updated' },
    })

    expect(updateBoard.statusCode).toBe(200)
    expect(updateBoard.json()).toEqual(
      expect.objectContaining({
        id: board.id,
        name: 'Product Roadmap Updated',
      }),
    )

    const deleteBoard = await app.inject({
      method: 'DELETE',
      url: `/boards/${board.id}`,
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
    })
    expect(deleteBoard.statusCode).toBe(204)

    const missingSnapshot = await app.inject({
      method: 'GET',
      url: `/boards/${board.id}`,
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
    })
    expect(missingSnapshot.statusCode).toBe(403)
  })

  it('rejects invalid board payload', async () => {
    app = await buildApp({ origin: '*' })
    const owner = await login('Owner', 'owner')

    const response = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { name: '' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ message: 'Invalid board payload' })
  })

  it('replays mutation response for the same idempotency key', async () => {
    app = await buildApp({ origin: '*' })
    const owner = await login('Owner', 'owner')
    const idempotencyKey = 'board-create-1'

    const firstCreate = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': idempotencyKey,
      },
      payload: { name: 'Idempotent board' },
    })

    const secondCreate = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': idempotencyKey,
      },
      payload: { name: 'Idempotent board' },
    })

    expect(firstCreate.statusCode).toBe(201)
    expect(secondCreate.statusCode).toBe(201)
    expect(secondCreate.headers['x-idempotent-replay']).toBe('true')

    const firstPayload = firstCreate.json() as { id: string; name: string }
    const secondPayload = secondCreate.json() as { id: string; name: string }
    expect(secondPayload).toEqual(firstPayload)

    const boardsResponse = await app.inject({
      method: 'GET',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
    })

    expect(boardsResponse.statusCode).toBe(200)
    const boards = (boardsResponse.json() as { boards: Array<{ id: string }> }).boards
    expect(boards.filter((board) => board.id === firstPayload.id)).toHaveLength(1)
  })

  it('rejects idempotency key reuse with a different payload', async () => {
    app = await buildApp({ origin: '*' })
    const owner = await login('Owner', 'owner')
    const idempotencyKey = 'board-create-conflict'

    const firstCreate = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': idempotencyKey,
      },
      payload: { name: 'First board name' },
    })
    expect(firstCreate.statusCode).toBe(201)

    const conflictingCreate = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': idempotencyKey,
      },
      payload: { name: 'Different board name' },
    })

    expect(conflictingCreate.statusCode).toBe(409)
    expect(conflictingCreate.json()).toEqual({
      message: 'Idempotency key reuse with different request payload is not allowed',
    })
  })

  it('forbids board mutations for viewer role', async () => {
    app = await buildApp({ origin: '*' })
    const viewer = await login('Readonly', 'viewer')

    const createBoard = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${viewer.token}`,
      },
      payload: { name: 'Read only board' },
    })

    expect(createBoard.statusCode).toBe(403)
    expect(createBoard.json()).toEqual({
      message: 'Forbidden: viewer role cannot modify board state',
    })
  })

  it('enforces board membership for snapshot access', async () => {
    app = await buildApp({ origin: '*' })
    const owner = await login('Owner', 'owner')
    const outsider = await login('Outsider', 'editor')

    const createBoard = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { name: 'Private board' },
    })
    const board = createBoard.json()

    const outsiderRead = await app.inject({
      method: 'GET',
      url: `/boards/${board.id}`,
      headers: {
        authorization: `Bearer ${outsider.token}`,
      },
    })
    expect(outsiderRead.statusCode).toBe(403)
    expect(outsiderRead.json()).toEqual({ message: 'Forbidden: board access denied' })
  })

  it('allows owner to add member and grants access', async () => {
    app = await buildApp({ origin: '*' })
    const owner = await login('Owner', 'owner')
    const editor = await login('Editor', 'editor')

    const createBoard = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { name: 'Shared board' },
    })
    const board = createBoard.json()

    const addMember = await app.inject({
      method: 'POST',
      url: `/boards/${board.id}/members`,
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: {
        userId: editor.user.id,
        role: 'editor',
      },
    })
    expect(addMember.statusCode).toBe(204)

    const editorBoards = await app.inject({
      method: 'GET',
      url: '/boards',
      headers: {
        authorization: `Bearer ${editor.token}`,
      },
    })
    expect(editorBoards.statusCode).toBe(200)
    expect(editorBoards.json()).toEqual({
      boards: [expect.objectContaining({ id: board.id })],
    })
  })

  it('creates auth session and returns current user via /me', async () => {
    app = await buildApp({ origin: '*' })

    const session = await login('Azazel', 'editor')

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

  it('broadcasts realtime events for board clients over websocket', async () => {
    app = await buildApp({ origin: '*' })
    await app.listen({ host: '127.0.0.1', port: 0 })

    const owner = await login('Owner', 'owner')
    const createBoard = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { name: 'Realtime Board' },
    })
    const board = createBoard.json()

    const address = app.server.address() as AddressInfo
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws?token=${owner.token}`)
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
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
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

    const activityEventPromise = waitForRealtimeMessage(
      socket,
      (payload) =>
        typeof payload === 'object' &&
        payload !== null &&
        'event' in payload &&
        typeof payload.event === 'object' &&
        payload.event !== null &&
        'type' in payload.event &&
        payload.event.type === 'activity.update',
    )

    socket.send(JSON.stringify({ type: 'activity.update', boardId: board.id, dragging: true }))
    const activityEvent = (await activityEventPromise) as {
      event: {
        type: string
        payload: { boardId: string; userId: string; dragging: boolean }
      }
    }

    expect(activityEvent.event.type).toBe('activity.update')
    expect(activityEvent.event.payload.boardId).toBe(board.id)
    expect(activityEvent.event.payload.userId).toBe(owner.user.id)
    expect(activityEvent.event.payload.dragging).toBe(true)

    socket.close()
    await once(socket, 'close')
  })

  it('tracks websocket active connections and reconnect counter', async () => {
    app = await buildApp({ origin: '*' })
    await app.listen({ host: '127.0.0.1', port: 0 })

    const owner = await login('Owner', 'owner')
    const address = app.server.address() as AddressInfo

    const firstSocket = new WebSocket(`ws://127.0.0.1:${address.port}/ws?token=${owner.token}`)
    await once(firstSocket, 'open')

    const whileConnectedMetrics = await app.inject({ method: 'GET', url: '/metrics' })
    expect(metricValue(whileConnectedMetrics.body, 'syncboard_ws_active_connections')).toBe(1)
    expect(metricValue(whileConnectedMetrics.body, 'syncboard_ws_reconnect_total')).toBe(0)

    firstSocket.close()
    await once(firstSocket, 'close')
    await new Promise((resolve) => setTimeout(resolve, 10))

    const secondSocket = new WebSocket(`ws://127.0.0.1:${address.port}/ws?token=${owner.token}`)
    await once(secondSocket, 'open')

    const reconnectMetrics = await app.inject({ method: 'GET', url: '/metrics' })
    expect(metricValue(reconnectMetrics.body, 'syncboard_ws_active_connections')).toBe(1)
    expect(metricValue(reconnectMetrics.body, 'syncboard_ws_reconnect_total')).toBeGreaterThanOrEqual(1)

    secondSocket.close()
    await once(secondSocket, 'close')
    await new Promise((resolve) => setTimeout(resolve, 10))

    const finalMetrics = await app.inject({ method: 'GET', url: '/metrics' })
    expect(metricValue(finalMetrics.body, 'syncboard_ws_active_connections')).toBe(0)
  })

  it('replays missed board events on reconnect with fromSequence', async () => {
    app = await buildApp({ origin: '*' })
    await app.listen({ host: '127.0.0.1', port: 0 })

    const owner = await login('Owner', 'owner')
    const createBoard = await app.inject({
      method: 'POST',
      url: '/boards',
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { name: 'Replay board' },
    })
    const board = createBoard.json()

    const address = app.server.address() as AddressInfo

    const socketA = new WebSocket(`ws://127.0.0.1:${address.port}/ws?token=${owner.token}`)
    await once(socketA, 'open')
    socketA.send(JSON.stringify({ type: 'board.join', boardId: board.id }))

    await waitForRealtimeMessage(
      socketA,
      (payload) =>
        typeof payload === 'object' &&
        payload !== null &&
        'event' in payload &&
        typeof payload.event === 'object' &&
        payload.event !== null &&
        'type' in payload.event &&
        payload.event.type === 'presence.update',
    )

    const firstColumnEventPromise = waitForRealtimeMessage(
      socketA,
      (payload) =>
        typeof payload === 'object' &&
        payload !== null &&
        'event' in payload &&
        typeof payload.event === 'object' &&
        payload.event !== null &&
        'type' in payload.event &&
        payload.event.type === 'column.created' &&
        'payload' in payload.event &&
        typeof payload.event.payload === 'object' &&
        payload.event.payload !== null &&
        'title' in payload.event.payload &&
        payload.event.payload.title === 'First',
    )

    await app.inject({
      method: 'POST',
      url: `/boards/${board.id}/columns`,
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { title: 'First' },
    })
    const firstColumnEvent = (await firstColumnEventPromise) as { sequence: number }

    socketA.close()
    await once(socketA, 'close')
    await new Promise((resolve) => setTimeout(resolve, 10))

    await app.inject({
      method: 'POST',
      url: `/boards/${board.id}/columns`,
      headers: {
        authorization: `Bearer ${owner.token}`,
      },
      payload: { title: 'Second' },
    })

    const socketB = new WebSocket(`ws://127.0.0.1:${address.port}/ws?token=${owner.token}`)
    await once(socketB, 'open')
    socketB.send(
      JSON.stringify({
        type: 'board.join',
        boardId: board.id,
        fromSequence: firstColumnEvent.sequence,
      }),
    )

    const replayedEvent = (await waitForRealtimeMessage(
      socketB,
      (payload) =>
        typeof payload === 'object' &&
        payload !== null &&
        'event' in payload &&
        typeof payload.event === 'object' &&
        payload.event !== null &&
        'type' in payload.event &&
        payload.event.type === 'column.created' &&
        'payload' in payload.event &&
        typeof payload.event.payload === 'object' &&
        payload.event.payload !== null &&
        'title' in payload.event.payload &&
        payload.event.payload.title === 'Second',
    )) as {
      sequence: number
    }

    expect(replayedEvent.sequence).toBeGreaterThan(firstColumnEvent.sequence)

    socketB.close()
    await once(socketB, 'close')
  })
})

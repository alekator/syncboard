import { writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import WebSocket from 'ws'

import { buildApp } from '../app.js'

type BenchSession = {
  token: string
  user: {
    id: string
    role: 'owner' | 'editor' | 'viewer'
    name: string
  }
}

type WsBenchClient = {
  token: string
  userId: string
  socket: WebSocket
  latestSequence: number
}

type Stats = {
  min: number
  avg: number
  p50: number
  p95: number
  max: number
}

type RestBenchReport = {
  getBoardMs: Stats
  createCardMs: Stats
  moveCardMs: Stats
}

type WsScenarioReport = {
  clients: number
  joinMs: Stats
  broadcastTotalMs: number
  reconnectTotalMs: number
}

type BenchReport = {
  generatedAt: string
  config: {
    apiUrl: string
    wsUrl: string
    restIterations: number
    restConcurrency: number
    wsClientSet: number[]
  }
  rest: RestBenchReport
  ws: WsScenarioReport[]
}

const BOOT_API = process.env.BENCH_BOOT_API === '1'
const BOOT_PORT = Number(process.env.BENCH_BOOT_PORT ?? 3901)
const BENCH_OUTPUT_FILE = process.env.BENCH_OUTPUT_FILE

const REST_ITERATIONS = Number(process.env.BENCH_REST_ITERATIONS ?? 40)
const REST_CONCURRENCY = Number(process.env.BENCH_REST_CONCURRENCY ?? 8)
const RATE_LIMIT_MAX_RETRIES = Number(process.env.BENCH_RATE_LIMIT_MAX_RETRIES ?? 30)
const RATE_LIMIT_RETRY_FALLBACK_MS = Number(process.env.BENCH_RATE_LIMIT_RETRY_FALLBACK_MS ?? 1_000)
const DEFAULT_WS_CLIENTS = BOOT_API ? '20,50,100' : '10,20'
const WS_CLIENT_SET = (process.env.BENCH_WS_CLIENTS ?? DEFAULT_WS_CLIENTS)
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0)

let apiUrl = process.env.BENCH_API_URL ?? 'http://localhost:3001'
let wsUrl = process.env.BENCH_WS_URL ?? 'ws://localhost:3001/ws'

function percentile(sortedValues: number[], p: number) {
  if (sortedValues.length === 0) {
    return 0
  }

  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1))
  return sortedValues[index]
}

function stats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b)
  const total = values.reduce((sum, value) => sum + value, 0)

  return {
    min: sorted[0] ?? 0,
    avg: values.length ? total / values.length : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? 0,
  }
}

function formatMs(value: number) {
  return `${value.toFixed(2)}ms`
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function printStats(label: string, values: number[]) {
  const snapshot = stats(values)
  console.log(
    `${label.padEnd(32)} min=${formatMs(snapshot.min)} avg=${formatMs(snapshot.avg)} p50=${formatMs(snapshot.p50)} p95=${formatMs(snapshot.p95)} max=${formatMs(snapshot.max)}`,
  )
  return snapshot
}

async function requestJson<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(init?.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...(init?.headers ?? {}),
      },
    })

    if (response.ok) {
      if (response.status === 204) {
        return undefined as T
      }

      return (await response.json()) as T
    }

    if (response.status === 429 && attempt < RATE_LIMIT_MAX_RETRIES) {
      const retryAfterHeader = response.headers.get('retry-after')
      const retryAfterSec = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN
      const delayMs = Number.isFinite(retryAfterSec)
        ? Math.max(1_000, retryAfterSec * 1_000)
        : RATE_LIMIT_RETRY_FALLBACK_MS

      if (attempt === 0) {
        console.warn(`Rate limited on ${init?.method ?? 'GET'} ${path}; retrying with backoff...`)
      }

      await sleep(delayMs)
      continue
    }

    const payload = await response.text()
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${response.status} ${payload}`)
  }
}

async function login(name: string, role: 'owner' | 'editor' | 'viewer' = 'editor') {
  return requestJson<BenchSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, role }),
  })
}

async function createBoard(ownerToken: string, name: string) {
  return requestJson<{ id: string; name: string }>('/boards', {
    method: 'POST',
    token: ownerToken,
    body: JSON.stringify({ name }),
  })
}

async function createColumn(ownerToken: string, boardId: string, title: string) {
  return requestJson<{ id: string; boardId: string; title: string }>(`/boards/${boardId}/columns`, {
    method: 'POST',
    token: ownerToken,
    body: JSON.stringify({ title }),
  })
}

async function createCard(ownerToken: string, columnId: string, title: string) {
  return requestJson<{ id: string; columnId: string; boardId: string }>(`/columns/${columnId}/cards`, {
    method: 'POST',
    token: ownerToken,
    body: JSON.stringify({ title, description: 'bench' }),
  })
}

async function addBoardMember(ownerToken: string, boardId: string, userId: string, role: 'owner' | 'editor' | 'viewer') {
  return requestJson<void>(`/boards/${boardId}/members`, {
    method: 'POST',
    token: ownerToken,
    body: JSON.stringify({ userId, role }),
  })
}

async function runWithConcurrency<T>(total: number, concurrency: number, task: (index: number) => Promise<T>) {
  let cursor = 0
  const workers = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= total) {
        return
      }
      await task(index)
    }
  })

  await Promise.all(workers)
}

async function connectWs(token: string) {
  const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket open timeout')), 10_000)
    socket.once('open', () => {
      clearTimeout(timeout)
      resolve()
    })
    socket.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
  return socket
}

async function waitForMessage<T>(socket: WebSocket, predicate: (payload: unknown) => payload is T, timeoutMs = 10_000) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('message', onMessage)
      reject(new Error('Timed out waiting for message'))
    }, timeoutMs)

    const onMessage = (raw: WebSocket.RawData) => {
      const text = typeof raw === 'string' ? raw : raw.toString('utf-8')
      try {
        const payload = JSON.parse(text) as unknown
        if (predicate(payload)) {
          clearTimeout(timeout)
          socket.off('message', onMessage)
          resolve(payload)
        }
      } catch {
        // Ignore malformed frames.
      }
    }

    socket.on('message', onMessage)
  })
}

async function runRestBench(ownerToken: string, boardId: string, columnId: string): Promise<RestBenchReport> {
  console.log('\nREST scenarios')
  const readLatencies: number[] = []
  await runWithConcurrency(REST_ITERATIONS, REST_CONCURRENCY, async () => {
    const startedAt = performance.now()
    await requestJson(`/boards/${boardId}`, { method: 'GET', token: ownerToken })
    readLatencies.push(performance.now() - startedAt)
  })
  const getBoardMs = printStats(`GET /boards/:id x${REST_ITERATIONS}`, readLatencies)

  const createdCardIds: string[] = []
  const createLatencies: number[] = []
  await runWithConcurrency(REST_ITERATIONS, REST_CONCURRENCY, async (index) => {
    const startedAt = performance.now()
    const card = await createCard(ownerToken, columnId, `bench-card-${index}`)
    createLatencies.push(performance.now() - startedAt)
    createdCardIds.push(card.id)
  })
  const createCardMs = printStats(`POST /columns/:id/cards x${REST_ITERATIONS}`, createLatencies)

  const moveLatencies: number[] = []
  await runWithConcurrency(createdCardIds.length, REST_CONCURRENCY, async (index) => {
    const startedAt = performance.now()
    await requestJson(`/cards/${createdCardIds[index]}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ position: 2_000 + index }),
    })
    moveLatencies.push(performance.now() - startedAt)
  })
  const moveCardMs = printStats(`PATCH /cards/:id (move) x${createdCardIds.length}`, moveLatencies)

  return {
    getBoardMs,
    createCardMs,
    moveCardMs,
  }
}

async function runWsBench(owner: BenchSession, boardId: string, clientsCount: number): Promise<WsScenarioReport> {
  const users: BenchSession[] = [owner]
  for (let index = 1; index < clientsCount; index += 1) {
    const session = await login(`bench-user-${clientsCount}-${index}`, 'editor')
    users.push(session)
    await addBoardMember(owner.token, boardId, session.user.id, 'editor')
  }

  const clients: WsBenchClient[] = []
  const joinLatencies: number[] = []

  for (const session of users) {
    const socket = await connectWs(session.token)
    const startedAt = performance.now()
    socket.send(JSON.stringify({ type: 'board.join', boardId }))
    const presence = await waitForMessage(
      socket,
      (payload): payload is { sequence: number; event: { type: string; payload: { userId: string } } } =>
        typeof payload === 'object' &&
        payload !== null &&
        'event' in payload &&
        typeof payload.event === 'object' &&
        payload.event !== null &&
        'type' in payload.event &&
        payload.event.type === 'presence.update' &&
        'payload' in payload.event &&
        typeof payload.event.payload === 'object' &&
        payload.event.payload !== null &&
        'userId' in payload.event.payload &&
        payload.event.payload.userId === session.user.id,
    )
    joinLatencies.push(performance.now() - startedAt)
    clients.push({
      token: session.token,
      userId: session.user.id,
      socket,
      latestSequence: presence.sequence,
    })

    socket.on('message', (raw) => {
      const text = typeof raw === 'string' ? raw : raw.toString('utf-8')
      try {
        const payload = JSON.parse(text) as { sequence?: number }
        if (typeof payload.sequence === 'number') {
          const target = clients.find((item) => item.socket === socket)
          if (target) {
            target.latestSequence = Math.max(target.latestSequence, payload.sequence)
          }
        }
      } catch {
        // Ignore malformed frames.
      }
    })
  }

  const joinMs = printStats(`WS connect+join (${clientsCount} clients)`, joinLatencies)

  const source = clients[0]
  const broadcastStartedAt = performance.now()
  source.socket.send(JSON.stringify({ type: 'activity.update', boardId, dragging: true }))

  await Promise.all(
    clients.map((client) =>
      waitForMessage(
        client.socket,
        (payload): payload is { event: { type: string; payload: { userId: string } } } =>
          typeof payload === 'object' &&
          payload !== null &&
          'event' in payload &&
          typeof payload.event === 'object' &&
          payload.event !== null &&
          'type' in payload.event &&
          payload.event.type === 'activity.update' &&
          'payload' in payload.event &&
          typeof payload.event.payload === 'object' &&
          payload.event.payload !== null &&
          'userId' in payload.event.payload &&
          payload.event.payload.userId === source.userId,
      ),
    ),
  )

  const broadcastTotalMs = performance.now() - broadcastStartedAt
  console.log(`WS broadcast fanout (${clientsCount} clients)`.padEnd(32) + ` total=${formatMs(broadcastTotalMs)}`)

  for (const client of clients) {
    client.socket.close()
    await onceClosed(client.socket)
  }

  const reconnectStartedAt = performance.now()
  for (const client of clients) {
    const socket = await connectWs(client.token)
    const fromSequence = client.latestSequence
    socket.send(JSON.stringify({ type: 'board.join', boardId, fromSequence }))
    await waitForMessage(
      socket,
      (payload): payload is { event: { type: string; payload: { userId: string } } } =>
        typeof payload === 'object' &&
        payload !== null &&
        'event' in payload &&
        typeof payload.event === 'object' &&
        payload.event !== null &&
        'type' in payload.event &&
        payload.event.type === 'presence.update' &&
        'payload' in payload.event &&
        typeof payload.event.payload === 'object' &&
        payload.event.payload !== null &&
        'userId' in payload.event.payload &&
        payload.event.payload.userId === client.userId,
    )
    client.socket = socket
  }
  const reconnectTotalMs = performance.now() - reconnectStartedAt
  console.log(`WS reconnect burst (${clientsCount})`.padEnd(32) + ` total=${formatMs(reconnectTotalMs)}`)

  for (const client of clients) {
    client.socket.close()
    await onceClosed(client.socket)
  }

  return {
    clients: clientsCount,
    joinMs,
    broadcastTotalMs,
    reconnectTotalMs,
  }
}

async function onceClosed(socket: WebSocket) {
  if (socket.readyState === WebSocket.CLOSED) {
    return
  }

  await new Promise<void>((resolve) => {
    socket.once('close', () => resolve())
  })
}

async function run() {
  let bootedApp: Awaited<ReturnType<typeof buildApp>> | null = null

  try {
    if (BOOT_API) {
      process.env.PERSISTENCE_MODE = 'memory'
      process.env.APP_ORIGIN = '*'

      bootedApp = await buildApp({
        origin: '*',
        rateLimitConfig: {
          auth: { windowMs: 60_000, max: 10_000 },
          mutation: { windowMs: 60_000, max: 100_000 },
          ws: { windowMs: 60_000, max: 10_000 },
        },
      })
      await bootedApp.listen({ host: '127.0.0.1', port: BOOT_PORT })
      apiUrl = `http://127.0.0.1:${BOOT_PORT}`
      wsUrl = `ws://127.0.0.1:${BOOT_PORT}/ws`
      console.log(`Booted benchmark API at ${apiUrl}`)
    }

    console.log('SyncBoard benchmark')
    console.log(`API: ${apiUrl}`)
    console.log(`WS: ${wsUrl}`)
    console.log(`REST iterations: ${REST_ITERATIONS}, concurrency: ${REST_CONCURRENCY}`)
    console.log(`WS clients scenarios: ${WS_CLIENT_SET.join(', ')}`)

    const owner = await login('bench-owner', 'owner')
    const board = await createBoard(owner.token, `Bench Board ${Date.now()}`)
    const column = await createColumn(owner.token, board.id, 'Bench Column')

    const rest = await runRestBench(owner.token, board.id, column.id)

    console.log('\nWebSocket scenarios')
    const wsReports: WsScenarioReport[] = []
    for (const clientsCount of WS_CLIENT_SET) {
      wsReports.push(await runWsBench(owner, board.id, clientsCount))
    }

    const report: BenchReport = {
      generatedAt: new Date().toISOString(),
      config: {
        apiUrl,
        wsUrl,
        restIterations: REST_ITERATIONS,
        restConcurrency: REST_CONCURRENCY,
        wsClientSet: WS_CLIENT_SET,
      },
      rest,
      ws: wsReports,
    }

    if (BENCH_OUTPUT_FILE) {
      await writeFile(BENCH_OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf-8')
      console.log(`\nBench JSON report written to ${BENCH_OUTPUT_FILE}`)
    }

    console.log('\nBenchmark run completed.')
    console.log('BENCH_REPORT_JSON_START')
    console.log(JSON.stringify(report))
    console.log('BENCH_REPORT_JSON_END')
  } finally {
    if (bootedApp) {
      await bootedApp.close()
    }
  }
}

run().catch((error) => {
  console.error('Benchmark failed')
  console.error(error)
  process.exitCode = 1
})

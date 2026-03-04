import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import { z } from 'zod'

import { InMemoryBoardStore } from './domain/board-store.js'
import { InMemorySessionStore } from './auth/session-store.js'
import { RealtimeHub } from './realtime/realtime-hub.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerBoardRoutes } from './routes/boards.js'
import { registerHealthRoute } from './routes/health.js'
import { registerRealtimeRoutes } from './routes/realtime.js'

const APP_ORIGIN_SCHEMA = z.string().min(1).default('*')

type BuildAppOptions = {
  origin?: string
  boardStore?: InMemoryBoardStore
  realtimeHub?: RealtimeHub
  sessionStore?: InMemorySessionStore
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: true,
  })

  const origin = APP_ORIGIN_SCHEMA.parse(options.origin ?? process.env.APP_ORIGIN)
  const boardStore = options.boardStore ?? new InMemoryBoardStore()
  const realtimeHub = options.realtimeHub ?? new RealtimeHub()
  const sessionStore = options.sessionStore ?? new InMemorySessionStore()

  await app.register(cors, { origin })
  await app.register(websocket)
  await registerHealthRoute(app)
  await registerAuthRoutes(app, sessionStore)
  await registerRealtimeRoutes(app, realtimeHub)
  await registerBoardRoutes(app, boardStore, realtimeHub)

  return app
}

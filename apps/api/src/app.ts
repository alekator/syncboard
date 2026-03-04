import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { PrismaClient } from '@prisma/client'
import Fastify from 'fastify'
import { z } from 'zod'

import { InMemoryBoardStore } from './domain/board-store.js'
import { InMemorySessionStore } from './auth/session-store.js'
import { resolvePersistenceConfig } from './config/persistence.js'
import { RealtimeHub } from './realtime/realtime-hub.js'
import { PrismaBoardStore } from './infrastructure/prisma/prisma-board-store.js'
import { PrismaSessionStore } from './infrastructure/prisma/prisma-session-store.js'
import { createRedisClient } from './infrastructure/redis/redis-client.js'
import { RedisPresenceStore } from './infrastructure/redis/redis-presence-store.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerBoardRoutes } from './routes/boards.js'
import { registerHealthRoute } from './routes/health.js'
import { registerRealtimeRoutes } from './routes/realtime.js'
import type { BoardStore } from './domain/board-store.js'
import type { SessionStore } from './auth/session-store.js'
import type { PresenceStore } from './realtime/presence-store.js'

const APP_ORIGIN_SCHEMA = z.string().min(1).default('*')

type BuildAppOptions = {
  origin?: string
  boardStore?: BoardStore
  realtimeHub?: RealtimeHub
  sessionStore?: SessionStore
  presenceStore?: PresenceStore
}

export async function buildApp(options: BuildAppOptions = {}) {
  const persistenceConfig = resolvePersistenceConfig()

  const app = Fastify({
    logger: true,
  })

  const origin = APP_ORIGIN_SCHEMA.parse(options.origin ?? process.env.APP_ORIGIN)
  let boardStore = options.boardStore ?? new InMemoryBoardStore()
  let presenceStore = options.presenceStore
  let sessionStore = options.sessionStore ?? new InMemorySessionStore()

  if (!presenceStore && persistenceConfig.redisUrl) {
    const redis = createRedisClient(persistenceConfig.redisUrl)
    presenceStore = new RedisPresenceStore(redis)

    app.addHook('onClose', async () => {
      await redis.quit()
    })

    app.log.info('Redis presence store enabled')
  }

  const realtimeHub = options.realtimeHub ?? new RealtimeHub(presenceStore)

  app.log.info({ mode: persistenceConfig.mode }, 'Persistence mode resolved')
  if (
    persistenceConfig.mode === 'postgres' &&
    !options.boardStore &&
    !options.sessionStore &&
    persistenceConfig.databaseUrl
  ) {
    process.env.DATABASE_URL = persistenceConfig.databaseUrl

    const prisma = new PrismaClient()
    await prisma.$connect()

    app.addHook('onClose', async () => {
      await prisma.$disconnect()
    })

    boardStore = new PrismaBoardStore(prisma)
    sessionStore = new PrismaSessionStore(prisma)
    app.log.info('Postgres repositories enabled')
  } else if (persistenceConfig.mode === 'postgres' && !persistenceConfig.databaseUrl) {
    app.log.warn('Postgres mode requested without DATABASE_URL; falling back to memory repositories.')
  }

  await app.register(cors, {
    origin,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  await app.register(websocket)
  await registerHealthRoute(app)
  await registerAuthRoutes(app, sessionStore)
  await registerRealtimeRoutes(app, realtimeHub)
  await registerBoardRoutes(app, boardStore, realtimeHub)

  return app
}

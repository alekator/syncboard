import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import { z } from 'zod'

import { InMemoryBoardStore } from './domain/board-store.js'
import { InMemorySessionStore } from './auth/session-store.js'
import {
  DEFAULT_RATE_LIMIT_CONFIG,
  InMemoryRateLimiter,
  resolveRequestScope,
  type RateLimitConfig,
} from './auth/rate-limit.js'
import { resolvePersistenceConfig } from './config/persistence.js'
import { RealtimeHub } from './realtime/realtime-hub.js'
import { PrismaBoardStore } from './infrastructure/prisma/prisma-board-store.js'
import { PrismaRealtimeReplayStore } from './infrastructure/prisma/prisma-realtime-replay-store.js'
import { PrismaSessionStore } from './infrastructure/prisma/prisma-session-store.js'
import { createRedisClient } from './infrastructure/redis/redis-client.js'
import { RedisPresenceStore } from './infrastructure/redis/redis-presence-store.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerBoardRoutes } from './routes/boards.js'
import { registerHealthRoute } from './routes/health.js'
import { registerMetricsRoute } from './routes/metrics.js'
import { registerRealtimeRoutes } from './routes/realtime.js'
import { MetricsRegistry } from './observability/metrics.js'
import { InMemoryRealtimeReplayStore } from './realtime/replay-store.js'
import { registerIdempotencyHooks } from './idempotency/plugin.js'
import { InMemoryIdempotencyStore } from './idempotency/store.js'
import type { BoardStore } from './domain/board-store.js'
import type { SessionStore } from './auth/session-store.js'
import type { PresenceStore } from './realtime/presence-store.js'
import type { RealtimeReplayStore } from './realtime/replay-store.js'
import type { PrismaClient as PrismaClientType } from '@prisma/client'

const APP_ORIGIN_SCHEMA = z.string().min(1).default('*')

type PrismaClientModuleLike = {
  PrismaClient?: new () => PrismaClientType
  default?: {
    PrismaClient?: new () => PrismaClientType
  }
}

type BuildAppOptions = {
  origin?: string
  boardStore?: BoardStore
  realtimeHub?: RealtimeHub
  sessionStore?: SessionStore
  presenceStore?: PresenceStore
  rateLimitConfig?: Partial<RateLimitConfig>
}

export async function buildApp(options: BuildAppOptions = {}) {
  const persistenceConfig = resolvePersistenceConfig()
  const metrics = new MetricsRegistry()
  const idempotencyStore = new InMemoryIdempotencyStore()
  const rateLimitConfig: RateLimitConfig = {
    ...DEFAULT_RATE_LIMIT_CONFIG,
    ...options.rateLimitConfig,
  }
  const rateLimiter = new InMemoryRateLimiter(rateLimitConfig)

  const app = Fastify({
    logger: true,
  })

  const origin = APP_ORIGIN_SCHEMA.parse(options.origin ?? process.env.APP_ORIGIN)
  let boardStore = options.boardStore ?? new InMemoryBoardStore()
  let presenceStore = options.presenceStore
  let sessionStore = options.sessionStore ?? new InMemorySessionStore()
  let replayStore: RealtimeReplayStore = new InMemoryRealtimeReplayStore()

  if (!presenceStore && persistenceConfig.redisUrl) {
    const redis = createRedisClient(persistenceConfig.redisUrl)
    presenceStore = new RedisPresenceStore(redis)

    app.addHook('onClose', async () => {
      await redis.quit()
    })

    app.log.info('Redis presence store enabled')
  }

  app.log.info({ mode: persistenceConfig.mode }, 'Persistence mode resolved')
  if (
    persistenceConfig.mode === 'postgres' &&
    !options.boardStore &&
    !options.sessionStore &&
    persistenceConfig.databaseUrl
  ) {
    process.env.DATABASE_URL = persistenceConfig.databaseUrl

    const prismaClientModule = (await import('@prisma/client')) as PrismaClientModuleLike
    const PrismaClientCtor = prismaClientModule.PrismaClient ?? prismaClientModule.default?.PrismaClient

    if (!PrismaClientCtor) {
      throw new Error('Unable to resolve PrismaClient export from @prisma/client')
    }

    const prisma = new PrismaClientCtor()
    await prisma.$connect()

    app.addHook('onClose', async () => {
      await prisma.$disconnect()
    })

    boardStore = new PrismaBoardStore(prisma)
    sessionStore = new PrismaSessionStore(prisma)
    replayStore = new PrismaRealtimeReplayStore(prisma)
    app.log.info('Postgres repositories enabled')
  } else if (persistenceConfig.mode === 'postgres' && !persistenceConfig.databaseUrl) {
    app.log.warn('Postgres mode requested without DATABASE_URL; falling back to memory repositories.')
  }

  const realtimeHub = options.realtimeHub ?? new RealtimeHub(presenceStore, replayStore)

  await app.register(cors, {
    origin,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  registerIdempotencyHooks(app, idempotencyStore)

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id)
  })

  app.addHook('onResponse', async (request, reply) => {
    if (reply.statusCode === 403) {
      metrics.incrementCounter('forbiddenTotal')
    }

    const isMutationMethod = request.method === 'POST' || request.method === 'PATCH' || request.method === 'DELETE'
    if (isMutationMethod && reply.statusCode >= 400) {
      metrics.incrementCounter('failedMutationsTotal')
    }
  })

  await app.register(websocket)
  await registerHealthRoute(app)
  await registerMetricsRoute(app, metrics)
  await registerAuthRoutes(app, sessionStore)
  app.addHook('preHandler', async (request, reply) => {
    const isMutation = request.method === 'POST' || request.method === 'PATCH' || request.method === 'DELETE'
    const isAuthLogin = request.method === 'POST' && request.url === '/auth/login'

    if (isAuthLogin) {
      const result = rateLimiter.consume('auth', request.ip)
      if (!result.allowed) {
        reply.header('retry-after', String(result.retryAfterSec))
        return reply.status(429).send({ message: 'Rate limit exceeded for auth requests' })
      }
      return
    }

    if (!isMutation || request.url.startsWith('/auth/')) {
      return
    }

    const result = rateLimiter.consume('mutation', resolveRequestScope(request))
    if (!result.allowed) {
      reply.header('retry-after', String(result.retryAfterSec))
      return reply.status(429).send({ message: 'Rate limit exceeded for mutation requests' })
    }
  })
  await registerRealtimeRoutes(app, realtimeHub, sessionStore, boardStore, metrics, rateLimiter)
  await registerBoardRoutes(app, boardStore, realtimeHub, sessionStore)

  return app
}

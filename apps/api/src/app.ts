import cors from '@fastify/cors'
import Fastify from 'fastify'
import { z } from 'zod'

import { InMemoryBoardStore } from './domain/board-store.js'
import { registerBoardRoutes } from './routes/boards.js'
import { registerHealthRoute } from './routes/health.js'

const APP_ORIGIN_SCHEMA = z.string().min(1).default('*')

type BuildAppOptions = {
  origin?: string
  boardStore?: InMemoryBoardStore
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: true,
  })

  const origin = APP_ORIGIN_SCHEMA.parse(options.origin ?? process.env.APP_ORIGIN)
  const boardStore = options.boardStore ?? new InMemoryBoardStore()

  await app.register(cors, { origin })
  await registerHealthRoute(app)
  await registerBoardRoutes(app, boardStore)

  return app
}

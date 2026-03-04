import cors from '@fastify/cors'
import Fastify from 'fastify'
import { z } from 'zod'

import { registerHealthRoute } from './routes/health.js'

const APP_ORIGIN_SCHEMA = z.string().min(1).default('*')

type BuildAppOptions = {
  origin?: string
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: true,
  })

  const origin = APP_ORIGIN_SCHEMA.parse(options.origin ?? process.env.APP_ORIGIN)

  await app.register(cors, { origin })
  await registerHealthRoute(app)

  return app
}

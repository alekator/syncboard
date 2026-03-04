import { z } from 'zod'

import { buildApp } from './app.js'

const PORT_SCHEMA = z.coerce.number().int().min(1).max(65535).default(3001)
const HOST_SCHEMA = z.string().min(1).default('0.0.0.0')

async function startServer() {
  const app = await buildApp()

  const port = PORT_SCHEMA.parse(process.env.PORT)
  const host = HOST_SCHEMA.parse(process.env.HOST)

  try {
    await app.listen({ port, host })
  } catch (error) {
    app.log.error(error, 'Failed to start server')
    process.exit(1)
  }
}

void startServer()

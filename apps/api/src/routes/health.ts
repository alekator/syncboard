import type { FastifyInstance } from 'fastify'

const HEALTH_RESPONSE = {
  status: 'ok',
} as const

export async function registerHealthRoute(app: FastifyInstance) {
  app.get('/health', async () => HEALTH_RESPONSE)
}

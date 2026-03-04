import type { FastifyInstance } from 'fastify'
import { loginBodySchema } from '@syncboard/shared'

import type { InMemorySessionStore } from '../auth/session-store.js'

function extractBearerToken(authorization: string | undefined) {
  if (!authorization) {
    return null
  }

  const [scheme, token] = authorization.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  sessionStore: InMemorySessionStore,
) {
  app.decorateRequest('authUser', null)

  app.addHook('preHandler', async (request) => {
    const token = extractBearerToken(request.headers.authorization)
    request.authUser = token ? sessionStore.getUserByToken(token) : null
  })

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Invalid login payload' })
    }

    const session = sessionStore.createSession(parsed.data)
    return reply.status(200).send(session)
  })

  app.get('/me', async (request, reply) => {
    if (!request.authUser) {
      return reply.status(401).send({ message: 'Unauthorized' })
    }

    return { user: request.authUser }
  })
}

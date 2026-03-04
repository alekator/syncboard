import type { AuthUser } from '@syncboard/shared'

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser | null
  }
}

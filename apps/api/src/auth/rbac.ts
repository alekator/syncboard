import type { FastifyReply, FastifyRequest } from 'fastify'
import type { AuthUser, BoardRole } from '@syncboard/shared'

export function requireAuth(request: FastifyRequest, reply: FastifyReply): AuthUser | null {
  if (!request.authUser) {
    reply.status(401).send({ message: 'Unauthorized' })
    return null
  }

  return request.authUser
}

export function requireWriteRole(role: BoardRole, reply: FastifyReply) {
  if (role === 'viewer') {
    reply.status(403).send({ message: 'Forbidden: viewer role cannot modify board state' })
    return false
  }

  return true
}

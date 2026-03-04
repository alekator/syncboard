import type { FastifyReply, FastifyRequest } from 'fastify'
import { boardRoleSchema, type BoardRole } from '@syncboard/shared'

const ROLE_HEADER_NAME = 'x-syncboard-role'

export function getRequestRole(request: FastifyRequest): BoardRole {
  if (request.authUser) {
    return request.authUser.role
  }

  const raw = request.headers[ROLE_HEADER_NAME]
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = boardRoleSchema.safeParse(value)

  if (parsed.success) {
    return parsed.data
  }

  return 'owner'
}

export function requireWriteRole(request: FastifyRequest, reply: FastifyReply) {
  const role = getRequestRole(request)
  if (role === 'viewer') {
    reply.status(403).send({ message: 'Forbidden: viewer role cannot modify board state' })
    return false
  }

  return true
}

import { createHash } from 'node:crypto'

import type { FastifyInstance, FastifyRequest } from 'fastify'

import type { IdempotencyStore } from './store.js'

const IDEMPOTENCY_HEADER = 'idempotency-key'
const MUTATION_METHODS = new Set(['POST', 'PATCH', 'DELETE'])

function serializeBody(body: unknown) {
  if (body === undefined) {
    return ''
  }

  return JSON.stringify(body)
}

function buildFingerprint(request: FastifyRequest) {
  const payload = `${request.method}:${request.url}:${serializeBody(request.body)}`
  return createHash('sha256').update(payload).digest('hex')
}

function toStringPayload(payload: unknown) {
  if (typeof payload === 'string') {
    return payload
  }
  if (Buffer.isBuffer(payload)) {
    return payload.toString('utf-8')
  }
  return JSON.stringify(payload)
}

function isAuthRoute(url: string) {
  return url.startsWith('/auth/')
}

export function registerIdempotencyHooks(app: FastifyInstance, store: IdempotencyStore) {
  app.addHook('preHandler', async (request, reply) => {
    if (!MUTATION_METHODS.has(request.method)) {
      return
    }

    if (isAuthRoute(request.url)) {
      return
    }

    const key = request.headers[IDEMPOTENCY_HEADER]
    const idempotencyKey = Array.isArray(key) ? key[0] : key
    if (!idempotencyKey) {
      return
    }

    const authScope = request.authUser?.id ?? 'anonymous'
    const scopedKey = `${authScope}:${idempotencyKey}`
    const fingerprint = buildFingerprint(request)
    const begin = store.begin(scopedKey, fingerprint)

    if (begin.kind === 'conflict') {
      return reply.status(409).send({
        message: 'Idempotency key reuse with different request payload is not allowed',
      })
    }

    if (begin.kind === 'inflight') {
      return reply.status(409).send({
        message: 'A request with this idempotency key is already in progress',
      })
    }

    if (begin.kind === 'replay') {
      reply.header('x-idempotent-replay', 'true')
      if (begin.response.contentType) {
        reply.type(begin.response.contentType)
      }
      return reply.status(begin.response.statusCode).send(begin.response.payload)
    }

    request.idempotencyContext = {
      scopedKey,
      fingerprint,
    }
  })

  app.addHook('onSend', async (request, reply, payload) => {
    const context = request.idempotencyContext
    if (!context) {
      return payload
    }

    const payloadText = toStringPayload(payload)
    store.commit(context.scopedKey, context.fingerprint, {
      statusCode: reply.statusCode,
      payload: payloadText,
      contentType: typeof reply.getHeader('content-type') === 'string' ? String(reply.getHeader('content-type')) : undefined,
    })
    return payload
  })

  app.addHook('onError', async (request) => {
    const context = request.idempotencyContext
    if (!context) {
      return
    }

    store.release(context.scopedKey, context.fingerprint)
  })
}

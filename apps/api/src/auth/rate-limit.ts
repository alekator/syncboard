import type { FastifyRequest } from 'fastify'

export type RateLimitBucket = 'auth' | 'mutation' | 'ws'

export type RateLimitRule = {
  windowMs: number
  max: number
}

export type RateLimitConfig = Record<RateLimitBucket, RateLimitRule>

export type RateLimitConsumeResult = {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  auth: {
    windowMs: 60_000,
    max: 20,
  },
  mutation: {
    windowMs: 60_000,
    max: 120,
  },
  ws: {
    windowMs: 60_000,
    max: 60,
  },
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

export class InMemoryRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>()

  constructor(private readonly config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG) {}

  consume(bucket: RateLimitBucket, scopeKey: string, now = Date.now()): RateLimitConsumeResult {
    this.cleanup(now)

    const rule = this.config[bucket]
    const compoundKey = `${bucket}:${scopeKey}`
    const existing = this.entries.get(compoundKey)

    if (!existing || existing.resetAt <= now) {
      this.entries.set(compoundKey, {
        count: 1,
        resetAt: now + rule.windowMs,
      })

      return {
        allowed: true,
        remaining: Math.max(0, rule.max - 1),
        retryAfterSec: 0,
      }
    }

    if (existing.count >= rule.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      }
    }

    existing.count += 1
    this.entries.set(compoundKey, existing)

    return {
      allowed: true,
      remaining: Math.max(0, rule.max - existing.count),
      retryAfterSec: 0,
    }
  }

  private cleanup(now: number) {
    for (const [key, value] of this.entries.entries()) {
      if (value.resetAt <= now) {
        this.entries.delete(key)
      }
    }
  }
}

export function resolveRequestScope(request: FastifyRequest) {
  return request.authUser?.id ?? request.ip
}

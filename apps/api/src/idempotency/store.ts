export type IdempotencyStoredResponse = {
  statusCode: number
  payload: string
  contentType?: string
}

type IdempotencyState =
  | { kind: 'inflight'; fingerprint: string; updatedAt: number }
  | { kind: 'done'; fingerprint: string; updatedAt: number; response: IdempotencyStoredResponse }

export type IdempotencyBeginResult =
  | { kind: 'started' }
  | { kind: 'inflight' }
  | { kind: 'conflict' }
  | { kind: 'replay'; response: IdempotencyStoredResponse }

export interface IdempotencyStore {
  begin(scopedKey: string, fingerprint: string): IdempotencyBeginResult
  commit(scopedKey: string, fingerprint: string, response: IdempotencyStoredResponse): void
  release(scopedKey: string, fingerprint: string): void
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyState>()

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {}

  begin(scopedKey: string, fingerprint: string): IdempotencyBeginResult {
    this.cleanupExpired()

    const existing = this.records.get(scopedKey)
    if (!existing) {
      this.records.set(scopedKey, { kind: 'inflight', fingerprint, updatedAt: Date.now() })
      return { kind: 'started' }
    }

    if (existing.fingerprint !== fingerprint) {
      return { kind: 'conflict' }
    }

    if (existing.kind === 'done') {
      return { kind: 'replay', response: existing.response }
    }

    return { kind: 'inflight' }
  }

  commit(scopedKey: string, fingerprint: string, response: IdempotencyStoredResponse): void {
    const existing = this.records.get(scopedKey)
    if (!existing || existing.fingerprint !== fingerprint) {
      return
    }

    this.records.set(scopedKey, {
      kind: 'done',
      fingerprint,
      updatedAt: Date.now(),
      response,
    })
  }

  release(scopedKey: string, fingerprint: string): void {
    const existing = this.records.get(scopedKey)
    if (!existing || existing.fingerprint !== fingerprint || existing.kind !== 'inflight') {
      return
    }

    this.records.delete(scopedKey)
  }

  private cleanupExpired() {
    const now = Date.now()
    for (const [key, value] of this.records.entries()) {
      if (now - value.updatedAt > this.ttlMs) {
        this.records.delete(key)
      }
    }
  }
}

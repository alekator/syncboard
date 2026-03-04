import type { Redis } from 'ioredis'

import type { PresenceStore } from '../../realtime/presence-store.js'

const PRESENCE_KEY_PREFIX = 'syncboard:presence'

function presenceKey(boardId: string) {
  return `${PRESENCE_KEY_PREFIX}:${boardId}`
}

export class RedisPresenceStore implements PresenceStore {
  constructor(private readonly redis: Redis) {}

  async markOnline(boardId: string, userId: string) {
    await this.redis.sadd(presenceKey(boardId), userId)
  }

  async markOffline(boardId: string, userId: string) {
    await this.redis.srem(presenceKey(boardId), userId)
  }

  async listOnline(boardId: string) {
    const members: string[] = await this.redis.smembers(presenceKey(boardId))
    return members.sort((a, b) => a.localeCompare(b))
  }
}

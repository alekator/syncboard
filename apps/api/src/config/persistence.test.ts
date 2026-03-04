import { describe, expect, it } from 'vitest'

import { resolvePersistenceConfig } from './persistence.js'

describe('resolvePersistenceConfig', () => {
  it('uses memory mode by default', () => {
    const config = resolvePersistenceConfig({})

    expect(config.mode).toBe('memory')
    expect(config.usesDatabase).toBe(false)
  })

  it('resolves postgres mode from env', () => {
    const config = resolvePersistenceConfig({
      PERSISTENCE_MODE: 'postgres',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/syncboard',
      REDIS_URL: 'redis://localhost:6379',
    })

    expect(config.mode).toBe('postgres')
    expect(config.databaseUrl).toContain('postgresql://')
    expect(config.redisUrl).toContain('redis://')
    expect(config.usesDatabase).toBe(true)
  })
})

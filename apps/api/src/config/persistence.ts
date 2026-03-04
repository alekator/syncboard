import { z } from 'zod'

const PERSISTENCE_MODE_SCHEMA = z.enum(['memory', 'postgres']).default('memory')

const DATABASE_URL_SCHEMA = z.string().trim().min(1).optional()
const REDIS_URL_SCHEMA = z.string().trim().min(1).optional()

function normalizeMode(value: string | undefined) {
  if (!value) {
    return undefined
  }

  return value.trim().toLowerCase()
}

export function resolvePersistenceConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = PERSISTENCE_MODE_SCHEMA.parse(normalizeMode(env.PERSISTENCE_MODE))
  const databaseUrl = DATABASE_URL_SCHEMA.parse(env.DATABASE_URL)
  const redisUrl = REDIS_URL_SCHEMA.parse(env.REDIS_URL)

  return {
    mode,
    databaseUrl,
    redisUrl,
    usesDatabase: mode === 'postgres',
  }
}

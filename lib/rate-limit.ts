import { createHash } from 'node:crypto'
import { prisma } from './db'

type RateLimitEntry = {
  count: number
  resetAt: number
}

type DatabaseRateLimitEntry = {
  count: number
  resetAt: Date
}

const buckets = new Map<string, RateLimitEntry>()
let nextDatabaseCleanupAt = 0

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  backend: 'redis' | 'postgres' | 'memory'
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super('Rate limit backend unavailable')
  }
}

function hashRateLimitKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

async function redisCommand<T>(command: unknown[]): Promise<T> {
  const config = getRedisConfig()
  if (!config) throw new RateLimitUnavailableError()

  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command]),
    cache: 'no-store',
  })

  if (!response.ok) throw new RateLimitUnavailableError()

  const data = (await response.json()) as Array<{ result?: T; error?: string }>
  if (!data[0] || data[0].error) throw new RateLimitUnavailableError()

  return data[0].result as T
}

async function redisRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redisKey = `rate-limit:${hashRateLimitKey(key)}`
  const windowSeconds = Math.ceil(windowMs / 1000)
  const count = Number(await redisCommand<number>(['INCR', redisKey]))

  if (count === 1) {
    await redisCommand(['EXPIRE', redisKey, windowSeconds])
  }

  const ttl = Math.max(0, Number(await redisCommand<number>(['TTL', redisKey])))
  const resetAt = Date.now() + ttl * 1000

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    backend: 'redis',
  }
}

async function cleanExpiredDatabaseBuckets(now: number) {
  if (nextDatabaseCleanupAt > now) return

  nextDatabaseCleanupAt = now + 60 * 60 * 1000
  try {
    await prisma.rateLimitBucket.deleteMany({
      where: { resetAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } },
    })
  } catch {
    nextDatabaseCleanupAt = now + 5 * 60 * 1000
  }
}

async function postgresRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = new Date()
  const nextResetAt = new Date(now.getTime() + windowMs)

  try {
    const [entry] = await prisma.$queryRaw<DatabaseRateLimitEntry[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
      VALUES (${hashRateLimitKey(key)}, 1, ${nextResetAt}, ${now})
      ON CONFLICT ("key") DO UPDATE
      SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${nextResetAt}
          ELSE "RateLimitBucket"."resetAt"
        END,
        "updatedAt" = ${now}
      RETURNING "count", "resetAt"
    `

    if (!entry) throw new RateLimitUnavailableError()

    const resetAt = new Date(entry.resetAt).getTime()
    if (!Number.isFinite(resetAt)) throw new RateLimitUnavailableError()

    await cleanExpiredDatabaseBuckets(now.getTime())
    return {
      allowed: entry.count <= limit,
      remaining: Math.max(0, limit - entry.count),
      resetAt,
      backend: 'postgres',
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) throw error
    throw new RateLimitUnavailableError()
  }
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt, backend: 'memory' }
  }

  existing.count += 1
  buckets.set(key, existing)

  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    backend: 'memory',
  }
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const localMemoryRateLimit =
    (process.env.SECURITY_TEST_MODE === 'true' || process.env.ALLOW_MEMORY_RATE_LIMIT === 'true') &&
    (process.env.NEXTAUTH_URL?.startsWith('http://127.0.0.1') ||
      process.env.NEXTAUTH_URL?.startsWith('http://localhost'))

  if (process.env.SECURITY_TEST_MODE === 'true' && process.env.RATE_LIMIT_TEST_BACKEND === 'memory') {
    return memoryRateLimit(key, limit, windowMs)
  }

  if (getRedisConfig()) {
    try {
      return await redisRateLimit(key, limit, windowMs)
    } catch {
      // Continue with the already configured PostgreSQL database if Redis is unavailable.
    }
  }

  try {
    return await postgresRateLimit(key, limit, windowMs)
  } catch (error) {
    if (localMemoryRateLimit || process.env.NODE_ENV !== 'production') {
      return memoryRateLimit(key, limit, windowMs)
    }
    if (error instanceof RateLimitUnavailableError) throw error
    throw new RateLimitUnavailableError()
  }
}

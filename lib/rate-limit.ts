type RateLimitEntry = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitEntry>()

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  backend: 'redis' | 'memory'
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super('Rate limit backend unavailable')
  }
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
  const redisKey = `rate-limit:${key}`
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
  if (getRedisConfig()) return redisRateLimit(key, limit, windowMs)

  const localMemoryRateLimit =
    (process.env.SECURITY_TEST_MODE === 'true' || process.env.ALLOW_MEMORY_RATE_LIMIT === 'true') &&
    (process.env.NEXTAUTH_URL?.startsWith('http://127.0.0.1') ||
      process.env.NEXTAUTH_URL?.startsWith('http://localhost'))

  if (process.env.NODE_ENV === 'production') {
    if (localMemoryRateLimit) return memoryRateLimit(key, limit, windowMs)
    throw new RateLimitUnavailableError()
  }

  return memoryRateLimit(key, limit, windowMs)
}

export function clearExpiredRateLimits() {
  const now = Date.now()
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key)
  }
}

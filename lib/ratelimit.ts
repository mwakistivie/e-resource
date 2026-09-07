/**
 * Rate limiting for public, unauthenticated endpoints (order creation,
 * download-link lookup). Two backends:
 *
 * - Upstash Redis, when UPSTASH_REDIS_REST_URL/TOKEN are set — correct
 *   across multiple serverless instances, this is what you want in
 *   production on Vercel.
 * - An in-memory sliding window otherwise — works for local dev and
 *   single-instance testing, but does NOT correctly rate-limit across
 *   Vercel's multiple concurrent serverless instances (each instance has
 *   its own memory). Treat this as a development convenience, not a
 *   production guarantee. Set up Upstash before relying on this for real
 *   abuse protection.
 */

interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// --- In-memory fallback ---
const memoryStore = new Map<string, number[]>(); // key -> timestamps (ms) of recent hits

function checkMemory(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const hits = (memoryStore.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    const oldestInWindow = hits[0];
    const retryAfterSeconds = Math.ceil((windowMs - (now - oldestInWindow)) / 1000);
    return { success: false, remaining: 0, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  hits.push(now);
  memoryStore.set(key, hits);
  // Opportunistic cleanup so the map doesn't grow unbounded over the life of the process.
  if (memoryStore.size > 5000) {
    for (const [k, timestamps] of memoryStore) {
      if (timestamps.every((t) => now - t > windowMs)) memoryStore.delete(k);
    }
  }
  return { success: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

// --- Upstash Redis backend (lazy-initialized only if configured) ---
let upstashLimiterCache: Map<string, any> | null = null;

async function checkUpstash(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");

  if (!upstashLimiterCache) upstashLimiterCache = new Map();
  const cacheKey = `${limit}:${windowSeconds}`;
  let limiter = upstashLimiterCache.get(cacheKey);
  if (!limiter) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    });
    upstashLimiterCache.set(cacheKey, limiter);
  }

  const result = await limiter.limit(key);
  const retryAfterSeconds = result.success ? 0 : Math.max(Math.ceil((result.reset - Date.now()) / 1000), 1);
  return { success: result.success, remaining: result.remaining, retryAfterSeconds };
}

const hasUpstash = () => !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

/**
 * @param key Usually `${routeName}:${ip}` — scope rate limits per-route so
 *   hitting one endpoint doesn't consume budget on another.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  if (hasUpstash()) {
    try {
      return await checkUpstash(key, limit, windowSeconds);
    } catch (err) {
      // Fail open to the in-memory limiter rather than fail open entirely —
      // an Upstash outage shouldn't either block all checkout traffic or
      // remove rate limiting altogether.
      console.error("Upstash rate limit check failed, falling back to in-memory:", err);
      return checkMemory(key, limit, windowSeconds);
    }
  }
  return checkMemory(key, limit, windowSeconds);
}

/** Best-effort client IP extraction behind Vercel's proxy. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

type Entry = { count: number; resetsAt: number };
export type RateLimitInput = { key: string; limit: number; windowMs: number };
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };
export interface RateLimiter { check(input: RateLimitInput): Promise<RateLimitResult> }

export const PROCESS_LOCAL_RATE_LIMIT_MAX_KEYS = 10_000;
const SWEEP_INTERVAL = 256;

export class MemoryRateLimiter implements RateLimiter {
  private entries = new Map<string, Entry>();
  private newKeysSinceSweep = 0;

  private makeRoom(now: number) {
    for (const [key, entry] of this.entries) if (entry.resetsAt <= now) this.entries.delete(key);
    while (this.entries.size >= PROCESS_LOCAL_RATE_LIMIT_MAX_KEYS) {
      const oldestKey = this.entries.keys().next().value;
      if (typeof oldestKey !== "string") break;
      this.entries.delete(oldestKey);
    }
  }

  async check({ key, limit, windowMs }: RateLimitInput): Promise<RateLimitResult> {
    const now = Date.now();
    const current = this.entries.get(key);
    if (!current || current.resetsAt <= now) {
      if (!current) {
        this.newKeysSinceSweep += 1;
        if (this.newKeysSinceSweep >= SWEEP_INTERVAL || this.entries.size >= PROCESS_LOCAL_RATE_LIMIT_MAX_KEYS) {
          this.makeRoom(now);
          this.newKeysSinceSweep = 0;
        }
      }
      this.entries.set(key, { count: 1, resetsAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetsAt - now) / 1000));
    if (current.count >= limit) return { allowed: false, retryAfterSeconds };
    current.count += 1;
    return { allowed: true, retryAfterSeconds };
  }
}

export class UpstashRateLimiter implements RateLimiter {
  constructor(private url: string, private token: string) {}

  async check({ key, limit, windowMs }: RateLimitInput): Promise<RateLimitResult> {
    const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; local ttl=redis.call('PTTL',KEYS[1]); return {n,ttl}";
    const response = await fetch(this.url, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(["EVAL", script, "1", key, String(windowMs)]),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error("Distributed rate limiter is unavailable.");
    const payload = await response.json() as { result?: [number, number] };
    if (!Array.isArray(payload.result) || payload.result.length !== 2) throw new Error("Distributed rate limiter returned an invalid response.");
    return {
      allowed: payload.result[0] <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil(payload.result[1] / 1000)),
    };
  }
}

const memoryLimiter = new MemoryRateLimiter();

export function getRateLimiter(): RateLimiter {
  const vercelUrl = process.env.KV_REST_API_URL?.trim();
  const vercelToken = process.env.KV_REST_API_TOKEN?.trim();
  if (vercelUrl && vercelToken) return new UpstashRateLimiter(vercelUrl, vercelToken);

  const customUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const customToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (customUrl && customToken) return new UpstashRateLimiter(customUrl, customToken);

  if (customUrl || customToken || vercelUrl || vercelToken || process.env.NODE_ENV === "production") {
    return { check: async () => { throw new Error("Production rate limiting is not configured."); } };
  }
  return memoryLimiter;
}

export async function rateLimitKey(namespace: string, identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  const bytes = new TextEncoder().encode(`${namespace}:${normalized}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `${namespace}:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function checkRateLimit(namespace: string, identifier: string, limit: number, windowMs = 60_000) {
  try {
    return await getRateLimiter().check({ key: await rateLimitKey(namespace, identifier), limit, windowMs });
  } catch {
    return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
}

export function trustedClientIdentifier(headers: Headers, isVercel = Boolean(process.env.VERCEL)) {
  if (!isVercel) return "unattributed";
  const address = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  return address ? address.slice(0, 128) : "unattributed";
}

export async function checkAuthRateLimits({
  namespace,
  accountIdentifier,
  clientIdentifier,
  clientLimit,
  accountLimit,
  windowMs = 60_000,
  limiter = getRateLimiter(),
}: {
  namespace: string;
  accountIdentifier: string;
  clientIdentifier: string;
  clientLimit: number;
  accountLimit: number;
  windowMs?: number;
  limiter?: RateLimiter;
}): Promise<RateLimitResult> {
  try {
    const client = await limiter.check({
      key: await rateLimitKey(`${namespace}:client`, clientIdentifier),
      limit: clientLimit,
      windowMs,
    });
    if (!client.allowed) return client;
    return await limiter.check({
      key: await rateLimitKey(`${namespace}:account`, accountIdentifier),
      limit: accountLimit,
      windowMs,
    });
  } catch {
    return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
}

// Compatibility for authenticated routes already using server-derived opaque IDs.
export async function allowRequest(key: string, limit = 10, windowMs = 60_000) {
  try {
    return (await getRateLimiter().check({ key, limit, windowMs })).allowed;
  } catch {
    return false;
  }
}

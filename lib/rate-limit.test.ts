import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MemoryRateLimiter,
  PROCESS_LOCAL_RATE_LIMIT_MAX_KEYS,
  checkRateLimit,
  checkAuthRateLimits,
  rateLimitKey,
  trustedClientIdentifier,
} from "./rate-limit";

describe("development process-local rate limiter", () => {
  afterEach(() => vi.useRealTimers());

  it("expires a key after its window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00Z"));
    const key = `expiry:${crypto.randomUUID()}`;
    const limiter = new MemoryRateLimiter();
    await expect(limiter.check({ key, limit: 1, windowMs: 1_000 })).resolves.toMatchObject({ allowed: true });
    await expect(limiter.check({ key, limit: 1, windowMs: 1_000 })).resolves.toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    vi.advanceTimersByTime(1_000);
    await expect(limiter.check({ key, limit: 1, windowMs: 1_000 })).resolves.toMatchObject({ allowed: true });
  });

  it("bounds live keys by evicting the oldest bucket at capacity", async () => {
    const limiter = new MemoryRateLimiter();
    const prefix = crypto.randomUUID();
    const oldest = `${prefix}:oldest`;
    expect((await limiter.check({ key: oldest, limit: 1, windowMs: 60_000 })).allowed).toBe(true);
    for (let index = 0; index < PROCESS_LOCAL_RATE_LIMIT_MAX_KEYS; index += 1) {
      expect((await limiter.check({ key: `${prefix}:${index}`, limit: 1, windowMs: 60_000 })).allowed).toBe(true);
    }
    expect((await limiter.check({ key: oldest, limit: 1, windowMs: 60_000 })).allowed).toBe(true);
  });

  it("derives opaque keys from a trusted namespace and normalized identifier", async () => {
    const first = await rateLimitKey("auth:login", " User@Example.COM ");
    const second = await rateLimitKey("auth:login", "user@example.com");
    expect(first).toBe(second);
    expect(first).not.toContain("user@example.com");
    expect(await rateLimitKey("auth:forgot", "user@example.com")).not.toBe(first);
  });

  it("fails closed when distributed limiter configuration is incomplete", async () => {
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    await expect(checkRateLimit("auth:login", "user@example.com", 10)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  it("trusts only Vercel's controlled forwarding header on Vercel", () => {
    expect(trustedClientIdentifier(new Headers({
      "x-forwarded-for": "attacker-controlled",
      "x-vercel-forwarded-for": "203.0.113.8, 10.0.0.1",
    }), true)).toBe("203.0.113.8");
    expect(trustedClientIdentifier(new Headers({
      "x-forwarded-for": "203.0.113.9",
      "x-vercel-forwarded-for": "203.0.113.8",
    }), false)).toBe("unattributed");
  });

  it("checks a client bucket before a more tolerant account bucket", async () => {
    const limiter = { check: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 60 }) };
    await expect(checkAuthRateLimits({
      namespace: "auth:login",
      accountIdentifier: " User@Example.COM ",
      clientIdentifier: "203.0.113.8",
      clientLimit: 10,
      accountLimit: 30,
      limiter,
    })).resolves.toMatchObject({ allowed: true });
    expect(limiter.check).toHaveBeenCalledTimes(2);
    expect(limiter.check.mock.calls[0]?.[0]).toMatchObject({ limit: 10 });
    expect(limiter.check.mock.calls[1]?.[0]).toMatchObject({ limit: 30 });
    expect(limiter.check.mock.calls[0]?.[0].key).not.toBe(limiter.check.mock.calls[1]?.[0].key);
  });

  it("does not let one client exhaust another client's primary bucket", async () => {
    const limiter = new MemoryRateLimiter();
    const input = {
      namespace: "auth:login",
      accountIdentifier: "user@example.com",
      clientLimit: 1,
      accountLimit: 10,
      limiter,
    };
    await expect(checkAuthRateLimits({ ...input, clientIdentifier: "203.0.113.1" })).resolves.toMatchObject({ allowed: true });
    await expect(checkAuthRateLimits({ ...input, clientIdentifier: "203.0.113.1" })).resolves.toMatchObject({ allowed: false });
    await expect(checkAuthRateLimits({ ...input, clientIdentifier: "203.0.113.2" })).resolves.toMatchObject({ allowed: true });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { allowRequest, PROCESS_LOCAL_RATE_LIMIT_MAX_KEYS } from "./rate-limit";

describe("development process-local rate limiter", () => {
  afterEach(() => vi.useRealTimers());

  it("expires a key after its window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00Z"));
    const key = `expiry:${crypto.randomUUID()}`;
    expect(allowRequest(key, 1, 1_000)).toBe(true);
    expect(allowRequest(key, 1, 1_000)).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(allowRequest(key, 1, 1_000)).toBe(true);
  });

  it("bounds live keys by evicting the oldest bucket at capacity", () => {
    const prefix = crypto.randomUUID();
    const oldest = `${prefix}:oldest`;
    expect(allowRequest(oldest, 1, 60_000)).toBe(true);
    for (let index = 0; index < PROCESS_LOCAL_RATE_LIMIT_MAX_KEYS; index += 1) {
      expect(allowRequest(`${prefix}:${index}`, 1, 60_000)).toBe(true);
    }
    expect(allowRequest(oldest, 1, 60_000)).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCronEnv: vi.fn(), expireDueAttempts: vi.fn() }));
vi.mock("@/lib/env", () => ({ getCronEnv: mocks.getCronEnv }));
vi.mock("@/features/assessments/finalization-service", () => ({ expireDueAttempts: mocks.expireDueAttempts }));

import { GET, POST } from "./route";

const secret = "a-secure-cron-secret-with-at-least-32-characters";

describe("attempt expiry cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCronEnv.mockReturnValue({ CRON_SECRET: secret });
    mocks.expireDueAttempts.mockResolvedValue({ claimed: 3, finalized: 3 });
  });

  it("returns 503 when cron is not configured", async () => {
    mocks.getCronEnv.mockReturnValue({ CRON_SECRET: undefined });
    expect((await POST(new Request("https://app.example/api/internal/attempts/expire", { method: "POST" }))).status).toBe(503);
  });

  it("returns 401 without revealing whether a supplied secret was close", async () => {
    const response = await GET(new Request("https://app.example/api/internal/attempts/expire", { headers: { authorization: "Bearer wrong" } }));
    expect(response.status).toBe(401);
    expect(mocks.expireDueAttempts).not.toHaveBeenCalled();
  });

  it("authenticates Vercel Cron GET requests and drains more than one batch", async () => {
    mocks.expireDueAttempts
      .mockResolvedValueOnce({ claimed: 50, finalized: 50 })
      .mockResolvedValueOnce({ claimed: 50, finalized: 49 })
      .mockResolvedValueOnce({ claimed: 7, finalized: 7 });
    const response = await GET(new Request("https://app.example/api/internal/attempts/expire", { headers: { authorization: `Bearer ${secret}` } }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ data: { claimed: 107, finalized: 106, batches: 3 } }));
    expect(mocks.expireDueAttempts).toHaveBeenCalledTimes(3);
    expect(mocks.expireDueAttempts).toHaveBeenCalledWith({ limit: 50 });
  });

  it("keeps authenticated POST support", async () => {
    const response = await POST(new Request("https://app.example/api/internal/attempts/expire", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ data: { claimed: 3, finalized: 3, batches: 1 } }));
    expect(mocks.expireDueAttempts).toHaveBeenCalledWith({ limit: 50 });
  });
});

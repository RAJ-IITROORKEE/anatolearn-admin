import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCronEnv: vi.fn(), purge: vi.fn(), storage: vi.fn() }));
vi.mock("@/lib/env", () => ({ getCronEnv: mocks.getCronEnv }));
vi.mock("@/features/trash/worker", () => ({ purgeDueTrash: mocks.purge, processMediaPurgeJobs: mocks.storage }));

import { GET, POST } from "./route";

const secret = "a-secure-cron-secret-with-at-least-32-characters";

describe("trash purge cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCronEnv.mockReturnValue({ CRON_SECRET: secret });
    mocks.purge.mockResolvedValue({ claimed: 1, purged: 1, blocked: 0 });
    mocks.storage.mockResolvedValue({ claimed: 1, removed: 1, retried: 0 });
  });

  it("requires exact cron authorization", async () => {
    expect((await GET(new Request("https://app.example/api/internal/trash/purge", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect(mocks.purge).not.toHaveBeenCalled();
  });

  it("runs bounded purge and confirmed storage processing", async () => {
    const response = await GET(new Request("https://app.example/api/internal/trash/purge", { headers: { authorization: `Bearer ${secret}` } }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ data: expect.objectContaining({ purged: 1, storageRemoved: 1 }) }));
    expect(mocks.purge).toHaveBeenCalledWith({ limit: 25 });
  });

  it("rejects non-empty POST bodies before work", async () => {
    const response = await POST(new Request("https://app.example/api/internal/trash/purge", {
      method: "POST", headers: { authorization: `Bearer ${secret}` }, body: JSON.stringify({ force: true }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.purge).not.toHaveBeenCalled();
  });
});

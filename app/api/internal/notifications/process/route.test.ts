import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCronEnv: vi.fn(), getExpoProvider: vi.fn(), processNotifications: vi.fn() }));
vi.mock("@/lib/env", () => ({ getCronEnv: mocks.getCronEnv }));
vi.mock("@/features/notifications/provider", () => ({ getExpoProvider: mocks.getExpoProvider }));
vi.mock("@/features/notifications/worker", () => ({ processNotifications: mocks.processNotifications }));

import { GET, POST } from "./route";

const secret = "a-secure-cron-secret-with-at-least-32-characters";
const request = (method = "GET", authorization = `Bearer ${secret}`) => new Request("https://app.example/api/internal/notifications/process", { method, headers: { authorization } });

describe("notification worker route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCronEnv.mockReturnValue({ CRON_SECRET: secret });
    mocks.getExpoProvider.mockReturnValue({ send: vi.fn(), receipts: vi.fn() });
    mocks.processNotifications.mockResolvedValue({ campaigns: 1, deliveries: 2, finalized: 1 });
  });

  it("rejects invalid cron authorization without processing", async () => {
    expect((await GET(request("GET", "Bearer wrong"))).status).toBe(401);
    expect(mocks.getExpoProvider).not.toHaveBeenCalled();
    expect(mocks.processNotifications).not.toHaveBeenCalled();
  });

  it("returns zero work and performs no mutation when the provider is disabled", async () => {
    mocks.getExpoProvider.mockReturnValue(null);
    const response = await POST(request("POST"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ data: { campaigns: 0, deliveries: 0, finalized: 0 } }));
    expect(mocks.processNotifications).not.toHaveBeenCalled();
  });

  it("supports authenticated GET and POST processing", async () => {
    expect((await GET(request())).status).toBe(200);
    expect((await POST(request("POST"))).status).toBe(200);
    expect(mocks.processNotifications).toHaveBeenCalledTimes(2);
  });

  it("rejects non-empty POST bodies before processing", async () => {
    const response = await POST(new Request("https://app.example/api/internal/notifications/process", {
      method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify({ force: true }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.processNotifications).not.toHaveBeenCalled();
  });
});

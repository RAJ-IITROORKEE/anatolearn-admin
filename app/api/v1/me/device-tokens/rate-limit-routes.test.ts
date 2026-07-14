import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  allowRequest: vi.fn(),
  deactivateDeviceToken: vi.fn(),
  registerDeviceToken: vi.fn(),
  resolveRequestIdentity: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: mocks.allowRequest }));
vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolveRequestIdentity }));
vi.mock("@/features/notifications/device-token-service", () => ({
  deactivateDeviceToken: mocks.deactivateDeviceToken,
  registerDeviceToken: mocks.registerDeviceToken,
}));

import { DELETE } from "./[id]/route";
import { POST } from "./route";

const tokenId = "00000000-0000-4000-8000-000000000001";

describe("device-token route rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestIdentity.mockResolvedValue({ mode: "bearer", profile: { id: "profile" } });
    mocks.allowRequest.mockResolvedValue(false);
  });

  it.each([
    ["register", () => POST(new Request("https://app.example/api/v1/me/device-tokens", { method: "POST" }))],
    ["deactivate", () => DELETE(new Request(`https://app.example/api/v1/me/device-tokens/${tokenId}`, { method: "DELETE" }), { params: Promise.resolve({ id: tokenId }) })],
  ])("returns the shared private 429 contract for %s", async (_name, invoke) => {
    const response = await invoke();
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization, Cookie");
    expect(mocks.registerDeviceToken).not.toHaveBeenCalled();
    expect(mocks.deactivateDeviceToken).not.toHaveBeenCalled();
  });
});

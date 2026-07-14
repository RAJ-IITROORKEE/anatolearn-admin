import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), markRead: vi.fn() }));
vi.mock("@/lib/auth/request", () => ({ resolveRequestIdentity: mocks.resolve }));
vi.mock("@/features/notifications/service", () => ({ markNotificationRead: mocks.markRead }));

import { POST } from "./route";

const recipientId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

describe("learner notification read route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue({ mode: "bearer", profile: { id: userId, role: "USER" } });
    mocks.markRead.mockResolvedValue({ id: recipientId, readAt: new Date() });
  });

  it("derives ownership from the verified identity", async () => {
    const response = await POST(new Request("https://app.example/api/v1/notifications/x/read", { method: "POST" }), { params: Promise.resolve({ recipientId }) });
    expect(response.status).toBe(200);
    expect(mocks.markRead).toHaveBeenCalledWith(userId, recipientId);
  });

  it("enforces origin for cookie-authenticated mutation", async () => {
    mocks.resolve.mockResolvedValue({ mode: "cookie", profile: { id: userId, role: "USER" } });
    const response = await POST(new Request("https://app.example/api/v1/notifications/x/read", { method: "POST", headers: { origin: "https://evil.example", host: "app.example" } }), { params: Promise.resolve({ recipientId }) });
    expect(response.status).toBe(403);
    expect(mocks.markRead).not.toHaveBeenCalled();
  });
});

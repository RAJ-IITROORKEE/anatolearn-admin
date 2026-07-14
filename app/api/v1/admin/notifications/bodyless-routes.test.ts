import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  cancelCampaign: vi.fn(),
  sendCampaign: vi.fn(),
  getProviderConfig: vi.fn(),
}));
vi.mock("@/lib/api/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/notifications/service", () => ({ cancelCampaign: mocks.cancelCampaign, sendCampaign: mocks.sendCampaign }));
vi.mock("@/features/notifications/provider", () => ({ getProviderConfig: mocks.getProviderConfig }));

import { POST as cancel } from "./[id]/cancel/route";
import { POST as send } from "./[id]/send/route";

const id = "00000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ id }) };

describe("bodyless notification campaign mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "request", identity: { profile: { id: "admin" } } });
    mocks.getProviderConfig.mockReturnValue({ ready: true });
  });

  it.each([cancel, send])("rejects arbitrary non-empty JSON", async (handler) => {
    const response = await handler(new Request(`https://app.example/api/v1/admin/notifications/${id}/action`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unexpected: true }),
    }), context);
    expect(response.status).toBe(400);
    expect(mocks.cancelCampaign).not.toHaveBeenCalled();
    expect(mocks.sendCampaign).not.toHaveBeenCalled();
  });

  it.each([cancel, send])("allows an empty JSON object", async (handler) => {
    mocks.cancelCampaign.mockResolvedValue({ id });
    mocks.sendCampaign.mockResolvedValue({ id });
    const response = await handler(new Request(`https://app.example/api/v1/admin/notifications/${id}/action`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    }), context);
    expect([200, 202]).toContain(response.status);
  });
});

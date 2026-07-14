import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(), createCampaignWithIntent: vi.fn(), updateCampaignWithIntent: vi.fn(),
  sendCampaign: vi.fn(), cancelCampaign: vi.fn(), searchActiveLearnerOptions: vi.fn(),
  getProviderConfig: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock("@/features/notifications/provider", () => ({ getProviderConfig: mocks.getProviderConfig }));
vi.mock("@/features/notifications/service", () => ({
  createCampaignWithIntent: mocks.createCampaignWithIntent, updateCampaignWithIntent: mocks.updateCampaignWithIntent,
  sendCampaign: mocks.sendCampaign,
  cancelCampaign: mocks.cancelCampaign,
}));
vi.mock("@/features/users/service", () => ({ searchActiveLearnerOptions: mocks.searchActiveLearnerOptions }));

import { cancelCampaignAction, createCampaignAction, sendCampaignAction } from "./actions";

describe("notification admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPage.mockResolvedValue({ profile: { id: crypto.randomUUID() } });
    mocks.getProviderConfig.mockReturnValue({ ready: true });
    mocks.createCampaignWithIntent.mockResolvedValue({ id: crypto.randomUUID() });
  });

  it("submits send intent through one atomic create operation", async () => {
    const data = new FormData();
    data.set("type", "ANNOUNCEMENT"); data.set("title", "Notice"); data.set("message", "Message");
    data.set("audienceType", "ALL_ACTIVE_USERS"); data.set("intent", "send");
    await createCampaignAction({}, data);
    expect(mocks.createCampaignWithIntent).toHaveBeenCalledTimes(1);
    expect(mocks.createCampaignWithIntent).toHaveBeenCalledWith(expect.any(Object), { type: "SEND", providerReady: true }, expect.any(Object));
  });

  it("rejects arbitrary audience data before authentication", async () => {
    const data = new FormData();
    data.set("type", "ANNOUNCEMENT"); data.set("title", "Notice"); data.set("message", "Message");
    data.set("audienceType", "{\"all\":true}"); data.set("intent", "draft");
    expect(await createCampaignAction({}, data)).toEqual({ error: expect.any(String) });
    expect(mocks.requireAdminPage).not.toHaveBeenCalled();
  });

  it("does not queue send-now when provider configuration is unavailable", async () => {
    mocks.getProviderConfig.mockReturnValue({ ready: false });
    const result = await sendCampaignAction(crypto.randomUUID(), {});
    expect(result.error).toMatch(/not ready/i);
    expect(mocks.sendCampaign).not.toHaveBeenCalled();
  });

  it("validates malformed IDs before cancel", async () => {
    expect(await cancelCampaignAction("bad-id", {})).toEqual({ error: "Notification campaign was not found." });
    expect(mocks.requireAdminPage).not.toHaveBeenCalled();
  });
});

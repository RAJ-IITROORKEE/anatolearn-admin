import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  $queryRaw: vi.fn(),
  notificationDelivery: { updateMany: vi.fn() },
  deviceToken: { update: vi.fn(), create: vi.fn() },
};
const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { deactivateDeviceToken, registerDeviceToken } from "./device-token-service";

describe("device token registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
  });

  it("locks and safely transfers a token from its previous owner", async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: "new-user" }])
      .mockResolvedValueOnce([{ id: "token-id", userId: "old-user" }]);
    tx.deviceToken.update
      .mockResolvedValueOnce({ id: "token-id", userId: "old-user", platform: "IOS", isActive: false, lastSeenAt: new Date(0) })
      .mockResolvedValueOnce({ id: "token-id", userId: "new-user", platform: "ANDROID", isActive: true, lastSeenAt: new Date(1), expoPushToken: "ExpoPushToken[private]" });

    const result = await registerDeviceToken("new-user", { expoPushToken: "ExpoPushToken[value]", platform: "ANDROID" });

    expect(tx.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: { deviceTokenId: "token-id", status: "PENDING" },
      data: { status: "CANCELLED", nextAttemptAt: null, processingToken: null, processingLeaseUntil: null },
    });
    expect(tx.deviceToken.update).toHaveBeenNthCalledWith(1, { where: { id: "token-id" }, data: { isActive: false } });
    expect(tx.deviceToken.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: "token-id" }, data: expect.objectContaining({ userId: "new-user", isActive: true }) }));
    expect(result).not.toHaveProperty("expoPushToken");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    const sql = tx.$queryRaw.mock.calls.map(([query]) => (query as { strings: string[] }).strings.join(""));
    expect(sql[0]).toContain('FROM "Profile"');
    expect(sql[0]).toContain('"isActive" = true');
    expect(sql[0]).toContain("FOR SHARE");
    expect(sql[1]).toContain('FROM "DeviceToken"');
    expect(sql[1]).toContain("FOR UPDATE");
  });

  it("rejects transfer before touching a token when the destination profile is no longer active", async () => {
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(registerDeviceToken("inactive-user", { expoPushToken: "ExpoPushToken[value]", platform: "IOS" })).rejects.toMatchObject({ code: "PROFILE_INACTIVE" });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.deviceToken.update).not.toHaveBeenCalled();
    expect(tx.deviceToken.create).not.toHaveBeenCalled();
  });

  it("uses the same profile-then-token lock order for deactivation", async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: "user-id" }])
      .mockResolvedValueOnce([{ id: "token-id" }]);
    tx.deviceToken.update.mockResolvedValue({});
    await expect(deactivateDeviceToken("user-id", "token-id")).resolves.toEqual({ deactivated: true });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    const sql = tx.$queryRaw.mock.calls.map(([query]) => (query as { strings: string[] }).strings.join(""));
    expect(sql[0]).toContain('FROM "Profile"');
    expect(sql[1]).toContain('FROM "DeviceToken"');
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(tx.deviceToken.update.mock.invocationCallOrder[0]);
  });
});

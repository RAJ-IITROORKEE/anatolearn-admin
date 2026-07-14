import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignUpdateMany: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    notificationCampaign: { updateMany: mocks.campaignUpdateMany },
    notificationDelivery: { updateMany: mocks.deliveryUpdateMany },
  },
}));

import {
  StaleNotificationWorkerError,
  completeDeliveryClaim,
  claimDeliveries,
  materializeCampaign,
  permanentProviderFailure,
  receiptPollDecision,
  renewCampaignLease,
} from "./worker";

describe("notification worker ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renews a campaign only while its processing token is still owned", async () => {
    mocks.campaignUpdateMany.mockResolvedValue({ count: 1 });
    await renewCampaignLease("campaign-id", "campaign-token", new Date("2026-07-14T12:01:00Z"));
    expect(mocks.campaignUpdateMany).toHaveBeenCalledWith({
      where: { id: "campaign-id", processingToken: "campaign-token", status: "PROCESSING" },
      data: { processingLeaseUntil: new Date("2026-07-14T12:01:00Z") },
    });
  });

  it("aborts a stale campaign worker when compare-and-set updates no row", async () => {
    mocks.campaignUpdateMany.mockResolvedValue({ count: 0 });
    await expect(renewCampaignLease("campaign-id", "stale-token", new Date())).rejects.toBeInstanceOf(StaleNotificationWorkerError);
  });

  it("completes a delivery only while both campaign and delivery claims are owned", async () => {
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 1 });
    await completeDeliveryClaim("delivery-id", "delivery-token", { providerErrorCode: null });
    expect(mocks.deliveryUpdateMany).toHaveBeenCalledWith({
      where: { id: "delivery-id", processingToken: "delivery-token" },
      data: { providerErrorCode: null, processingToken: null, processingLeaseUntil: null },
    });
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 0 });
    await expect(completeDeliveryClaim("delivery-id", "stale-token", {})).rejects.toBeInstanceOf(StaleNotificationWorkerError);
  });

  it("materializes profiles and their currently-owned active tokens under one ordered transaction", async () => {
    const tx = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ id: "campaign-id" }])
        .mockResolvedValueOnce([{ id: "user-id" }])
        .mockResolvedValueOnce([{ id: "device-id", userId: "user-id", expoPushToken: "ExpoPushToken[value]", platform: "IOS" }]),
      notificationRecipient: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: "recipient-id", userId: "user-id" }]),
      },
      notificationDelivery: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      notificationCampaign: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    await materializeCampaign({ id: "campaign-id", processingToken: "campaign-token", targetFilter: { type: "ALL_ACTIVE_USERS" } });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    const sql = tx.$queryRaw.mock.calls.map(([query]) => (query as { strings: string[] }).strings.join(""));
    expect(sql[1]).toContain('FROM "Profile"');
    expect(sql[1]).toContain("FOR SHARE");
    expect(sql[2]).toContain('FROM "DeviceToken"');
    expect(sql[2]).toContain('"isActive" = true');
    expect(tx.notificationDelivery.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(tx.notificationCampaign.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "campaign-id", processingToken: "campaign-token", materializedAt: null }),
      data: expect.objectContaining({ materializedAt: expect.any(Date) }),
    }));
  });

  it("skips audience and device queries after the campaign was materialized", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "campaign-id", materializedAt: new Date("2026-07-14T12:00:00Z") }]),
      notificationRecipient: { createMany: vi.fn(), findMany: vi.fn() },
      notificationDelivery: { createMany: vi.fn() },
      notificationCampaign: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(materializeCampaign({
      id: "campaign-id",
      processingToken: "campaign-token",
      targetFilter: { type: "SELECTED_USERS", userIds: ["00000000-0000-4000-8000-000000000099"] },
    })).resolves.toBe(false);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.notificationRecipient.createMany).not.toHaveBeenCalled();
    expect(tx.notificationRecipient.findMany).not.toHaveBeenCalled();
    expect(tx.notificationDelivery.createMany).not.toHaveBeenCalled();
  });

  it("claims only unowned or expired deliveries before another worker can select them", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "delivery-id" }]),
      notificationDelivery: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: "delivery-id" }]),
      },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    const claim = await claimDeliveries({ id: "campaign-id" }, "PENDING", 100);
    const sql = (tx.$queryRaw.mock.calls[0][0] as { strings: string[] }).strings.join("");
    expect(sql).toContain('d."processingToken" IS NULL');
    expect(sql).toContain('d."processingLeaseUntil" <= clock_timestamp()');
    expect(sql).toContain("FOR UPDATE OF d SKIP LOCKED");
    expect(tx.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["delivery-id"] }, status: "PENDING" },
      data: { processingToken: expect.any(String), processingLeaseUntil: expect.any(Date) },
    });
    expect(claim.rows).toHaveLength(1);
  });
});

describe("receipt polling policy", () => {
  const now = new Date("2026-07-15T10:00:00Z");

  it("keeps missing and transport-failed receipts ticketed while recording a receipt poll", () => {
    for (const outcome of ["MISSING", "TRANSIENT"] as const) {
      expect(receiptPollDecision({ ticketedAt: new Date("2026-07-15T09:00:00Z"), receiptAttemptCount: 3 }, outcome, now)).toEqual({
        status: "TICKETED",
        receiptAttemptCount: 4,
        receiptCheckedAt: now,
        providerErrorCode: "RECEIPT_PENDING",
      });
    }
  });

  it("fails unavailable receipts only at the explicit age or poll bound", () => {
    expect(receiptPollDecision({ ticketedAt: new Date("2026-07-14T10:59:59Z"), receiptAttemptCount: 1 }, "MISSING", now)).toEqual({
      status: "FAILED",
      receiptAttemptCount: 2,
      receiptCheckedAt: now,
      failedAt: now,
      providerErrorCode: "RECEIPT_UNAVAILABLE",
    });
    expect(receiptPollDecision({ ticketedAt: new Date("2026-07-15T09:00:00Z"), receiptAttemptCount: 19 }, "TRANSIENT", now).status).toBe("FAILED");
  });
});

describe("permanent provider failures", () => {
  it("terminally fails an owned claim without scheduling another attempt", () => {
    const now = new Date("2026-07-15T10:00:00Z");
    expect(permanentProviderFailure(2, now)).toEqual({
      status: "FAILED",
      attemptCount: 3,
      lastAttemptAt: now,
      nextAttemptAt: null,
      failedAt: now,
      providerErrorCode: "PROVIDER_PERMANENT",
      providerErrorMessage: "Notification provider permanently rejected the request.",
    });
  });
});

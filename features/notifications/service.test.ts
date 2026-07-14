import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), queryRaw: vi.fn(), groupBy: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction, $queryRaw: mocks.queryRaw, notificationCampaign: { groupBy: mocks.groupBy } } }));

import { createCampaignWithIntent, getCampaignEvidence, getCampaignStatusCounts, scheduleCampaign, sendCampaign, updateCampaignWithIntent } from "./service";

const context = { actorId: "00000000-0000-4000-8000-000000000002", requestId: "request" };
const input = { type: "ANNOUNCEMENT" as const, title: "Title", message: "Message", target: { type: "ALL_ACTIVE_USERS" as const } };
const row = { id: "00000000-0000-4000-8000-000000000001", ...input, targetFilter: input.target, status: "DRAFT", scheduledAt: null, sentAt: null, createdAt: new Date(), updatedAt: new Date() };

describe("notification service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not begin a mutation when immediate sending is disabled", async () => {
    await expect(sendCampaign("00000000-0000-4000-8000-000000000001", { actorId: "00000000-0000-4000-8000-000000000002", requestId: "request" }, false)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 503 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not create a campaign when an atomic schedule intent is invalid", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ now: new Date("2026-07-14T12:00:00.000Z") }]),
      profile: { count: vi.fn() }, notificationCampaign: { create: vi.fn(), update: vi.fn() },
      notificationRecipient: { count: vi.fn() }, auditLog: { create: vi.fn() },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(createCampaignWithIntent(input, { type: "SCHEDULE", scheduledAt: new Date("2026-07-14T12:00:59.999Z") }, context)).rejects.toMatchObject({ code: "SCHEDULE_TOO_SOON" });
    expect(tx.notificationCampaign.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("does not begin or create an atomic send when the provider is disabled", async () => {
    await expect(createCampaignWithIntent(input, { type: "SEND", providerReady: false }, context)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not begin or change an atomic update send when the provider is disabled", async () => {
    await expect(updateCampaignWithIntent(row.id, input, { type: "SEND", providerReady: false }, context)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates, schedules, and audits both transitions in one transaction", async () => {
    const scheduledAt = new Date("2026-07-14T12:05:00.000Z");
    const scheduled = { ...row, status: "SCHEDULED", scheduledAt };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ now: new Date("2026-07-14T12:00:00.000Z") }]),
      profile: { count: vi.fn() }, notificationCampaign: { create: vi.fn().mockResolvedValue(row), update: vi.fn().mockResolvedValue(scheduled) },
      notificationRecipient: { count: vi.fn().mockResolvedValue(0) }, auditLog: { create: vi.fn() },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    await createCampaignWithIntent(input, { type: "SCHEDULE", scheduledAt }, context);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create.mock.calls.map(([call]) => call.data.action)).toEqual(["CREATE", "SCHEDULE"]);
  });

  it("leaves a locked draft unchanged when an atomic update schedule is invalid", async () => {
    const tx = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ id: row.id }])
        .mockResolvedValueOnce([{ now: new Date("2026-07-14T12:00:00.000Z") }]),
      profile: { count: vi.fn() }, notificationCampaign: { findUnique: vi.fn().mockResolvedValue(row), update: vi.fn() },
      notificationRecipient: { count: vi.fn() }, auditLog: { create: vi.fn() },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(updateCampaignWithIntent(row.id, input, { type: "SCHEDULE", scheduledAt: new Date("2026-07-14T12:00:59.999Z") }, context)).rejects.toMatchObject({ code: "SCHEDULE_TOO_SOON" });
    expect(tx.notificationCampaign.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("aggregates evidence for a page of campaigns in one bounded query", async () => {
    mocks.queryRaw.mockResolvedValue([{ campaignId: row.id, recipients: BigInt(3), read: BigInt(2), pending: BigInt(1), ticketed: BigInt(2), sent: BigInt(3), failed: BigInt(4), cancelled: BigInt(5) }]);
    const result = await getCampaignEvidence([row.id, "00000000-0000-4000-8000-000000000003"]);
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    expect(result[row.id]).toEqual({ recipients: 3, read: 2, pending: 1, ticketed: 2, receiptConfirmed: 3, failed: 4, cancelled: 5, deliveries: 15 });
    expect(result["00000000-0000-4000-8000-000000000003"]).toEqual(expect.objectContaining({ recipients: 0, deliveries: 0 }));
  });

  it("loads all status counts with one grouped query", async () => {
    mocks.groupBy.mockResolvedValue([{ status: "DRAFT", _count: { _all: 4 } }]);
    expect(await getCampaignStatusCounts()).toEqual(expect.objectContaining({ DRAFT: 4, SENT: 0 }));
    expect(mocks.groupBy).toHaveBeenCalledTimes(1);
  });

  it("uses database time and rejects schedules less than 60 seconds ahead", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ now: new Date("2026-07-14T12:00:00.000Z") }]),
      notificationCampaign: { findUnique: vi.fn(), update: vi.fn() },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    await expect(scheduleCampaign(
      "00000000-0000-4000-8000-000000000001",
      new Date("2026-07-14T12:00:59.999Z"),
      { actorId: "00000000-0000-4000-8000-000000000002", requestId: "request" },
    )).rejects.toMatchObject({ code: "SCHEDULE_TOO_SOON", status: 422 });
    expect(tx.notificationCampaign.findUnique).not.toHaveBeenCalled();
    expect(tx.notificationCampaign.update).not.toHaveBeenCalled();
  });
});

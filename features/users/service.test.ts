import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prisma } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(), profile: { findUnique: vi.fn(), update: vi.fn() }, deviceToken: { updateMany: vi.fn() },
    notificationDelivery: { updateMany: vi.fn() }, auditLog: { create: vi.fn() },
  };
  return { tx, prisma: {
    $transaction: vi.fn((arg: unknown) => typeof arg === "function" ? (arg as (value: typeof tx) => unknown)(tx) : Promise.all(arg as Promise<unknown>[])),
    profile: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() }, assessmentAttempt: { count: vi.fn(), aggregate: vi.fn() }, feedback: { count: vi.fn() }, deviceToken: { count: vi.fn() },
  } };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma }));

import { getLearnerDeviceCounts, getLearnerPickerOptions, listLearners, searchActiveLearnerOptions, setLearnerActivity } from "./service";

const profile = { id: crypto.randomUUID(), fullName: "Learner", email: "a@b.com", role: "USER", avatarUrl: null, isActive: true, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() };

describe("user transactional mutations", () => {
  beforeEach(() => { vi.clearAllMocks(); tx.profile.findUnique.mockResolvedValue(profile); tx.profile.update.mockResolvedValue({ ...profile, isActive: false }); });

  it("locks, deactivates tokens and pending deliveries, and writes a redacted audit atomically", async () => {
    await setLearnerActivity(profile.id, false, { actorId: crypto.randomUUID(), requestId: "request" });
    expect(tx.$queryRaw.mock.calls[0][0].strings.join(" ")).toContain("FOR UPDATE");
    expect(tx.deviceToken.updateMany).toHaveBeenCalledWith({ where: { userId: profile.id, isActive: true }, data: { isActive: false } });
    expect(tx.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: { deviceToken: { userId: profile.id }, status: "PENDING" },
      data: {
        status: "CANCELLED",
        nextAttemptAt: null,
        processingToken: null,
        processingLeaseUntil: null,
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "DEACTIVATE", beforeSnapshot: { isActive: true }, afterSnapshot: { isActive: false } }) }));
  });

  it("does nothing and writes no audit when activity already matches", async () => {
    const result = await setLearnerActivity(profile.id, true, { actorId: crypto.randomUUID(), requestId: "request" });
    expect(result.isActive).toBe(true);
    expect(tx.profile.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("activation never reactivates tokens", async () => {
    tx.profile.findUnique.mockResolvedValue({ ...profile, isActive: false });
    tx.profile.update.mockResolvedValue(profile);
    await setLearnerActivity(profile.id, true, { actorId: crypto.randomUUID(), requestId: "request" });
    expect(tx.deviceToken.updateMany).not.toHaveBeenCalled();
    expect(tx.notificationDelivery.updateMany).not.toHaveBeenCalled();
  });
});

describe("learner list query", () => {
  it("always scopes role USER and adds a stable ID tie-breaker", async () => {
    prisma.profile.findMany.mockResolvedValue([]);
    prisma.profile.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    const result = await listLearners({ page: 1, pageSize: 20, sortBy: "email", sortOrder: "asc" });

    expect(prisma.profile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ role: "USER" }),
      orderBy: [{ email: "asc" }, { id: "asc" }],
    }));
    expect(result.summary).toEqual({ total: 5, active: 3, inactive: 2, joined30Days: 1 });
  });
});

describe("notification learner picker queries", () => {
  it("searches active learners with bounded pagination and a stable label sort", async () => {
    prisma.profile.findMany.mockResolvedValue([{ id: profile.id, fullName: "Learner", email: "a@b.com" }]);
    prisma.profile.count.mockResolvedValue(21);
    const result = await searchActiveLearnerOptions({ q: "learn", page: 2 });
    expect(prisma.profile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ role: "USER", isActive: true, OR: expect.any(Array) }),
      orderBy: [{ fullName: "asc" }, { id: "asc" }], skip: 20, take: 20,
    }));
    expect(result.pagination).toEqual({ page: 2, pageSize: 20, total: 21, totalPages: 2 });
  });

  it("hydrates up to 500 selected IDs independently of the current search page", async () => {
    prisma.profile.findMany.mockResolvedValue([{ id: profile.id, fullName: "Learner", email: "a@b.com" }]);
    await getLearnerPickerOptions([profile.id]);
    expect(prisma.profile.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [profile.id] }, role: "USER" }, take: 500 }));
  });
});

it("returns device totals without exposing token values", async () => {
  prisma.deviceToken.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
  await expect(getLearnerDeviceCounts(profile.id)).resolves.toEqual({ total: 4, active: 3, inactive: 1 });
});

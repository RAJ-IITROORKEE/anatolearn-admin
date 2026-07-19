import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
  executeRaw: vi.fn(),
  tx: { $queryRaw: vi.fn(), $executeRaw: vi.fn(), auditLog: { create: vi.fn() }, mediaPurgeJob: { update: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  $transaction: mocks.transaction,
  mediaPurgeJob: { deleteMany: mocks.deleteMany, updateMany: mocks.updateMany },
  $executeRaw: mocks.executeRaw,
} }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

import { processMediaPurgeJobs, purgeDueTrash } from "./worker";

const job = { id: crypto.randomUUID(), bucket: "private", path: "media/file.png" };

describe("media purge storage worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.$queryRaw.mockResolvedValueOnce([job]).mockResolvedValueOnce([]);
    mocks.tx.$executeRaw.mockResolvedValue(1);
    mocks.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("reports removal only after provider confirmation", async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    await expect(processMediaPurgeJobs({ limit: 2, remove })).resolves.toEqual({ claimed: 1, removed: 1, retried: 0 });
    expect(remove).toHaveBeenCalledWith(job.bucket, job.path);
    expect(mocks.deleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.tx.mediaPurgeJob.update).not.toHaveBeenCalled();
    expect(mocks.tx.$executeRaw.mock.calls[0][0].strings.join(" ")).toContain("clock_timestamp() + interval '5 minutes'");
  });

  it("treats a provider-confirmed missing object as success", async () => {
    const remove = vi.fn().mockResolvedValue({ error: { statusCode: 404, message: "Not found" } });
    await expect(processMediaPurgeJobs({ limit: 2, remove })).resolves.toEqual({ claimed: 1, removed: 1, retried: 0 });
  });

  it("releases the lease and retries transient storage failures", async () => {
    const remove = vi.fn().mockRejectedValue(new Error("temporary outage"));
    await expect(processMediaPurgeJobs({ limit: 1, remove })).resolves.toEqual({ claimed: 1, removed: 0, retried: 1 });
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.executeRaw.mock.calls[0][0].strings.join(" ")).toContain("clock_timestamp() + interval '1 day'");
  });
});

describe("trash metadata purge worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
  });

  it("keeps a blocked item and delays its next attempt by one day", async () => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id: crypto.randomUUID() }])
      .mockResolvedValueOnce([{ count: 2 }]);

    await expect(purgeDueTrash({ limit: 1 })).resolves.toEqual({ claimed: 1, purged: 0, blocked: 1 });
    expect(mocks.tx.$executeRaw).toHaveBeenCalledOnce();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("checks legacy and v2 lesson media references before purging an asset", async () => {
    const mediaId = crypto.randomUUID();
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: mediaId, bucket: "private", path: "media/heart.png" }])
      .mockResolvedValueOnce([{ count: 2 }]);

    await expect(purgeDueTrash({ limit: 1 })).resolves.toEqual({ claimed: 1, purged: 0, blocked: 1 });

    const blockerQuery = mocks.tx.$queryRaw.mock.calls.at(-1)![0].strings.join(" ");
    expect(blockerQuery).toContain("jsonb_typeof(lesson.\"contentBlocks\") = 'array'");
    expect(blockerQuery).toContain("lesson.\"contentBlocks\"->'fallbackBlocks'");
  });

  it("purges due feedback before resources that its attachment can block", async () => {
    const feedbackId = crypto.randomUUID();
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id: feedbackId }])
      .mockResolvedValueOnce([{ count: 0 }]);

    await expect(purgeDueTrash({ limit: 1 })).resolves.toEqual({ claimed: 1, purged: 1, blocked: 0 });

    const claim = mocks.tx.$queryRaw.mock.calls[0][0];
    expect(claim.strings.join(" ")).toContain('FROM "Feedback"');
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({ data: {
      action: "PURGE", entityType: "Feedback", entityId: feedbackId,
      beforeSnapshot: { trashed: true }, afterSnapshot: { purged: true },
    } });
  });
});

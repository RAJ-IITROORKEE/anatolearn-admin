import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    organSystem: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    topic: { findFirst: vi.fn(), update: vi.fn() },
    contentLesson: { findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { createContent, reorderContent, updateContent } from "./service";

const context = { actorId: crypto.randomUUID(), requestId: crypto.randomUUID() };
const parentId = crypto.randomUUID();
const first = "20000000-0000-4000-8000-000000000002";
const second = "10000000-0000-4000-8000-000000000001";

describe("content reorder locking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
  });

  it.each([
    ["topic", "Topic"],
    ["contentLesson", "ContentLesson"],
  ] as const)("share-locks untrashed ancestors and deterministically update-locks %s rows", async (resource, table) => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([{ id: parentId }])
      .mockResolvedValueOnce([{ id: second, displayOrder: 1 }, { id: first, displayOrder: 0 }]);

    await reorderContent(resource, parentId, [first, second], context);

    expect(mocks.tx.$queryRaw.mock.calls[0][0].strings.join(" ")).toContain("FOR SHARE");
    const selected = mocks.tx.$queryRaw.mock.calls[1][0];
    expect(selected.strings.join(" ")).toContain(`FROM \"${table}\"`);
    expect(selected.strings.join(" ")).toContain("FOR UPDATE");
    expect(selected.values).toEqual([second, first, parentId]);
  });
});

describe("content mutation locking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
  });

  it("rejects an edit when the deterministic row lock cannot find an untrashed resource", async () => {
    mocks.tx.$queryRaw.mockResolvedValue([]);

    await expect(updateContent("topic", first, { title: "Changed" }, context)).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(mocks.tx.$queryRaw.mock.calls[0][0].strings.join(" ")).toContain("FOR UPDATE");
    expect(mocks.tx.topic.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.topic.update).not.toHaveBeenCalled();
  });

  it("casts managed media IDs to UUIDs when validating an organ-system update", async () => {
    const mediaId = crypto.randomUUID();
    const row = { id: first, name: "Respiratory", slug: "respiratory", shortDescription: "Respiratory system.", longDescription: null, coverImageUrl: null, coverMediaId: null, iconImageUrl: null, iconMediaId: null, displayOrder: 2, status: "PUBLISHED" as const, isActive: true, createdAt: new Date(), updatedAt: new Date(), trashedAt: null, purgeAfter: null, nextPurgeAttemptAt: null };
    const updated = { ...row, iconMediaId: mediaId };
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ id: first }]).mockResolvedValueOnce([{ id: mediaId, archivedAt: null }]);
    mocks.tx.organSystem.findFirst.mockResolvedValue(row);
    mocks.tx.organSystem.update.mockResolvedValue(updated);

    await updateContent("organSystem", first, { iconMediaId: mediaId }, context);

    const mediaQuery = mocks.tx.$queryRaw.mock.calls[1][0];
    expect(mediaQuery.strings.join(" ")).toContain("::uuid");
    expect(mediaQuery.values).toContain(mediaId);
  });
});

describe("organ-system slug generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
  });

  it("normalizes the name and adds a unique suffix", async () => {
    const row = { id: first, name: "Heart & Vessels", slug: "heart-vessels-2", shortDescription: "Circulation.", longDescription: null, coverImageUrl: null, coverMediaId: null, iconImageUrl: null, iconMediaId: null, displayOrder: 0, status: "DRAFT" as const, isActive: true, createdAt: new Date(), updatedAt: new Date() };
    mocks.tx.organSystem.findMany.mockResolvedValue([{ slug: "heart-vessels" }]);
    mocks.tx.organSystem.create.mockResolvedValue(row);

    await createContent("organSystem", { name: row.name, shortDescription: row.shortDescription, displayOrder: row.displayOrder }, context);

    expect(mocks.tx.organSystem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ slug: "heart-vessels-2" }) });
  });
});

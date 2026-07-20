import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ inspectImage: vi.fn(), uploadMedia: vi.fn(), moveToTrash: vi.fn(), transaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/media/image", () => ({ inspectImage: mocks.inspectImage }));
vi.mock("@/features/media/service", () => ({ uploadMedia: mocks.uploadMedia }));
vi.mock("@/features/trash/service", () => ({ moveToTrash: mocks.moveToTrash }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { deleteManagedAvatar, replaceManagedAvatar } from "./avatar-service";

const userId = crypto.randomUUID();
const newMediaId = crypto.randomUUID();
const oldMediaId = crypto.randomUUID();

describe("managed avatar service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inspectImage.mockResolvedValue({ mimeType: "image/png", width: 10, height: 10 });
    mocks.uploadMedia.mockResolvedValue({ id: newMediaId });
  });

  it("validates byte type and atomically links a private managed upload", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValueOnce([{ id: userId }]).mockResolvedValueOnce([{ id: oldMediaId, uploadedById: userId, trashedAt: null }]).mockResolvedValueOnce([{ referenced: false }]), profile: { findUnique: vi.fn().mockResolvedValue({ avatarMediaId: oldMediaId }), update: vi.fn().mockResolvedValue({ avatarMediaId: newMediaId }), count: vi.fn().mockResolvedValue(0) }, mediaAsset: { findUnique: vi.fn().mockResolvedValue({ uploadedById: userId, trashedAt: null }) } };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    const file = { name: "avatar.png", type: "image/png", size: 1, arrayBuffer: async () => new Uint8Array([1]).buffer } as File;
    await replaceManagedAvatar(userId, file, "request");
    expect(mocks.inspectImage).toHaveBeenCalled();
    expect(mocks.uploadMedia).toHaveBeenCalledWith(file, "", userId, "request");
    expect(tx.profile.update).toHaveBeenCalledWith({ where: { id: userId }, data: { avatarMediaId: newMediaId, avatarUrl: null } });
    expect(mocks.moveToTrash).toHaveBeenCalledWith("media-asset", oldMediaId, { actorId: userId, requestId: "request" });
  });

  it("rejects WebP and files over one MiB before upload", async () => {
    mocks.inspectImage.mockResolvedValue({ mimeType: "image/webp", width: 10, height: 10 });
    await expect(replaceManagedAvatar(userId, { name: "avatar.webp", type: "image/webp", size: 1, arrayBuffer: async () => new Uint8Array([1]).buffer } as File, "request")).rejects.toMatchObject({ code: "INVALID_FILE" });
    await expect(replaceManagedAvatar(userId, { name: "avatar.png", type: "image/png", size: 1_048_577, arrayBuffer: async () => new ArrayBuffer(0) } as File, "request")).rejects.toMatchObject({ code: "INVALID_FILE" });
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
  });

  it("clears both managed and legacy avatars before trashing the old asset", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValueOnce([{ id: userId }]).mockResolvedValueOnce([{ id: oldMediaId, uploadedById: userId, trashedAt: null }]).mockResolvedValueOnce([{ referenced: false }]), profile: { findUnique: vi.fn().mockResolvedValue({ avatarMediaId: oldMediaId }), update: vi.fn().mockResolvedValue({ avatarMediaId: null, avatarUrl: null }), count: vi.fn().mockResolvedValue(0) }, mediaAsset: { findUnique: vi.fn().mockResolvedValue({ uploadedById: userId, trashedAt: null }) } };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    await deleteManagedAvatar(userId, "request");
    expect(tx.profile.update).toHaveBeenCalledWith({ where: { id: userId }, data: { avatarMediaId: null, avatarUrl: null } });
    expect(mocks.moveToTrash).toHaveBeenCalledWith("media-asset", oldMediaId, { actorId: userId, requestId: "request" });
  });

  it("trashes a new upload when profile linking fails", async () => {
    mocks.transaction.mockRejectedValue(new Error("database unavailable"));
    const file = { name: "avatar.png", type: "image/png", size: 1, arrayBuffer: async () => new Uint8Array([1]).buffer } as File;
    await expect(replaceManagedAvatar(userId, file, "request")).rejects.toThrow("database unavailable");
    expect(mocks.moveToTrash).toHaveBeenCalledWith("media-asset", newMediaId, { actorId: userId, requestId: "request" });
  });

  it("preserves an old avatar that remains referenced by content", async () => {
    const queryRaw = vi.fn()
      .mockResolvedValueOnce([{ id: userId }])
      .mockResolvedValueOnce([{ id: oldMediaId, uploadedById: userId, trashedAt: null }])
      .mockResolvedValueOnce([{ referenced: true }]);
    const tx = { $queryRaw: queryRaw, profile: { findUnique: vi.fn().mockResolvedValue({ avatarMediaId: oldMediaId }), update: vi.fn(), count: vi.fn().mockResolvedValue(0) } };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    await deleteManagedAvatar(userId, "request");

    expect(mocks.moveToTrash).not.toHaveBeenCalled();
    const dependencySql = queryRaw.mock.calls[2][0].strings.join(" ");
    expect(dependencySql).toContain('FROM "ContentLesson"');
    expect(dependencySql).toContain('FROM "Feedback"');
    expect(dependencySql).toContain('FROM "AttemptQuestion"');
  });
});

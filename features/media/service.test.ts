import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  createSignedUrl: vi.fn(),
  createSignedUrls: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  tx: {
    mediaAsset: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction, mediaAsset: { findMany: mocks.findMany, count: mocks.count } } }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ storage: { from: () => ({ createSignedUrl: mocks.createSignedUrl, createSignedUrls: mocks.createSignedUrls, upload: mocks.upload, remove: mocks.remove }) } }),
}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({
  SUPABASE_STORAGE_MAX_FILE_MB: 8,
  SUPABASE_STORAGE_ALLOWED_MIME_TYPES: "image/png,image/jpeg,image/webp",
  SUPABASE_STORAGE_BUCKET: "anatomy-media",
}) }));
vi.mock("./image", () => ({ inspectImage: vi.fn().mockResolvedValue({ mimeType: "image/png", width: 10, height: 10 }) }));

import { getAdminMediaMap, getPublishedMedia, listMedia, uploadMedia } from "./service";

const asset = {
  id: "10000000-0000-4000-8000-000000000001", originalFilename: "old.png", mimeType: "image/png", byteSize: BigInt(10),
  width: 10, height: 10, altText: "Historical image", archivedAt: new Date(), uploadedById: "uploader", createdAt: new Date(), updatedAt: new Date(),
  bucket: "private", path: "old.png",
};

describe("historical attempt media authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.mediaAsset.findFirst.mockResolvedValue(null);
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/old" }, error: null });
    mocks.createSignedUrls.mockResolvedValue({ data: [{ path: "old.png", signedUrl: "https://signed.example/old" }], error: null });
  });

  it("keeps an uploaded object and metadata when only preview signing is temporarily unavailable", async () => {
    const created = { ...asset, bucket: "anatomy-media", path: "media/uploader/asset.png", archivedAt: null };
    mocks.upload.mockResolvedValue({ data: { path: created.path }, error: null });
    mocks.tx.mediaAsset.create.mockResolvedValue(created);
    mocks.tx.auditLog.create.mockResolvedValue({});
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: { message: "temporary" } });

    const result = await uploadMedia(
      {
        name: "heart.png",
        type: "image/png",
        size: 1,
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      } as File,
      "Heart anatomy",
      "uploader",
      "request-id",
    );

    expect(result).toMatchObject({ id: created.id, signedUrl: null, signedUrlExpiresIn: null });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("keeps the media list available when one preview cannot be signed", async () => {
    mocks.transaction.mockResolvedValue([[asset], 1]);
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: { message: "temporary" } });

    await expect(listMedia({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      items: [{ id: asset.id, signedUrl: null, signedUrlExpiresIn: null }],
    });
  });

  it("allows an archived snapshot asset only when the authenticated owner has a matching attempt question", async () => {
    mocks.tx.$queryRaw.mockResolvedValue([{ id: "attempt-question" }]);
    mocks.tx.mediaAsset.findUnique.mockResolvedValue(asset);
    await expect(getPublishedMedia(asset.id, "owner")).resolves.toMatchObject({ id: asset.id, signedUrlExpiresIn: 300 });
    const query = mocks.tx.$queryRaw.mock.calls[0][0];
    expect(query.values).toEqual(expect.arrayContaining(["owner", asset.id, asset.id]));
  });

  it("does not grant another user's or absent snapshot", async () => {
    mocks.tx.$queryRaw.mockResolvedValue([]);
    await expect(getPublishedMedia(asset.id, "other-user")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.tx.mediaAsset.findUnique).not.toHaveBeenCalled();
  });

  it("batch signs distinct managed assets, including archived history, without exposing storage coordinates", async () => {
    mocks.findMany.mockResolvedValue([asset]);
    const missingId = "10000000-0000-4000-8000-000000000099";

    const result = await getAdminMediaMap([asset.id, asset.id, missingId]);

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: [asset.id, missingId] } },
    }));
    expect(mocks.createSignedUrls).toHaveBeenCalledWith([asset.path], 900);
    expect(result.get(asset.id)).toEqual({
      id: asset.id, signedUrl: "https://signed.example/old", width: 10, height: 10, altText: "Historical image",
    });
    expect(result.get(asset.id)).not.toHaveProperty("bucket");
    expect(result.get(asset.id)).not.toHaveProperty("path");
    expect(result.has(missingId)).toBe(false);
  });

  it("keeps admin historical detail available when batch preview signing fails", async () => {
    mocks.findMany.mockResolvedValue([asset]);
    mocks.createSignedUrls.mockResolvedValue({ data: null, error: { message: "temporary" } });

    await expect(getAdminMediaMap([asset.id])).resolves.toEqual(new Map());
  });
});

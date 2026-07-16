import "server-only";
import { Prisma } from "@prisma/client";

import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { logError } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mediaDto } from "./dto";
import { hasPublishedMediaReference, MediaServiceError } from "./domain";
import { inspectImage } from "./image";
import { buildMediaPath } from "./schemas";

const select = { id: true, originalFilename: true, mimeType: true, byteSize: true, width: true, height: true, altText: true, archivedAt: true, uploadedById: true, createdAt: true, updatedAt: true, bucket: true, path: true } satisfies Prisma.MediaAssetSelect;
type SelectedMedia = Prisma.MediaAssetGetPayload<{ select: typeof select }>;

function safeProviderValue(value: unknown) {
  return typeof value === "string" ? value.replace(/[\r\n]/g, " ").slice(0, 240) : undefined;
}

function storageUploadError(error: unknown, requestId: string) {
  const providerError = error as { name?: unknown; message?: unknown; status?: unknown };
  const status = typeof providerError.status === "number" && providerError.status >= 400 ? providerError.status : 502;
  logError({
    requestId,
    code: "MEDIA_STORAGE_UPLOAD_FAILED",
    status,
    route: "/admin/media/upload",
    details: {
      provider: "supabase",
      operation: "storage.upload",
      name: safeProviderValue(providerError.name) ?? "StorageError",
      message: safeProviderValue(providerError.message) ?? "Storage provider did not return a message.",
    },
  });
  return new MediaServiceError("STORAGE_ERROR", "Image upload failed.");
}

export type AdminMediaReference = {
  id: string;
  signedUrl: string;
  width: number | null;
  height: number | null;
  altText: string;
};

async function withSignedUrl(asset: SelectedMedia, expiresIn = 900, required = false) {
  const { data, error } = await createSupabaseAdminClient().storage.from(asset.bucket).createSignedUrl(asset.path, expiresIn);
  const { bucket: _bucket, path: _path, ...dto } = asset;
  void _bucket; void _path;
  if (error || !data?.signedUrl) {
    if (required) throw new MediaServiceError("STORAGE_ERROR", "Could not create a media access URL.");
    return mediaDto(dto, null, null);
  }
  return mediaDto(dto, data.signedUrl, expiresIn);
}

export async function uploadMedia(file: File, altText: string, actorId: string, requestId: string) {
  const env = getServerEnv();
  if (!file.size || file.size > env.SUPABASE_STORAGE_MAX_FILE_MB * 1024 * 1024) throw new MediaServiceError("INVALID_FILE", "File size is invalid.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let image;
  try { image = await inspectImage(bytes); } catch { throw new MediaServiceError("INVALID_FILE", "Only valid PNG, JPEG, or WebP images are accepted."); }
  const allowed = env.SUPABASE_STORAGE_ALLOWED_MIME_TYPES.split(",").map((value) => value.trim());
  if (!allowed.includes(image.mimeType) || (file.type && file.type !== image.mimeType)) throw new MediaServiceError("INVALID_FILE", "The declared image type does not match its contents.");
  const assetId = crypto.randomUUID();
  const path = buildMediaPath(actorId, assetId, image.mimeType);
  const storage = createSupabaseAdminClient().storage.from(env.SUPABASE_STORAGE_BUCKET);
  let uploaded;
  try {
    uploaded = await storage.upload(path, bytes, { contentType: image.mimeType, upsert: false });
  } catch (error) {
    throw storageUploadError(error, requestId);
  }
  if (uploaded.error) throw storageUploadError(uploaded.error, requestId);
  let asset: SelectedMedia;
  try {
    asset = await prisma.$transaction(async (tx) => {
      const created = await tx.mediaAsset.create({ data: { id: assetId, bucket: env.SUPABASE_STORAGE_BUCKET, path, visibility: "PRIVATE", originalFilename: file.name.slice(0, 255) || "image", mimeType: image.mimeType, byteSize: file.size, width: image.width, height: image.height, altText, uploadedById: actorId }, select });
      await tx.auditLog.create({ data: { actorId, action: "CREATE", entityType: "MediaAsset", entityId: created.id, afterSnapshot: { originalFilename: created.originalFilename, mimeType: created.mimeType, byteSize: created.byteSize.toString(), width: created.width, height: created.height, altText: created.altText }, requestId } });
      return created;
    });
  } catch (error) {
    try {
      const removed = await storage.remove([path]);
      if (removed?.error) {
        logError({ requestId, code: "MEDIA_STORAGE_COMPENSATION_FAILED", status: 502, route: "/admin/media/upload", details: { provider: "supabase", operation: "storage.remove", name: safeProviderValue(removed.error.name) ?? "StorageError", message: safeProviderValue(removed.error.message) ?? "Storage provider did not return a message." } });
      }
    } catch (compensationError) {
      const providerError = compensationError as { name?: unknown; message?: unknown };
      logError({ requestId, code: "MEDIA_STORAGE_COMPENSATION_FAILED", status: 502, route: "/admin/media/upload", details: { provider: "supabase", operation: "storage.remove", name: safeProviderValue(providerError.name) ?? "StorageError", message: safeProviderValue(providerError.message) ?? "Storage provider did not return a message." } });
    }
    logError({ requestId, code: "MEDIA_METADATA_PERSIST_FAILED", status: 500, route: "/admin/media/upload" });
    throw error;
  }
  return withSignedUrl(asset);
}

export async function listMedia(input: { page: number; pageSize: number; search?: string; mimeType?: string; archived?: boolean; uploadedById?: string }) {
  const where: Prisma.MediaAssetWhereInput = { trashedAt: null, ...(input.search && { OR: [{ originalFilename: { contains: input.search, mode: "insensitive" } }, { altText: { contains: input.search, mode: "insensitive" } }] }), ...(input.mimeType && { mimeType: input.mimeType }), ...(input.uploadedById && { uploadedById: input.uploadedById }), ...(input.archived !== undefined && { archivedAt: input.archived ? { not: null } : null }) };
  const [assets, total] = await prisma.$transaction([prisma.mediaAsset.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize, select }), prisma.mediaAsset.count({ where })]);
  return { items: await Promise.all(assets.map((asset) => withSignedUrl(asset))), pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) } };
}

export async function getMedia(id: string) {
  const asset = await prisma.mediaAsset.findFirst({ where: { id, trashedAt: null }, select });
  if (!asset) throw new MediaServiceError("NOT_FOUND", "Media asset was not found.");
  return withSignedUrl(asset);
}

export async function getAdminMediaMap(ids: readonly string[]) {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return new Map<string, AdminMediaReference>();
  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, bucket: true, path: true, width: true, height: true, altText: true },
  });
  const byBucket = new Map<string, typeof assets>();
  for (const asset of assets) byBucket.set(asset.bucket, [...(byBucket.get(asset.bucket) ?? []), asset]);

  const client = createSupabaseAdminClient();
  const entries = await Promise.all([...byBucket.entries()].map(async ([bucket, bucketAssets]) => {
    const { data, error } = await client.storage.from(bucket).createSignedUrls(bucketAssets.map((asset) => asset.path), 900);
    if (error || !data) return [];
    return bucketAssets.flatMap((asset, index) => {
      const signedUrl = data[index]?.signedUrl;
      return signedUrl ? [[asset.id, { id: asset.id, signedUrl, width: asset.width, height: asset.height, altText: asset.altText }] as const] : [];
    });
  }));
  return new Map<string, AdminMediaReference>(entries.flat());
}

async function getPublishedMediaInTransaction(tx: Prisma.TransactionClient, id: string) {
  const asset = await tx.mediaAsset.findFirst({
    where: { id, archivedAt: null, trashedAt: null },
    select: {
      ...select,
      organSystemCovers: { where: { trashedAt: null, status: "PUBLISHED", isActive: true }, select: { id: true } },
      organSystemIcons: { where: { trashedAt: null, status: "PUBLISHED", isActive: true }, select: { id: true } },
      topicCovers: { where: { trashedAt: null, status: "PUBLISHED", organSystem: { trashedAt: null, status: "PUBLISHED", isActive: true } }, select: { id: true } },
      flashcardFronts: { where: { trashedAt: null, status: "PUBLISHED", topic: { trashedAt: null, status: "PUBLISHED", organSystem: { trashedAt: null, status: "PUBLISHED", isActive: true } } }, select: { id: true } },
      flashcardBacks: { where: { trashedAt: null, status: "PUBLISHED", topic: { trashedAt: null, status: "PUBLISHED", organSystem: { trashedAt: null, status: "PUBLISHED", isActive: true } } }, select: { id: true } },
      questionMedia: { where: { trashedAt: null, status: "PUBLISHED", isActive: true, topic: { trashedAt: null, status: "PUBLISHED", organSystem: { trashedAt: null, status: "PUBLISHED", isActive: true } } }, select: { id: true } },
      questionOptionMedia: { where: { question: { trashedAt: null, status: "PUBLISHED", isActive: true, topic: { trashedAt: null, status: "PUBLISHED", organSystem: { trashedAt: null, status: "PUBLISHED", isActive: true } } } }, select: { id: true } },
    },
  });
  if (!asset) return null;
  const lessons = await tx.$queryRaw<Array<{ contentBlocks: Prisma.JsonValue }>>(Prisma.sql`
    SELECT lesson."contentBlocks"
    FROM "ContentLesson" lesson
    JOIN "Topic" topic ON topic."id" = lesson."topicId"
    JOIN "OrganSystem" system ON system."id" = topic."organSystemId"
    WHERE lesson."trashedAt" IS NULL
      AND topic."trashedAt" IS NULL
      AND system."trashedAt" IS NULL
      AND lesson."status" = 'PUBLISHED'::"PublishStatus"
      AND topic."status" = 'PUBLISHED'::"PublishStatus"
      AND system."status" = 'PUBLISHED'::"PublishStatus"
      AND system."isActive" = true
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(lesson."contentBlocks") = 'array' THEN lesson."contentBlocks" ELSE '[]'::jsonb END
        ) block
        WHERE block->>'mediaId' = ${id}
      )
  `);
  if (!hasPublishedMediaReference(asset, lessons, id)) return null;
  const {
    organSystemCovers: _covers,
    organSystemIcons: _icons,
    topicCovers: _topics,
    flashcardFronts: _fronts,
    flashcardBacks: _backs,
    questionMedia: _questions,
    questionOptionMedia: _options,
    ...selected
  } = asset;
  void _covers; void _icons; void _topics; void _fronts; void _backs; void _questions; void _options;
  return selected;
}

async function getHistoricalMediaInTransaction(tx: Prisma.TransactionClient, id: string, userId: string) {
  const references = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT question."id"
    FROM "AttemptQuestion" question
    JOIN "AssessmentAttempt" attempt ON attempt."id" = question."attemptId"
    WHERE attempt."userId" = ${userId}::uuid
      AND (
        question."mediaIdSnapshot" = ${id}::uuid
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(question."optionsSnapshot") = 'array' THEN question."optionsSnapshot" ELSE '[]'::jsonb END
          ) option
          WHERE option->>'mediaId' = ${id}
        )
      )
    LIMIT 1
  `);
  if (!references.length) return null;
  return tx.mediaAsset.findUnique({ where: { id }, select });
}

export async function getPublishedMedia(id: string, userId: string) {
  const asset = await prisma.$transaction(async (tx) =>
    await getPublishedMediaInTransaction(tx, id) ?? await getHistoricalMediaInTransaction(tx, id, userId));
  if (!asset) throw new MediaServiceError("NOT_FOUND", "Media asset was not found.");
  const dto = await withSignedUrl(asset, 300, true);
  return {
    id: dto.id,
    mimeType: dto.mimeType,
    width: dto.width,
    height: dto.height,
    altText: dto.altText,
    signedUrl: dto.signedUrl,
    signedUrlExpiresIn: dto.signedUrlExpiresIn,
  };
}

export async function updateMedia(id: string, altText: string, actorId: string, requestId: string) {
  const asset = await prisma.$transaction(async (tx) => {
    const before = await tx.mediaAsset.findFirst({ where: { id, trashedAt: null }, select });
    if (!before) throw new MediaServiceError("NOT_FOUND", "Media asset was not found.");
    const updated = await tx.mediaAsset.update({ where: { id }, data: { altText }, select });
    await tx.auditLog.create({ data: { actorId, action: "UPDATE", entityType: "MediaAsset", entityId: id, beforeSnapshot: { altText: before.altText }, afterSnapshot: { altText }, requestId } });
    return updated;
  });
  return withSignedUrl(asset);
}

export async function archiveMedia(id: string, actorId: string, requestId: string) {
  const asset = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MediaAsset" WHERE "id"::text = ${id} AND "trashedAt" IS NULL FOR UPDATE`);
    const before = await tx.mediaAsset.findFirst({ where: { id, trashedAt: null }, select });
    if (!before) throw new MediaServiceError("NOT_FOUND", "Media asset was not found.");
    if (before.archivedAt) return before;
    if (await getPublishedMediaInTransaction(tx, id)) throw new MediaServiceError("REFERENCED", "Media used by published content cannot be archived.");
    const updated = await tx.mediaAsset.update({ where: { id }, data: { archivedAt: new Date() }, select });
    await tx.auditLog.create({ data: { actorId, action: "ARCHIVE", entityType: "MediaAsset", entityId: id, beforeSnapshot: { archivedAt: null }, afterSnapshot: { archivedAt: updated.archivedAt?.toISOString() }, requestId } });
    return updated;
  });
  return withSignedUrl(asset);
}

export async function deleteMedia(id: string, actorId: string, requestId: string) {
  void actorId; void requestId;
  const exists = await prisma.mediaAsset.findFirst({ where: { id, trashedAt: null }, select: { id: true } });
  if (!exists) throw new MediaServiceError("NOT_FOUND", "Media asset was not found.");
  throw new MediaServiceError("HARD_DELETE_DISABLED", "Physical media deletion is disabled; archive the asset instead.");
}

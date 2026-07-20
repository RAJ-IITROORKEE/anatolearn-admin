import "server-only";

import { Prisma } from "@prisma/client";

import { inspectImage } from "@/features/media/image";
import { getMediaDependencyState } from "@/features/media/references";
import { uploadMedia } from "@/features/media/service";
import { moveToTrash } from "@/features/trash/service";
import { prisma } from "@/lib/db/prisma";
import { logError } from "@/lib/logger";

const MAX_AVATAR_BYTES = 1_048_576;

export class AvatarError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

async function trashAvatar(mediaId: string, actorId: string, requestId: string) {
  try {
    await moveToTrash("media-asset", mediaId, { actorId, requestId });
  } catch {
    logError({ requestId, code: "AVATAR_TRASH_FAILED", status: 500, route: "/api/v1/me/avatar" });
  }
}

async function clearOrReplace(userId: string, avatarMediaId: string | null) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Profile" WHERE "id" = ${userId}::uuid AND "isActive" = true FOR UPDATE`);
    if (!locked.length) throw new AvatarError("NOT_FOUND", "Active profile was not found.", 404);
    const before = await tx.profile.findUnique({ where: { id: userId }, select: { avatarMediaId: true } });
    await tx.profile.update({ where: { id: userId }, data: { avatarMediaId, avatarUrl: null } });
    if (!before?.avatarMediaId || before.avatarMediaId === avatarMediaId) return null;
    const dependency = await getMediaDependencyState(tx, before.avatarMediaId);
    return dependency?.uploadedById === userId && dependency.trashedAt === null && !dependency.referenced ? before.avatarMediaId : null;
  });
}

export async function replaceManagedAvatar(userId: string, file: File, requestId: string) {
  if (!file.size || file.size > MAX_AVATAR_BYTES) throw new AvatarError("INVALID_FILE", "Avatar must be no larger than 1 MiB.");
  if (file.type !== "image/png" && file.type !== "image/jpeg") throw new AvatarError("INVALID_FILE", "Avatar must be PNG or JPEG.");
  let image;
  try {
    image = await inspectImage(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new AvatarError("INVALID_FILE", "Avatar contains invalid image bytes.");
  }
  if (image.mimeType !== file.type || (image.mimeType !== "image/png" && image.mimeType !== "image/jpeg")) {
    throw new AvatarError("INVALID_FILE", "Avatar type does not match its bytes.");
  }

  const uploaded = await uploadMedia(file, "", userId, requestId);
  let oldMediaId: string | null;
  try {
    oldMediaId = await clearOrReplace(userId, uploaded.id);
  } catch (error) {
    await trashAvatar(uploaded.id, userId, requestId);
    throw error;
  }
  if (oldMediaId && oldMediaId !== uploaded.id) await trashAvatar(oldMediaId, userId, requestId);
}

export async function deleteManagedAvatar(userId: string, requestId: string) {
  const oldMediaId = await clearOrReplace(userId, null);
  if (oldMediaId) await trashAvatar(oldMediaId, userId, requestId);
}

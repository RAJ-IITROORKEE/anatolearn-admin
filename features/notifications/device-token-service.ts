import "server-only";

import { Prisma, type DevicePlatform } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { NotificationError } from "./domain";
import { deviceTokenDto } from "./dto";

export async function registerDeviceToken(userId: string, input: { expoPushToken: string; platform: DevicePlatform }) {
  return prisma.$transaction(async (tx) => {
    const profiles = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "Profile"
      WHERE "id" = ${userId}::uuid AND "isActive" = true
      FOR SHARE
    `);
    if (!profiles.length) throw new NotificationError("PROFILE_INACTIVE", "The destination profile is not active.", 403);
    const rows = await tx.$queryRaw<Array<{ id: string; userId: string }>>(Prisma.sql`
      SELECT "id", "userId" FROM "DeviceToken"
      WHERE "expoPushToken" = ${input.expoPushToken}
      FOR UPDATE
    `);
    const existing = rows[0];
    if (existing && existing.userId !== userId) {
      await tx.notificationDelivery.updateMany({
        where: { deviceTokenId: existing.id, status: "PENDING" },
        data: { status: "CANCELLED", nextAttemptAt: null, processingToken: null, processingLeaseUntil: null },
      });
      await tx.deviceToken.update({ where: { id: existing.id }, data: { isActive: false } });
    }
    const row = existing
      ? await tx.deviceToken.update({
          where: { id: existing.id },
          data: { userId, platform: input.platform, isActive: true, lastSeenAt: new Date() },
        })
      : await tx.deviceToken.create({ data: { userId, ...input } });
    return deviceTokenDto(row);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function deactivateDeviceToken(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const profiles = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "Profile" WHERE "id" = ${userId}::uuid FOR SHARE
    `);
    if (!profiles.length) throw new NotificationError("NOT_FOUND", "Device token was not found.", 404);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "DeviceToken" WHERE "id" = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE
    `);
    if (!rows.length) throw new NotificationError("NOT_FOUND", "Device token was not found.", 404);
    await tx.deviceToken.update({ where: { id }, data: { isActive: false } });
    await tx.notificationDelivery.updateMany({
      where: { deviceTokenId: id, status: "PENDING" },
      data: { status: "CANCELLED", nextAttemptAt: null, processingToken: null, processingLeaseUntil: null },
    });
    return { deactivated: true };
  });
}

import "server-only";

import { Prisma, type AuditAction, type Flashcard, type PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { refreshTopicProgress } from "@/features/progress/projection";
import { assertFlashcardMutable, assertFlashcardPublishable, assertFlashcardStatusTransition, FlashcardError } from "./domain";
import { flashcardDto, flashcardProgressDto } from "./dto";
import type { FlashcardCreateInput, FlashcardListInput, FlashcardProgressInput, FlashcardUpdateInput } from "./schemas";

type MutationContext = { actorId: string; requestId: string; userAgent?: string | null };
type Parent = { status: PublishStatus; organSystem: { status: PublishStatus; isActive: boolean } };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const PROGRESS_TRANSACTION_ATTEMPTS = 3;

function pagination(total: number, input: FlashcardListInput) {
  return { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) };
}

async function audit(tx: Prisma.TransactionClient, context: MutationContext, action: AuditAction, entityId: string, before: unknown, after: unknown) {
  await tx.auditLog.create({
    data: {
      actorId: context.actorId,
      action,
      entityType: "flashcard",
      entityId,
      beforeSnapshot: before == null ? Prisma.JsonNull : json(before),
      afterSnapshot: after == null ? Prisma.JsonNull : json(after),
      requestId: context.requestId,
      userAgent: context.userAgent,
    },
  });
}

async function validateMedia(tx: Prisma.TransactionClient, ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return true;
  const mediaIds = unique.map((id) => Prisma.sql`${id}::uuid`);
  const rows = await tx.$queryRaw<Array<{ id: string; archivedAt: Date | null }>>(Prisma.sql`
    SELECT "id", "archivedAt" FROM "MediaAsset"
    WHERE "id" IN (${Prisma.join(mediaIds)}) AND "trashedAt" IS NULL FOR SHARE
  `);
  const eligible = rows.length === unique.length && rows.every((row) => row.archivedAt === null);
  if (!eligible) throw new FlashcardError("INVALID_MEDIA_REFERENCE", "A media reference is absent or archived.", 422);
  return true;
}

async function lockFlashcard(tx: Prisma.TransactionClient, id: string) {
  return tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Flashcard"
    WHERE "id" = CAST(${id} AS UUID) AND "trashedAt" IS NULL
    FOR UPDATE
  `);
}

async function lockFlashcards(tx: Prisma.TransactionClient, ids: string[]) {
  const sortedIds = [...ids].sort();
  return tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Flashcard"
    WHERE "id" IN (${Prisma.join(sortedIds.map((id) => Prisma.sql`CAST(${id} AS UUID)`) )}) AND "trashedAt" IS NULL
    ORDER BY "id"
    FOR UPDATE
  `);
}

async function getParent(tx: Prisma.TransactionClient, topicId: string): Promise<Parent> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT topic."id" FROM "Topic" topic
    JOIN "OrganSystem" system ON system."id" = topic."organSystemId"
    WHERE topic."id" = ${topicId}::uuid AND topic."trashedAt" IS NULL AND system."trashedAt" IS NULL
    FOR SHARE OF topic, system
  `);
  if (!locked.length) throw new FlashcardError("PARENT_NOT_FOUND", "Topic was not found.", 422);
  const parent = await tx.topic.findFirst({
    where: { id: topicId, trashedAt: null, organSystem: { trashedAt: null } },
    select: { status: true, organSystem: { select: { status: true, isActive: true } } },
  });
  if (!parent) throw new FlashcardError("PARENT_NOT_FOUND", "Topic was not found.", 422);
  return parent;
}

function assertPublishable(parent: Parent, mediaEligible: boolean) {
  assertFlashcardPublishable({
    topicStatus: parent.status,
    organSystemStatus: parent.organSystem.status,
    organSystemIsActive: parent.organSystem.isActive,
    mediaEligible,
  });
}

export async function listAdminFlashcards(input: FlashcardListInput) {
  const where: Prisma.FlashcardWhereInput = {
    trashedAt: null,
    topic: input.organSystemId ? { organSystemId: input.organSystemId, trashedAt: null, organSystem: { trashedAt: null } } : { trashedAt: null, organSystem: { trashedAt: null } },
    status: input.status,
    difficulty: input.difficulty,
    topicId: input.topicId,
    ...(input.q ? { OR: [
      { frontText: { contains: input.q, mode: "insensitive" } },
      { backText: { contains: input.q, mode: "insensitive" } },
      { notes: { contains: input.q, mode: "insensitive" } },
    ] } : {}),
  };
  const orderBy: Prisma.FlashcardOrderByWithRelationInput[] = [
    { [input.sortBy]: input.sortOrder },
    { id: input.sortOrder },
  ];
  const [rows, total] = await prisma.$transaction([
    prisma.flashcard.findMany({ where, skip: (input.page - 1) * input.pageSize, take: input.pageSize, orderBy }),
    prisma.flashcard.count({ where }),
  ]);
  return { items: rows.map((row) => flashcardDto(row, true)), pagination: pagination(total, input) };
}

export async function getAdminFlashcard(id: string) {
  const row = await prisma.flashcard.findFirst({ where: { id, trashedAt: null, topic: { trashedAt: null, organSystem: { trashedAt: null } } } });
  if (!row) throw new FlashcardError("NOT_FOUND", "Flashcard was not found.", 404);
  return flashcardDto(row, true);
}

export async function createFlashcard(input: FlashcardCreateInput, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    await getParent(tx, input.topicId);
    await validateMedia(tx, [input.frontMediaId, input.backMediaId]);
    const row = await tx.flashcard.create({ data: input });
    await audit(tx, context, "CREATE", row.id, null, row);
    return flashcardDto(row, true);
  });
}

export async function updateFlashcard(id: string, input: FlashcardUpdateInput, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockFlashcard(tx, id);
    if (!locked.length) throw new FlashcardError("NOT_FOUND", "Flashcard was not found.", 404);
    const before = await tx.flashcard.findUnique({ where: { id } });
    if (!before) throw new FlashcardError("NOT_FOUND", "Flashcard was not found.", 404);
    assertFlashcardMutable(before.status);
    const candidate = { ...before, ...input };
    const parent = await getParent(tx, candidate.topicId);
    const mediaEligible = await validateMedia(tx, [candidate.frontMediaId, candidate.backMediaId]);
    if (candidate.status === "PUBLISHED") assertPublishable(parent, mediaEligible);
    const after = await tx.flashcard.update({ where: { id }, data: input });
    await audit(tx, context, "UPDATE", id, before, after);
    return flashcardDto(after, true);
  });
}

export async function setFlashcardStatus(id: string, status: PublishStatus, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockFlashcard(tx, id);
    if (!locked.length) throw new FlashcardError("NOT_FOUND", "Flashcard was not found.", 404);
    const before = await tx.flashcard.findUnique({ where: { id } });
    if (!before) throw new FlashcardError("NOT_FOUND", "Flashcard was not found.", 404);
    assertFlashcardStatusTransition(before.status, status);
    if (before.status === status) return flashcardDto(before, true);
    if (status === "PUBLISHED") {
      const parent = await getParent(tx, before.topicId);
      const mediaEligible = await validateMedia(tx, [before.frontMediaId, before.backMediaId]);
      assertPublishable(parent, mediaEligible);
    }
    const after = await tx.flashcard.update({ where: { id }, data: { status } });
    await audit(tx, context, status === "ARCHIVED" ? "ARCHIVE" : status === "PUBLISHED" ? "PUBLISH" : "UPDATE", id, before, after);
    return flashcardDto(after, true);
  });
}

export async function reorderFlashcards(parentId: string, ids: string[], context: MutationContext) {
  await prisma.$transaction(async (tx) => {
    const parent = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT topic."id" FROM "Topic" topic
      JOIN "OrganSystem" system ON system."id" = topic."organSystemId"
      WHERE topic."id" = ${parentId}::uuid
        AND topic."trashedAt" IS NULL AND system."trashedAt" IS NULL
      FOR SHARE OF topic, system
    `);
    if (!parent.length) throw new FlashcardError("INVALID_REORDER_SCOPE", "The topic is unavailable or in trash.", 422);
    const sortedIds = [...ids].sort();
    const rows = await tx.$queryRaw<Array<{ id: string; displayOrder: number; status: PublishStatus }>>(Prisma.sql`
      SELECT "id", "displayOrder", "status" FROM "Flashcard"
      WHERE "id" IN (${Prisma.join(sortedIds.map((id) => Prisma.sql`CAST(${id} AS UUID)`) )})
        AND "topicId" = ${parentId}::uuid AND "trashedAt" IS NULL
      ORDER BY "id" FOR UPDATE
    `);
    if (rows.length !== ids.length) throw new FlashcardError("INVALID_REORDER_SCOPE", "All IDs must exist in the requested topic.", 422);
    rows.forEach((row) => assertFlashcardMutable(row.status));
    for (const [displayOrder, id] of ids.entries()) {
      await tx.flashcard.update({ where: { id }, data: { displayOrder } });
    }
    await audit(tx, context, "UPDATE", parentId, rows, ids.map((id, displayOrder) => ({ id, displayOrder })));
  });
  return { ids };
}

export async function bulkSetFlashcardStatus(ids: string[], status: PublishStatus, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    const locked = await lockFlashcards(tx, ids);
    if (locked.length !== ids.length) throw new FlashcardError("NOT_FOUND", "One or more flashcards were not found.", 404);
    const rows = await tx.flashcard.findMany({
      where: { id: { in: ids }, trashedAt: null, topic: { trashedAt: null, organSystem: { trashedAt: null } } },
      include: { topic: { select: { status: true, organSystem: { select: { status: true, isActive: true } } } } },
    });
    if (rows.length !== ids.length) throw new FlashcardError("NOT_FOUND", "One or more flashcards were not found.", 404);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = ids.map((id) => byId.get(id)!);
    ordered.forEach((row) => assertFlashcardStatusTransition(row.status, status));
    if (status === "PUBLISHED") {
      await validateMedia(tx, ordered.flatMap((row) => [row.frontMediaId, row.backMediaId]));
      ordered.forEach((row) => assertPublishable(row.topic, true));
    }
    const results: Flashcard[] = [];
    for (const row of ordered) {
      if (row.status === status) {
        results.push(row);
        continue;
      }
      const after = await tx.flashcard.update({ where: { id: row.id }, data: { status } });
      await audit(tx, context, status === "ARCHIVED" ? "ARCHIVE" : status === "PUBLISHED" ? "PUBLISH" : "UPDATE", row.id, row, after);
      results.push(after);
    }
    return results.map((row) => flashcardDto(row, true));
  });
}

const publicCardWhere = (id?: string, topicId?: string): Prisma.FlashcardWhereInput => ({
  id,
  topicId,
  trashedAt: null,
  status: "PUBLISHED",
  topic: { trashedAt: null, status: "PUBLISHED", organSystem: { trashedAt: null, status: "PUBLISHED", isActive: true } },
  AND: [
    { OR: [{ frontMediaId: null }, { frontMedia: { archivedAt: null } }] },
    { OR: [{ backMediaId: null }, { backMedia: { archivedAt: null } }] },
  ],
});

export async function listPublishedFlashcards(topicId: string, userId: string) {
  const topic = await prisma.topic.findFirst({ where: { id: topicId, trashedAt: null, status: "PUBLISHED", organSystem: { trashedAt: null, status: "PUBLISHED", isActive: true } }, select: { id: true } });
  if (!topic) throw new FlashcardError("NOT_FOUND", "Topic was not found.", 404);
  const rows = await prisma.flashcard.findMany({
    where: publicCardWhere(undefined, topicId),
    include: { progress: { where: { userId }, take: 1 } },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => flashcardDto(row, false, row.progress[0]));
}

async function readIdempotentProgress(userId: string, flashcardId: string, eventId: string) {
  const event = await prisma.flashcardViewEvent.findUnique({ where: { userId_eventId: { userId, eventId } } });
  if (!event) return null;
  if (event.flashcardId !== flashcardId) throw new FlashcardError("IDEMPOTENCY_CONFLICT", "eventId was already used for another flashcard.", 409);
  const progress = await prisma.flashcardProgress.findUnique({ where: { userId_flashcardId: { userId, flashcardId } } });
  if (!progress) throw new FlashcardError("INTERNAL_ERROR", "Flashcard progress is unavailable.", 500);
  return flashcardProgressDto(progress);
}

export async function updateFlashcardProgress(flashcardId: string, userId: string, input: FlashcardProgressInput) {
  for (let attempt = 1; attempt <= PROGRESS_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const card = await tx.flashcard.findFirst({ where: publicCardWhere(flashcardId), select: { id: true, topicId: true } });
        if (!card) throw new FlashcardError("NOT_FOUND", "Flashcard was not found.", 404);
        const priorEvent = await tx.flashcardViewEvent.findUnique({ where: { userId_eventId: { userId, eventId: input.eventId } } });
        if (priorEvent) {
          if (priorEvent.flashcardId !== flashcardId) throw new FlashcardError("IDEMPOTENCY_CONFLICT", "eventId was already used for another flashcard.", 409);
          const prior = await tx.flashcardProgress.findUnique({ where: { userId_flashcardId: { userId, flashcardId } } });
          if (!prior) throw new FlashcardError("INTERNAL_ERROR", "Flashcard progress is unavailable.", 500);
          return flashcardProgressDto(prior);
        }
        const now = new Date();
        await tx.flashcardViewEvent.create({ data: { userId, flashcardId, eventId: input.eventId, viewedAt: now } });
        const progress = await tx.flashcardProgress.upsert({
          where: { userId_flashcardId: { userId, flashcardId } },
          create: { userId, flashcardId, viewedCount: 1, isDifficult: input.isDifficult ?? false, isMastered: input.isMastered ?? false, lastViewedAt: now },
          update: {
            viewedCount: { increment: 1 },
            lastViewedAt: now,
            ...(input.isDifficult === undefined ? {} : { isDifficult: input.isDifficult }),
            ...(input.isMastered === undefined ? {} : { isMastered: input.isMastered }),
          },
        });
        await refreshTopicProgress(tx, userId, card.topicId);
        return flashcardProgressDto(progress);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const progress = await readIdempotentProgress(userId, flashcardId, input.eventId);
        if (progress) return progress;
        if (attempt < PROGRESS_TRANSACTION_ATTEMPTS) continue;
        throw new FlashcardError("TRANSACTION_FAILED", "Flashcard progress could not be updated.", 409);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        if (attempt < PROGRESS_TRANSACTION_ATTEMPTS) continue;
        throw new FlashcardError("TRANSACTION_FAILED", "Flashcard progress could not be updated.", 409);
      }
      throw error;
    }
  }
  throw new FlashcardError("TRANSACTION_FAILED", "Flashcard progress could not be updated.", 409);
}

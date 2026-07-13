import "server-only";

import { Prisma, type AuditAction, type PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ContentError, assertPublishedContentValid, assertStatusTransition } from "./domain";
import { lessonDto, organSystemDto, topicDto } from "./dto";
import type { ContentBlock } from "./schemas";

type Resource = "organSystem" | "topic" | "contentLesson";
type ListInput = { page: number; pageSize: number; q?: string; status?: PublishStatus; organSystemId?: string; topicId?: string; sortBy: string; sortOrder: "asc" | "desc" };
type MutationContext = { actorId: string; requestId: string; userAgent?: string | null };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function pagination(total: number, input: ListInput) {
  return { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) };
}

async function validateMedia(tx: Prisma.TransactionClient, ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return;
  const rows = await tx.$queryRaw<Array<{ id: string; archivedAt: Date | null }>>(Prisma.sql`
    SELECT "id", "archivedAt"
    FROM "MediaAsset"
    WHERE "id" IN (${Prisma.join(unique)})
    FOR SHARE
  `);
  if (rows.length !== unique.length || rows.some((row) => row.archivedAt !== null)) throw new ContentError("INVALID_MEDIA_REFERENCE", "A media reference is absent or archived.", 422);
}

async function audit(tx: Prisma.TransactionClient, context: MutationContext, action: AuditAction, entityType: string, entityId: string, before: unknown, after: unknown) {
  await tx.auditLog.create({ data: { actorId: context.actorId, action, entityType, entityId, beforeSnapshot: before == null ? Prisma.JsonNull : json(before), afterSnapshot: after == null ? Prisma.JsonNull : json(after), requestId: context.requestId, userAgent: context.userAgent } });
}

export async function listAdmin(resource: Resource, input: ListInput) {
  const skip = (input.page - 1) * input.pageSize;
  if (resource === "organSystem") {
    const sortBy = input.sortBy === "title" ? "name" : input.sortBy === "name" || input.sortBy === "createdAt" || input.sortBy === "updatedAt" ? input.sortBy : "displayOrder";
    const orderBy: Prisma.OrganSystemOrderByWithRelationInput[] = [{ [sortBy]: input.sortOrder }, { id: input.sortOrder }];
    const where: Prisma.OrganSystemWhereInput = { status: input.status, ...(input.q ? { OR: [{ name: { contains: input.q, mode: "insensitive" } }, { shortDescription: { contains: input.q, mode: "insensitive" } }] } : {}) };
    const [rows, total] = await prisma.$transaction([prisma.organSystem.findMany({ where, skip, take: input.pageSize, orderBy }), prisma.organSystem.count({ where })]);
    return { items: rows.map((row) => organSystemDto(row, true)), pagination: pagination(total, input) };
  }
  if (resource === "topic") {
    const sortBy = input.sortBy === "name" ? "title" : input.sortBy === "title" || input.sortBy === "createdAt" || input.sortBy === "updatedAt" ? input.sortBy : "displayOrder";
    const orderBy: Prisma.TopicOrderByWithRelationInput[] = [{ [sortBy]: input.sortOrder }, { id: input.sortOrder }];
    const where: Prisma.TopicWhereInput = { status: input.status, organSystemId: input.organSystemId, ...(input.q ? { OR: [{ title: { contains: input.q, mode: "insensitive" } }, { summary: { contains: input.q, mode: "insensitive" } }] } : {}) };
    const [rows, total] = await prisma.$transaction([prisma.topic.findMany({ where, skip, take: input.pageSize, orderBy }), prisma.topic.count({ where })]);
    return { items: rows.map((row) => topicDto(row, true)), pagination: pagination(total, input) };
  }
  const sortBy = input.sortBy === "name" ? "title" : input.sortBy === "title" || input.sortBy === "createdAt" || input.sortBy === "updatedAt" ? input.sortBy : "displayOrder";
  const orderBy: Prisma.ContentLessonOrderByWithRelationInput[] = [{ [sortBy]: input.sortOrder }, { id: input.sortOrder }];
  const where: Prisma.ContentLessonWhereInput = { status: input.status, topicId: input.topicId, ...(input.q ? { OR: [{ title: { contains: input.q, mode: "insensitive" } }, { summary: { contains: input.q, mode: "insensitive" } }] } : {}) };
  const [rows, total] = await prisma.$transaction([prisma.contentLesson.findMany({ where, skip, take: input.pageSize, orderBy }), prisma.contentLesson.count({ where })]);
  return { items: rows.map((row) => lessonDto(row, true)), pagination: pagination(total, input) };
}

export async function getAdmin(resource: Resource, id: string) {
  const row = resource === "organSystem" ? await prisma.organSystem.findUnique({ where: { id } }) : resource === "topic" ? await prisma.topic.findUnique({ where: { id } }) : await prisma.contentLesson.findUnique({ where: { id } });
  if (!row) throw new ContentError("NOT_FOUND", "Content was not found.", 404);
  return resource === "organSystem" ? organSystemDto(row as never, true) : resource === "topic" ? topicDto(row as never, true) : lessonDto(row as never, true);
}

export async function createContent(resource: Resource, input: Record<string, unknown>, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    let row: unknown;
    if (resource === "organSystem") {
      await validateMedia(tx, [input.coverMediaId as string, input.iconMediaId as string]);
      row = await tx.organSystem.create({ data: input as Prisma.OrganSystemUncheckedCreateInput });
    } else if (resource === "topic") {
      if (!await tx.organSystem.findUnique({ where: { id: input.organSystemId as string } })) throw new ContentError("PARENT_NOT_FOUND", "Organ system was not found.", 422);
      await validateMedia(tx, [input.coverMediaId as string]);
      row = await tx.topic.create({ data: input as Prisma.TopicUncheckedCreateInput });
    } else {
      if (!await tx.topic.findUnique({ where: { id: input.topicId as string } })) throw new ContentError("PARENT_NOT_FOUND", "Topic was not found.", 422);
      const blocks = input.contentBlocks as ContentBlock[];
      await validateMedia(tx, blocks.filter((block) => block.type === "image").map((block) => block.type === "image" ? block.mediaId : null));
      row = await tx.contentLesson.create({ data: { ...input, contentBlocks: json(blocks) } as Prisma.ContentLessonUncheckedCreateInput });
    }
    const id = (row as { id: string }).id;
    await audit(tx, context, "CREATE", resource, id, null, row);
    return resource === "organSystem" ? organSystemDto(row as never, true) : resource === "topic" ? topicDto(row as never, true) : lessonDto(row as never, true);
  });
}

export async function updateContent(resource: Resource, id: string, input: Record<string, unknown>, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    const before = resource === "organSystem" ? await tx.organSystem.findUnique({ where: { id } }) : resource === "topic" ? await tx.topic.findUnique({ where: { id } }) : await tx.contentLesson.findUnique({ where: { id } });
    if (!before) throw new ContentError("NOT_FOUND", "Content was not found.", 404);
    const data = { ...input };
    if (resource === "organSystem") {
      const organSystem = before as Prisma.OrganSystemGetPayload<Record<string, never>>;
      const candidate = { ...organSystem, ...data };
      await validateMedia(tx, [candidate.coverMediaId, candidate.iconMediaId]);
      assertPublishedContentValid({ resource, status: candidate.status, isActive: candidate.isActive });
    }
    if (resource === "topic") {
      const topic = before as Prisma.TopicGetPayload<Record<string, never>>;
      const candidate = { ...topic, ...data };
      await validateMedia(tx, [candidate.coverMediaId]);
      const parent = await tx.organSystem.findUnique({ where: { id: candidate.organSystemId }, select: { status: true, isActive: true } });
      if (!parent) throw new ContentError("PARENT_NOT_FOUND", "Organ system was not found.", 422);
      assertPublishedContentValid({ resource, status: candidate.status, parentStatus: parent.status, parentIsActive: parent.isActive });
    }
    if (resource === "contentLesson") {
      const lesson = before as Prisma.ContentLessonGetPayload<Record<string, never>>;
      const candidate = { ...lesson, ...data };
      const parent = await tx.topic.findUnique({ where: { id: candidate.topicId as string }, select: { status: true, organSystem: { select: { status: true, isActive: true } } } });
      if (!parent) throw new ContentError("PARENT_NOT_FOUND", "Topic was not found.", 422);
      const blocks = candidate.contentBlocks as ContentBlock[];
      await validateMedia(tx, blocks.filter((block) => block.type === "image").map((block) => block.mediaId));
      assertPublishedContentValid({ resource, status: candidate.status, contentBlocks: blocks, topicStatus: parent.status, organSystemStatus: parent.organSystem.status, organSystemIsActive: parent.organSystem.isActive });
      if (data.contentBlocks) data.contentBlocks = json(data.contentBlocks);
    }
    const after = resource === "organSystem" ? await tx.organSystem.update({ where: { id }, data }) : resource === "topic" ? await tx.topic.update({ where: { id }, data }) : await tx.contentLesson.update({ where: { id }, data });
    await audit(tx, context, "UPDATE", resource, id, before, after);
    return resource === "organSystem" ? organSystemDto(after as never, true) : resource === "topic" ? topicDto(after as never, true) : lessonDto(after as never, true);
  });
}

export async function setStatus(resource: Resource, id: string, status: PublishStatus, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    const before = resource === "organSystem" ? await tx.organSystem.findUnique({ where: { id } }) : resource === "topic" ? await tx.topic.findUnique({ where: { id }, include: { organSystem: true } }) : await tx.contentLesson.findUnique({ where: { id }, include: { topic: { include: { organSystem: true } } } });
    if (!before) throw new ContentError("NOT_FOUND", "Content was not found.", 404);
    assertStatusTransition(before.status, status);
    if (status === "PUBLISHED" && resource === "organSystem") {
      const system = before as Prisma.OrganSystemGetPayload<Record<string, never>>;
      await validateMedia(tx, [system.coverMediaId, system.iconMediaId]);
      assertPublishedContentValid({ resource, status, isActive: system.isActive });
    }
    if (status === "PUBLISHED" && resource === "topic") {
      const topic = before as Prisma.TopicGetPayload<{ include: { organSystem: true } }>;
      await validateMedia(tx, [topic.coverMediaId]);
      assertPublishedContentValid({ resource, status, parentStatus: topic.organSystem.status, parentIsActive: topic.organSystem.isActive });
    }
    if (status === "PUBLISHED" && resource === "contentLesson") {
      const lesson = before as Prisma.ContentLessonGetPayload<{ include: { topic: { include: { organSystem: true } } } }>;
      const parent = lesson.topic;
      const blocks = lesson.contentBlocks as ContentBlock[];
      await validateMedia(tx, blocks.filter((block) => block.type === "image").map((block) => block.mediaId));
      assertPublishedContentValid({ resource, status, contentBlocks: blocks, topicStatus: parent.status, organSystemStatus: parent.organSystem.status, organSystemIsActive: parent.organSystem.isActive });
    }
    const after = resource === "organSystem" ? await tx.organSystem.update({ where: { id }, data: { status } }) : resource === "topic" ? await tx.topic.update({ where: { id }, data: { status } }) : await tx.contentLesson.update({ where: { id }, data: { status } });
    await audit(tx, context, status === "ARCHIVED" ? "ARCHIVE" : status === "PUBLISHED" ? "PUBLISH" : "UPDATE", resource, id, before, after);
    return resource === "organSystem" ? organSystemDto(after as never, true) : resource === "topic" ? topicDto(after as never, true) : lessonDto(after as never, true);
  });
}

export async function reorderContent(resource: Resource, parentId: string | undefined, ids: string[], context: MutationContext) {
  await prisma.$transaction(async (tx) => {
    const rows = resource === "organSystem" ? await tx.organSystem.findMany({ where: { id: { in: ids } }, select: { id: true, displayOrder: true } }) : resource === "topic" ? await tx.topic.findMany({ where: { id: { in: ids }, organSystemId: parentId }, select: { id: true, displayOrder: true } }) : await tx.contentLesson.findMany({ where: { id: { in: ids }, topicId: parentId }, select: { id: true, displayOrder: true } });
    if (rows.length !== ids.length) throw new ContentError("INVALID_REORDER_SCOPE", "All IDs must exist in the requested parent scope.", 422);
    for (const [displayOrder, id] of ids.entries()) {
      if (resource === "organSystem") await tx.organSystem.update({ where: { id }, data: { displayOrder } });
      else if (resource === "topic") await tx.topic.update({ where: { id }, data: { displayOrder } });
      else await tx.contentLesson.update({ where: { id }, data: { displayOrder } });
    }
    await audit(tx, context, "UPDATE", resource, parentId ?? "collection", rows, ids.map((id, displayOrder) => ({ id, displayOrder })));
  });
  return { ids };
}

export async function listPublishedSystems(input: ListInput) {
  const where: Prisma.OrganSystemWhereInput = { status: "PUBLISHED", isActive: true, ...(input.q ? { name: { contains: input.q, mode: "insensitive" } } : {}) };
  const skip = (input.page - 1) * input.pageSize;
  const [rows, total] = await prisma.$transaction([prisma.organSystem.findMany({ where, skip, take: input.pageSize, orderBy: [{ [input.sortBy === "name" ? "name" : "displayOrder"]: input.sortOrder }, { id: input.sortOrder }] }), prisma.organSystem.count({ where })]);
  return { items: rows.map((row) => organSystemDto(row)), pagination: pagination(total, input) };
}

export async function getPublishedSystem(slug: string) {
  const row = await prisma.organSystem.findFirst({ where: { slug, status: "PUBLISHED", isActive: true } });
  if (!row) throw new ContentError("NOT_FOUND", "Organ system was not found.", 404);
  return organSystemDto(row);
}

export async function listPublishedTopics(slug: string, input: ListInput) {
  const system = await prisma.organSystem.findFirst({ where: { slug, status: "PUBLISHED", isActive: true }, select: { id: true } });
  if (!system) throw new ContentError("NOT_FOUND", "Organ system was not found.", 404);
  const where: Prisma.TopicWhereInput = { organSystemId: system.id, status: "PUBLISHED", ...(input.q ? { title: { contains: input.q, mode: "insensitive" } } : {}) };
  const skip = (input.page - 1) * input.pageSize;
  const [rows, total] = await prisma.$transaction([prisma.topic.findMany({ where, skip, take: input.pageSize, orderBy: [{ displayOrder: input.sortOrder }, { id: input.sortOrder }] }), prisma.topic.count({ where })]);
  return { items: rows.map((row) => topicDto(row)), pagination: pagination(total, input) };
}

export async function getPublishedTopic(id: string) {
  const row = await prisma.topic.findFirst({ where: { id, status: "PUBLISHED", organSystem: { status: "PUBLISHED", isActive: true } } });
  if (!row) throw new ContentError("NOT_FOUND", "Topic was not found.", 404);
  return topicDto(row);
}

export async function getPublishedLessons(topicId: string) {
  await getPublishedTopic(topicId);
  const rows = await prisma.contentLesson.findMany({ where: { topicId, status: "PUBLISHED" }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] });
  return rows.map((row) => lessonDto(row));
}

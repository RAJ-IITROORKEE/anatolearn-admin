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
    WHERE "id" IN (${Prisma.join(unique)}) AND "trashedAt" IS NULL
    FOR SHARE
  `);
  if (rows.length !== unique.length || rows.some((row) => row.archivedAt !== null)) throw new ContentError("INVALID_MEDIA_REFERENCE", "A media reference is absent or archived.", 422);
}

async function lockAvailableParent(tx: Prisma.TransactionClient, resource: "organSystem" | "topic", id: string) {
  const rows = resource === "organSystem"
    ? await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "OrganSystem" WHERE "id" = ${id}::uuid AND "trashedAt" IS NULL FOR SHARE`)
    : await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT topic."id" FROM "Topic" topic JOIN "OrganSystem" system ON system."id" = topic."organSystemId"
        WHERE topic."id" = ${id}::uuid AND topic."trashedAt" IS NULL AND system."trashedAt" IS NULL FOR SHARE OF topic, system`);
  if (!rows.length) throw new ContentError("PARENT_NOT_FOUND", resource === "organSystem" ? "Organ system was not found." : "Topic was not found.", 422);
}

async function lockContentRow(tx: Prisma.TransactionClient, resource: Resource, id: string) {
  const target = resource === "organSystem" ? Prisma.raw('"OrganSystem"') : resource === "topic" ? Prisma.raw('"Topic"') : Prisma.raw('"ContentLesson"');
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM ${target} WHERE "id" = ${id}::uuid AND "trashedAt" IS NULL FOR UPDATE
  `);
  if (!rows.length) throw new ContentError("NOT_FOUND", "Content was not found.", 404);
}

async function audit(tx: Prisma.TransactionClient, context: MutationContext, action: AuditAction, entityType: string, entityId: string, before: unknown, after: unknown) {
  await tx.auditLog.create({ data: { actorId: context.actorId, action, entityType, entityId, beforeSnapshot: before == null ? Prisma.JsonNull : json(before), afterSnapshot: after == null ? Prisma.JsonNull : json(after), requestId: context.requestId, userAgent: context.userAgent } });
}

function slugify(value: string) {
  const result = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return result || "organ-system";
}

async function uniqueOrganSystemSlug(tx: Prisma.TransactionClient, name: string, requestedSlug?: string) {
  const base = slugify(requestedSlug || name);
  const rows = await tx.organSystem.findMany({ where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] }, select: { slug: true } });
  const used = new Set(rows.map((row) => row.slug));
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const suffixText = `-${suffix}`;
    const candidate = `${base.slice(0, 100 - suffixText.length)}${suffixText}`;
    if (!used.has(candidate)) return candidate;
  }
}

export async function listAdmin(resource: Resource, input: ListInput) {
  const skip = (input.page - 1) * input.pageSize;
  if (resource === "organSystem") {
    const sortBy = input.sortBy === "title" ? "name" : input.sortBy === "name" || input.sortBy === "createdAt" || input.sortBy === "updatedAt" ? input.sortBy : "displayOrder";
    const orderBy: Prisma.OrganSystemOrderByWithRelationInput[] = [{ [sortBy]: input.sortOrder }, { id: input.sortOrder }];
    const where: Prisma.OrganSystemWhereInput = { trashedAt: null, status: input.status, ...(input.q ? { OR: [{ name: { contains: input.q, mode: "insensitive" } }, { shortDescription: { contains: input.q, mode: "insensitive" } }] } : {}) };
    const [rows, total] = await prisma.$transaction([prisma.organSystem.findMany({ where, skip, take: input.pageSize, orderBy }), prisma.organSystem.count({ where })]);
    return { items: rows.map((row) => organSystemDto(row, true)), pagination: pagination(total, input) };
  }
  if (resource === "topic") {
    const sortBy = input.sortBy === "name" ? "title" : input.sortBy === "title" || input.sortBy === "createdAt" || input.sortBy === "updatedAt" ? input.sortBy : "displayOrder";
    const orderBy: Prisma.TopicOrderByWithRelationInput[] = [{ [sortBy]: input.sortOrder }, { id: input.sortOrder }];
    const where: Prisma.TopicWhereInput = { trashedAt: null, organSystem: { trashedAt: null }, status: input.status, organSystemId: input.organSystemId, ...(input.q ? { OR: [{ title: { contains: input.q, mode: "insensitive" } }, { summary: { contains: input.q, mode: "insensitive" } }] } : {}) };
    const [rows, total] = await prisma.$transaction([prisma.topic.findMany({ where, skip, take: input.pageSize, orderBy }), prisma.topic.count({ where })]);
    return { items: rows.map((row) => topicDto(row, true)), pagination: pagination(total, input) };
  }
  const sortBy = input.sortBy === "name" ? "title" : input.sortBy === "title" || input.sortBy === "createdAt" || input.sortBy === "updatedAt" ? input.sortBy : "displayOrder";
  const orderBy: Prisma.ContentLessonOrderByWithRelationInput[] = [{ [sortBy]: input.sortOrder }, { id: input.sortOrder }];
  const where: Prisma.ContentLessonWhereInput = { trashedAt: null, topic: { trashedAt: null, organSystem: { trashedAt: null } }, status: input.status, topicId: input.topicId, ...(input.q ? { OR: [{ title: { contains: input.q, mode: "insensitive" } }, { summary: { contains: input.q, mode: "insensitive" } }] } : {}) };
  const [rows, total] = await prisma.$transaction([prisma.contentLesson.findMany({ where, skip, take: input.pageSize, orderBy }), prisma.contentLesson.count({ where })]);
  return { items: rows.map((row) => lessonDto(row, true)), pagination: pagination(total, input) };
}

export async function getAdmin(resource: Resource, id: string) {
  const row = resource === "organSystem" ? await prisma.organSystem.findFirst({ where: { id, trashedAt: null } }) : resource === "topic" ? await prisma.topic.findFirst({ where: { id, trashedAt: null, organSystem: { trashedAt: null } } }) : await prisma.contentLesson.findFirst({ where: { id, trashedAt: null, topic: { trashedAt: null, organSystem: { trashedAt: null } } } });
  if (!row) throw new ContentError("NOT_FOUND", "Content was not found.", 404);
  return resource === "organSystem" ? organSystemDto(row as never, true) : resource === "topic" ? topicDto(row as never, true) : lessonDto(row as never, true);
}

export async function getAdminBySlug(resource: "organSystem", slug: string) {
  const row = await prisma.organSystem.findFirst({ where: { slug, trashedAt: null } });
  if (!row) throw new ContentError("NOT_FOUND", "Content was not found.", 404);
  return organSystemDto(row, true);
}

export async function createContent(resource: Resource, input: Record<string, unknown>, context: MutationContext) {
  return prisma.$transaction(async (tx) => {
    let row: unknown;
    if (resource === "organSystem") {
      await validateMedia(tx, [input.coverMediaId as string, input.iconMediaId as string]);
      const data = { ...input, slug: await uniqueOrganSystemSlug(tx, input.name as string, input.slug as string | undefined) };
      row = await tx.organSystem.create({ data: data as Prisma.OrganSystemUncheckedCreateInput });
    } else if (resource === "topic") {
      await lockAvailableParent(tx, "organSystem", input.organSystemId as string);
      await validateMedia(tx, [input.coverMediaId as string]);
      row = await tx.topic.create({ data: input as Prisma.TopicUncheckedCreateInput });
    } else {
      await lockAvailableParent(tx, "topic", input.topicId as string);
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
    await lockContentRow(tx, resource, id);
    const before = resource === "organSystem" ? await tx.organSystem.findFirst({ where: { id, trashedAt: null } }) : resource === "topic" ? await tx.topic.findFirst({ where: { id, trashedAt: null, organSystem: { trashedAt: null } } }) : await tx.contentLesson.findFirst({ where: { id, trashedAt: null, topic: { trashedAt: null, organSystem: { trashedAt: null } } } });
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
      await lockAvailableParent(tx, "organSystem", candidate.organSystemId);
      await validateMedia(tx, [candidate.coverMediaId]);
      const parent = await tx.organSystem.findFirst({ where: { id: candidate.organSystemId, trashedAt: null }, select: { status: true, isActive: true } });
      if (!parent) throw new ContentError("PARENT_NOT_FOUND", "Organ system was not found.", 422);
      assertPublishedContentValid({ resource, status: candidate.status, parentStatus: parent.status, parentIsActive: parent.isActive });
    }
    if (resource === "contentLesson") {
      const lesson = before as Prisma.ContentLessonGetPayload<Record<string, never>>;
      const candidate = { ...lesson, ...data };
      await lockAvailableParent(tx, "topic", candidate.topicId as string);
      const parent = await tx.topic.findFirst({ where: { id: candidate.topicId as string, trashedAt: null, organSystem: { trashedAt: null } }, select: { status: true, organSystem: { select: { status: true, isActive: true } } } });
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
    await lockContentRow(tx, resource, id);
    const before = resource === "organSystem" ? await tx.organSystem.findFirst({ where: { id, trashedAt: null } }) : resource === "topic" ? await tx.topic.findFirst({ where: { id, trashedAt: null, organSystem: { trashedAt: null } }, include: { organSystem: true } }) : await tx.contentLesson.findFirst({ where: { id, trashedAt: null, topic: { trashedAt: null, organSystem: { trashedAt: null } } }, include: { topic: { include: { organSystem: true } } } });
    if (!before) throw new ContentError("NOT_FOUND", "Content was not found.", 404);
    if (resource === "topic") await lockAvailableParent(tx, "organSystem", (before as Prisma.TopicGetPayload<Record<string, never>>).organSystemId);
    if (resource === "contentLesson") await lockAvailableParent(tx, "topic", (before as Prisma.ContentLessonGetPayload<Record<string, never>>).topicId);
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
    const sortedIds = [...ids].sort();
    const lockedIds = Prisma.join(sortedIds.map((id) => Prisma.sql`CAST(${id} AS UUID)`));
    if (resource === "topic") {
      const parent = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "OrganSystem"
        WHERE "id" = ${parentId}::uuid AND "trashedAt" IS NULL
        FOR SHARE
      `);
      if (!parent.length) throw new ContentError("INVALID_REORDER_SCOPE", "The parent is unavailable or in trash.", 422);
    } else if (resource === "contentLesson") {
      const parent = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT topic."id" FROM "Topic" topic
        JOIN "OrganSystem" system ON system."id" = topic."organSystemId"
        WHERE topic."id" = ${parentId}::uuid
          AND topic."trashedAt" IS NULL AND system."trashedAt" IS NULL
        FOR SHARE OF topic, system
      `);
      if (!parent.length) throw new ContentError("INVALID_REORDER_SCOPE", "The parent is unavailable or in trash.", 422);
    }
    const rows = resource === "organSystem"
      ? await tx.$queryRaw<Array<{ id: string; displayOrder: number }>>(Prisma.sql`
          SELECT "id", "displayOrder" FROM "OrganSystem"
          WHERE "id" IN (${lockedIds}) AND "trashedAt" IS NULL
          ORDER BY "id" FOR UPDATE`)
      : resource === "topic"
        ? await tx.$queryRaw<Array<{ id: string; displayOrder: number }>>(Prisma.sql`
            SELECT "id", "displayOrder" FROM "Topic"
            WHERE "id" IN (${lockedIds}) AND "organSystemId" = ${parentId}::uuid AND "trashedAt" IS NULL
            ORDER BY "id" FOR UPDATE`)
        : await tx.$queryRaw<Array<{ id: string; displayOrder: number }>>(Prisma.sql`
            SELECT "id", "displayOrder" FROM "ContentLesson"
            WHERE "id" IN (${lockedIds}) AND "topicId" = ${parentId}::uuid AND "trashedAt" IS NULL
            ORDER BY "id" FOR UPDATE`);
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
  const where: Prisma.OrganSystemWhereInput = { trashedAt: null, status: "PUBLISHED", isActive: true, ...(input.q ? { name: { contains: input.q, mode: "insensitive" } } : {}) };
  const skip = (input.page - 1) * input.pageSize;
  const [rows, total] = await prisma.$transaction([prisma.organSystem.findMany({ where, skip, take: input.pageSize, orderBy: [{ [input.sortBy === "name" ? "name" : "displayOrder"]: input.sortOrder }, { id: input.sortOrder }] }), prisma.organSystem.count({ where })]);
  return { items: rows.map((row) => organSystemDto(row)), pagination: pagination(total, input) };
}

export async function getPublishedSystem(slug: string) {
  const row = await prisma.organSystem.findFirst({ where: { slug, trashedAt: null, status: "PUBLISHED", isActive: true } });
  if (!row) throw new ContentError("NOT_FOUND", "Organ system was not found.", 404);
  return organSystemDto(row);
}

export async function listPublishedTopics(slug: string, input: ListInput) {
  const system = await prisma.organSystem.findFirst({ where: { slug, trashedAt: null, status: "PUBLISHED", isActive: true }, select: { id: true } });
  if (!system) throw new ContentError("NOT_FOUND", "Organ system was not found.", 404);
  const where: Prisma.TopicWhereInput = { organSystemId: system.id, trashedAt: null, status: "PUBLISHED", ...(input.q ? { title: { contains: input.q, mode: "insensitive" } } : {}) };
  const skip = (input.page - 1) * input.pageSize;
  const [rows, total] = await prisma.$transaction([prisma.topic.findMany({ where, skip, take: input.pageSize, orderBy: [{ displayOrder: input.sortOrder }, { id: input.sortOrder }] }), prisma.topic.count({ where })]);
  return { items: rows.map((row) => topicDto(row)), pagination: pagination(total, input) };
}

export async function getPublishedTopic(id: string) {
  const row = await prisma.topic.findFirst({ where: { id, trashedAt: null, status: "PUBLISHED", organSystem: { trashedAt: null, status: "PUBLISHED", isActive: true } } });
  if (!row) throw new ContentError("NOT_FOUND", "Topic was not found.", 404);
  return topicDto(row);
}

export async function getPublishedLessons(topicId: string) {
  await getPublishedTopic(topicId);
  const rows = await prisma.contentLesson.findMany({ where: { topicId, trashedAt: null, status: "PUBLISHED", topic: { trashedAt: null, organSystem: { trashedAt: null } } }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] });
  return rows.map((row) => lessonDto(row));
}

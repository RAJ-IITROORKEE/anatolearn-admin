import "server-only";

import { Prisma } from "@prisma/client";

import { getMediaDependencyState } from "@/features/media/references";
import { prisma } from "@/lib/db/prisma";
import { trashItemDto, type TrashItemRecord } from "./dto";
import { TrashError, type TrashType } from "./domain";
import { trashResourceIdSchema, type TrashListInput } from "./schemas";

type MutationContext = { actorId: string; requestId: string; userAgent?: string | null };
type LockedTrashRow = {
  id: string;
  label: string;
  trashedAt: Date | null;
  purgeAfter: Date | null;
  nextPurgeAttemptAt: Date | null;
};

const tableByType = {
  "organ-system": "OrganSystem",
  topic: "Topic",
  "content-lesson": "ContentLesson",
  flashcard: "Flashcard",
  question: "Question",
  feedback: "Feedback",
  "media-asset": "MediaAsset",
} as const;

const labelByType = {
  "organ-system": Prisma.raw('"name"'),
  topic: Prisma.raw('"title"'),
  "content-lesson": Prisma.raw('"title"'),
  flashcard: Prisma.raw('left("frontText", 160)'),
  question: Prisma.raw('left("questionText", 160)'),
  feedback: Prisma.raw('left("subject", 160)'),
  "media-asset": Prisma.raw('"originalFilename"'),
} as const;

function table(type: TrashType) {
  return Prisma.raw(`"${tableByType[type]}"`);
}

async function databaseNow(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS "now"`);
  if (!row) throw new Error("Database clock is unavailable.");
  return row.now;
}

async function lockRow(tx: Prisma.TransactionClient, type: TrashType, id: string) {
  const rows = await tx.$queryRaw<LockedTrashRow[]>(Prisma.sql`
    SELECT "id", ${labelByType[type]} AS "label", "trashedAt", "purgeAfter", "nextPurgeAttemptAt"
    FROM ${table(type)} WHERE "id" = ${id}::uuid FOR UPDATE
  `);
  return rows[0] ?? null;
}

async function audit(tx: Prisma.TransactionClient, context: MutationContext | null, action: "TRASH" | "RESTORE", type: TrashType, id: string, before: unknown, after: unknown) {
  await tx.auditLog.create({ data: {
    actorId: context?.actorId ?? null,
    action,
    entityType: tableByType[type],
    entityId: id,
    beforeSnapshot: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue,
    afterSnapshot: JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue,
    requestId: context?.requestId,
    userAgent: context?.userAgent,
  } });
}

function toRecord(type: TrashType, row: LockedTrashRow): TrashItemRecord {
  if (!row.trashedAt || !row.purgeAfter || !row.nextPurgeAttemptAt) throw new Error("Trash metadata is incomplete.");
  return { ...row, type, trashedAt: row.trashedAt, purgeAfter: row.purgeAfter, nextPurgeAttemptAt: row.nextPurgeAttemptAt, blockerReason: null, blockerCount: 0 };
}

export async function moveToTrash(type: TrashType, id: string, context: MutationContext) {
  trashResourceIdSchema.parse(id);
  return prisma.$transaction(async (tx) => {
    const before = await lockRow(tx, type, id);
    if (!before) throw new TrashError("NOT_FOUND", "Resource was not found.", 404);
    const now = await databaseNow(tx);
    if (before.trashedAt) return trashItemDto(toRecord(type, before), now);
    if (type === "media-asset" && (await getMediaDependencyState(tx, id))?.referenced) {
      throw new TrashError("PURGE_BLOCKED", "Referenced media cannot be moved to Trash.", 409);
    }

    const status = type === "media-asset"
      ? Prisma.sql`, "archivedAt" = trash_clock."now"`
      : type === "feedback" ? Prisma.empty : Prisma.sql`, "status" = 'ARCHIVED'::"PublishStatus"`;
    const [after] = await tx.$queryRaw<LockedTrashRow[]>(Prisma.sql`
      WITH trash_clock AS (SELECT clock_timestamp() AS "now")
      UPDATE ${table(type)} SET
        "trashedAt" = trash_clock."now",
        "purgeAfter" = trash_clock."now" + interval '30 days',
        "nextPurgeAttemptAt" = trash_clock."now" + interval '30 days'
        ${status}
      FROM trash_clock
      WHERE "id" = ${id}::uuid
      RETURNING "id", ${labelByType[type]} AS "label", "trashedAt", "purgeAfter", "nextPurgeAttemptAt"
    `);
    if (!after) throw new TrashError("NOT_FOUND", "Resource was not found.", 404);
    await audit(tx, context, "TRASH", type, id, { trashedAt: null }, {
      trashedAt: after.trashedAt?.toISOString(),
      purgeAfter: after.purgeAfter?.toISOString(),
    });
    return trashItemDto(toRecord(type, after), now);
  });
}

export async function bulkMoveToTrash(type: "flashcard" | "question" | "feedback", ids: string[], context: MutationContext) {
  const uniqueIds = [...new Set(ids)];
  if (!ids.length || ids.length > 500 || uniqueIds.length !== ids.length) {
    throw new TrashError("NOT_FOUND", "One or more resources were not found.", 404);
  }
  uniqueIds.forEach((id) => trashResourceIdSchema.parse(id));
  const sortedIds = [...uniqueIds].sort();

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<LockedTrashRow[]>(Prisma.sql`
      SELECT "id", ${labelByType[type]} AS "label", "trashedAt", "purgeAfter", "nextPurgeAttemptAt"
      FROM ${table(type)}
      WHERE "id" IN (${Prisma.join(sortedIds.map((id) => Prisma.sql`${id}::uuid`))}) AND "trashedAt" IS NULL
      ORDER BY "id" FOR UPDATE
    `);
    if (locked.length !== uniqueIds.length) throw new TrashError("NOT_FOUND", "One or more resources were not found.", 404);

    const lifecycle = type === "feedback" ? Prisma.empty : Prisma.sql`, "status" = 'ARCHIVED'::"PublishStatus"`;
    const updated = await tx.$queryRaw<LockedTrashRow[]>(Prisma.sql`
      WITH trash_clock AS (SELECT clock_timestamp() AS "now")
      UPDATE ${table(type)} SET
        "trashedAt" = trash_clock."now",
        "purgeAfter" = trash_clock."now" + interval '30 days',
        "nextPurgeAttemptAt" = trash_clock."now" + interval '30 days'
        ${lifecycle}
      FROM trash_clock
      WHERE "id" IN (${Prisma.join(sortedIds.map((id) => Prisma.sql`${id}::uuid`))}) AND "trashedAt" IS NULL
      RETURNING "id", ${labelByType[type]} AS "label", "trashedAt", "purgeAfter", "nextPurgeAttemptAt"
    `);
    if (updated.length !== uniqueIds.length) throw new TrashError("NOT_FOUND", "One or more resources were not found.", 404);

    const byId = new Map(updated.map((row) => [row.id, row]));
    for (const before of locked) {
      const after = byId.get(before.id);
      if (!after) throw new TrashError("NOT_FOUND", "One or more resources were not found.", 404);
      await audit(tx, context, "TRASH", type, before.id, { trashedAt: null }, {
        trashedAt: after.trashedAt?.toISOString(),
        purgeAfter: after.purgeAfter?.toISOString(),
      });
    }
    return { count: uniqueIds.length, ids };
  });
}

async function assertRestorableParent(tx: Prisma.TransactionClient, type: TrashType, id: string) {
  if (type === "organ-system" || type === "media-asset") return;
  if (type === "feedback") {
    const attachments = await tx.$queryRaw<Array<{ trashedAt: Date | null }>>(Prisma.sql`
      SELECT media."trashedAt"
      FROM "Feedback" feedback
      JOIN "MediaAsset" media ON media."id" = feedback."attachmentMediaId"
      WHERE feedback."id" = ${id}::uuid
      FOR SHARE OF media
    `);
    if (attachments[0]?.trashedAt) {
      throw new TrashError("PARENT_UNAVAILABLE", "The feedback attachment is unavailable or in trash.", 409);
    }
    return;
  }
  const rows = type === "topic"
    ? await tx.$queryRaw<Array<{ topicTrashedAt: Date | null; systemTrashedAt: Date | null }>>(Prisma.sql`
        SELECT NULL::timestamptz AS "topicTrashedAt", system."trashedAt" AS "systemTrashedAt"
        FROM "Topic" child
        JOIN "OrganSystem" system ON system."id" = child."organSystemId"
        WHERE child."id" = ${id}::uuid FOR SHARE OF system`)
    : await tx.$queryRaw<Array<{ topicTrashedAt: Date | null; systemTrashedAt: Date | null }>>(Prisma.sql`
        SELECT topic."trashedAt" AS "topicTrashedAt", system."trashedAt" AS "systemTrashedAt"
        FROM ${table(type)} child
        JOIN "Topic" topic ON topic."id" = child."topicId"
        JOIN "OrganSystem" system ON system."id" = topic."organSystemId"
        WHERE child."id" = ${id}::uuid FOR SHARE OF topic, system`);
  if (!rows[0] || rows[0].topicTrashedAt || rows[0].systemTrashedAt) {
    throw new TrashError("PARENT_UNAVAILABLE", "The parent resource is unavailable or in trash.", 409);
  }
}

export async function restoreFromTrash(type: TrashType, id: string, context: MutationContext) {
  trashResourceIdSchema.parse(id);
  return prisma.$transaction(async (tx) => {
    const before = await lockRow(tx, type, id);
    if (!before?.trashedAt || !before.purgeAfter) throw new TrashError("NOT_FOUND", "Trashed resource was not found.", 404);
    await assertRestorableParent(tx, type, id);
    const now = await databaseNow(tx);
    if (now.getTime() >= before.purgeAfter.getTime()) throw new TrashError("RESTORE_EXPIRED", "The trash retention deadline has expired.", 409);

    const lifecycle = type === "media-asset"
      ? Prisma.sql`, "archivedAt" = NULL`
      : type === "feedback" ? Prisma.empty : Prisma.sql`, "status" = 'DRAFT'::"PublishStatus"`;
    await tx.$executeRaw(Prisma.sql`
      UPDATE ${table(type)} SET "trashedAt" = NULL, "purgeAfter" = NULL, "nextPurgeAttemptAt" = NULL ${lifecycle}
      WHERE "id" = ${id}::uuid
    `);
    await audit(tx, context, "RESTORE", type, id, { trashedAt: before.trashedAt.toISOString(), purgeAfter: before.purgeAfter.toISOString() }, { trashedAt: null });
    return type === "media-asset" || type === "feedback"
      ? { id, type, restored: true }
      : { id, type, restored: true, status: "DRAFT" as const };
  });
}

type ListRow = TrashItemRecord & { total: bigint; now: Date };

export async function listTrash(input: TrashListInput) {
  const typeFilter = input.type ? Prisma.sql`AND trash."type" = ${input.type}` : Prisma.empty;
  const queryFilter = input.q ? Prisma.sql`AND trash."label" ILIKE ${`%${input.q}%`}` : Prisma.empty;
  const expiryFilter = input.expiry === "restorable" ? Prisma.sql`AND trash."purgeAfter" > clock."now"`
    : input.expiry === "expired" ? Prisma.sql`AND trash."purgeAfter" <= clock."now"` : Prisma.empty;
  const eligibilityFilter = input.eligibility === "pending" ? Prisma.sql`AND trash."purgeAfter" > clock."now"`
    : input.eligibility === "eligible" ? Prisma.sql`AND trash."purgeAfter" <= clock."now" AND trash."blockerCount" = 0`
    : input.eligibility === "blocked" ? Prisma.sql`AND trash."purgeAfter" <= clock."now" AND trash."blockerCount" > 0` : Prisma.empty;
  const [sortField, sortDirection] = input.sort.split("-") as ["trashedAt" | "purgeAfter" | "label" | "type", "asc" | "desc"];
  const order = Prisma.raw(`"${sortField}" ${sortDirection.toUpperCase()}, "type" ASC, "id" ASC`);
  const offset = (input.page - 1) * input.pageSize;

  const rows = await prisma.$queryRaw<ListRow[]>(Prisma.sql`
    WITH clock AS (SELECT clock_timestamp() AS "now"), trash AS (
      SELECT s."id", 'organ-system'::text AS "type", s."name" AS "label", s."trashedAt", s."purgeAfter", s."nextPurgeAttemptAt",
        ((SELECT count(*) FROM "Topic" x WHERE x."organSystemId" = s."id") + (SELECT count(*) FROM "AssessmentAttempt" x WHERE x."organSystemId" = s."id"))::int AS "blockerCount",
        'Referenced by topics or assessment attempts'::text AS "blockerReason" FROM "OrganSystem" s WHERE s."trashedAt" IS NOT NULL
      UNION ALL SELECT t."id", 'topic', t."title", t."trashedAt", t."purgeAfter", t."nextPurgeAttemptAt",
        ((SELECT count(*) FROM "ContentLesson" x WHERE x."topicId" = t."id") + (SELECT count(*) FROM "Flashcard" x WHERE x."topicId" = t."id") + (SELECT count(*) FROM "Question" x WHERE x."topicId" = t."id") + (SELECT count(*) FROM "AssessmentAttemptTopic" x WHERE x."topicId" = t."id") + (SELECT count(*) FROM "TopicProgress" x WHERE x."topicId" = t."id"))::int,
        'Referenced by child content, attempts, or progress' FROM "Topic" t WHERE t."trashedAt" IS NOT NULL
      UNION ALL SELECT l."id", 'content-lesson', l."title", l."trashedAt", l."purgeAfter", l."nextPurgeAttemptAt",
        (SELECT count(*)::int FROM "ContentLessonProgress" x WHERE x."contentLessonId" = l."id"), 'Referenced by learner progress' FROM "ContentLesson" l WHERE l."trashedAt" IS NOT NULL
      UNION ALL SELECT f."id", 'flashcard', left(f."frontText", 160), f."trashedAt", f."purgeAfter", f."nextPurgeAttemptAt",
        ((SELECT count(*) FROM "FlashcardProgress" x WHERE x."flashcardId" = f."id") + (SELECT count(*) FROM "FlashcardViewEvent" x WHERE x."flashcardId" = f."id"))::int, 'Referenced by learner progress or events' FROM "Flashcard" f WHERE f."trashedAt" IS NOT NULL
      UNION ALL SELECT q."id", 'question', left(q."questionText", 160), q."trashedAt", q."purgeAfter", q."nextPurgeAttemptAt",
        (SELECT count(*)::int FROM "AttemptQuestion" x WHERE x."sourceQuestionId" = q."id"), 'Referenced by assessment attempts' FROM "Question" q WHERE q."trashedAt" IS NOT NULL
      UNION ALL SELECT f."id", 'feedback', left(f."subject", 160), f."trashedAt", f."purgeAfter", f."nextPurgeAttemptAt",
        0::int, NULL::text FROM "Feedback" f WHERE f."trashedAt" IS NOT NULL
      UNION ALL SELECT m."id", 'media-asset', m."originalFilename", m."trashedAt", m."purgeAfter", m."nextPurgeAttemptAt",
        ((SELECT count(*) FROM "Profile" x WHERE x."avatarMediaId" = m."id") + (SELECT count(*) FROM "OrganSystem" x WHERE x."coverMediaId" = m."id" OR x."iconMediaId" = m."id") + (SELECT count(*) FROM "Topic" x WHERE x."coverMediaId" = m."id") + (SELECT count(*) FROM "Flashcard" x WHERE x."frontMediaId" = m."id" OR x."backMediaId" = m."id") + (SELECT count(*) FROM "Question" x WHERE x."mediaId" = m."id") + (SELECT count(*) FROM "QuestionOption" x WHERE x."mediaId" = m."id") + (SELECT count(*) FROM "Feedback" x WHERE x."attachmentMediaId" = m."id") + (SELECT count(*) FROM "ContentLesson" x WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(x."contentBlocks") = 'array' THEN x."contentBlocks" WHEN jsonb_typeof(x."contentBlocks") = 'object' AND x."contentBlocks"->>'version' = '2' AND jsonb_typeof(x."contentBlocks"->'fallbackBlocks') = 'array' THEN x."contentBlocks"->'fallbackBlocks' ELSE '[]'::jsonb END) b WHERE b->>'mediaId' = m."id"::text)) + (SELECT count(*) FROM "AttemptQuestion" x WHERE x."mediaIdSnapshot" = m."id" OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(x."optionsSnapshot") = 'array' THEN x."optionsSnapshot" ELSE '[]'::jsonb END) o WHERE o->>'mediaId' = m."id"::text)))::int,
        'Referenced by content, profiles, feedback, or attempt snapshots' FROM "MediaAsset" m WHERE m."trashedAt" IS NOT NULL
    ), filtered AS (
      SELECT trash.*, clock."now" FROM trash CROSS JOIN clock WHERE true ${typeFilter} ${queryFilter} ${expiryFilter} ${eligibilityFilter}
    )
    SELECT filtered.*, count(*) OVER() AS "total" FROM filtered
    ORDER BY ${order} LIMIT ${input.pageSize} OFFSET ${offset}
  `);
  const total = Number(rows[0]?.total ?? 0);
  return {
    items: rows.map((row) => trashItemDto(row, row.now)),
    pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) },
  };
}

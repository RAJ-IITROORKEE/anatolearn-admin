import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TrashType } from "./domain";

const PURGE_ORDER: TrashType[] = ["content-lesson", "flashcard", "question", "topic", "organ-system", "media-asset"];
const tableByType = {
  "organ-system": "OrganSystem",
  topic: "Topic",
  "content-lesson": "ContentLesson",
  flashcard: "Flashcard",
  question: "Question",
  "media-asset": "MediaAsset",
} as const;

type DueRow = { id: string; bucket?: string; path?: string };
type Blockers = { count: number; reason: string };

function table(type: TrashType) {
  return Prisma.raw(`"${tableByType[type]}"`);
}

async function blockers(tx: Prisma.TransactionClient, type: TrashType, id: string): Promise<Blockers> {
  const queries: Record<TrashType, Prisma.Sql> = {
    "organ-system": Prisma.sql`SELECT ((SELECT count(*) FROM "Topic" WHERE "organSystemId" = ${id}::uuid) + (SELECT count(*) FROM "AssessmentAttempt" WHERE "organSystemId" = ${id}::uuid))::int AS count`,
    topic: Prisma.sql`SELECT ((SELECT count(*) FROM "ContentLesson" WHERE "topicId" = ${id}::uuid) + (SELECT count(*) FROM "Flashcard" WHERE "topicId" = ${id}::uuid) + (SELECT count(*) FROM "Question" WHERE "topicId" = ${id}::uuid) + (SELECT count(*) FROM "AssessmentAttemptTopic" WHERE "topicId" = ${id}::uuid) + (SELECT count(*) FROM "TopicProgress" WHERE "topicId" = ${id}::uuid))::int AS count`,
    "content-lesson": Prisma.sql`SELECT count(*)::int AS count FROM "ContentLessonProgress" WHERE "contentLessonId" = ${id}::uuid`,
    flashcard: Prisma.sql`SELECT ((SELECT count(*) FROM "FlashcardProgress" WHERE "flashcardId" = ${id}::uuid) + (SELECT count(*) FROM "FlashcardViewEvent" WHERE "flashcardId" = ${id}::uuid))::int AS count`,
    question: Prisma.sql`SELECT count(*)::int AS count FROM "AttemptQuestion" WHERE "sourceQuestionId" = ${id}::uuid`,
    "media-asset": Prisma.sql`SELECT (
      (SELECT count(*) FROM "Profile" WHERE "avatarMediaId" = ${id}::uuid) +
      (SELECT count(*) FROM "OrganSystem" WHERE "coverMediaId" = ${id}::uuid OR "iconMediaId" = ${id}::uuid) +
      (SELECT count(*) FROM "Topic" WHERE "coverMediaId" = ${id}::uuid) +
      (SELECT count(*) FROM "Flashcard" WHERE "frontMediaId" = ${id}::uuid OR "backMediaId" = ${id}::uuid) +
      (SELECT count(*) FROM "Question" WHERE "mediaId" = ${id}::uuid) +
      (SELECT count(*) FROM "QuestionOption" WHERE "mediaId" = ${id}::uuid) +
      (SELECT count(*) FROM "Feedback" WHERE "attachmentMediaId" = ${id}::uuid) +
      (SELECT count(*) FROM "ContentLesson" lesson WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(lesson."contentBlocks") = 'array' THEN lesson."contentBlocks" ELSE '[]'::jsonb END) block WHERE block->>'mediaId' = ${id})) +
      (SELECT count(*) FROM "AttemptQuestion" question WHERE question."mediaIdSnapshot" = ${id}::uuid OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(question."optionsSnapshot") = 'array' THEN question."optionsSnapshot" ELSE '[]'::jsonb END) option WHERE option->>'mediaId' = ${id}))
    )::int AS count`,
  };
  const [row] = await tx.$queryRaw<Array<{ count: number }>>(queries[type]);
  const reasons: Record<TrashType, string> = {
    "organ-system": "Referenced by topics or assessment attempts",
    topic: "Referenced by child content, attempts, or progress",
    "content-lesson": "Referenced by learner progress",
    flashcard: "Referenced by learner progress or events",
    question: "Referenced by assessment attempts",
    "media-asset": "Referenced by content, profiles, feedback, or attempt snapshots",
  };
  return { count: row?.count ?? 0, reason: reasons[type] };
}

async function claimAndPurge(type: TrashType) {
  return prisma.$transaction(async (tx) => {
    const selected = type === "media-asset" ? Prisma.sql`, "bucket", "path"` : Prisma.empty;
    const rows = await tx.$queryRaw<DueRow[]>(Prisma.sql`
      SELECT "id" ${selected} FROM ${table(type)}
      WHERE "trashedAt" IS NOT NULL
        AND "purgeAfter" <= clock_timestamp()
        AND "nextPurgeAttemptAt" <= clock_timestamp()
      ORDER BY "nextPurgeAttemptAt", "id"
      LIMIT 1 FOR UPDATE SKIP LOCKED
    `);
    const row = rows[0];
    if (!row) return { claimed: 0, purged: 0, blocked: 0 };
    const blocked = await blockers(tx, type, row.id);
    if (blocked.count > 0) {
      await tx.$executeRaw(Prisma.sql`UPDATE ${table(type)} SET "nextPurgeAttemptAt" = clock_timestamp() + interval '1 day' WHERE "id" = ${row.id}::uuid`);
      return { claimed: 1, purged: 0, blocked: 1 };
    }

    if (type === "media-asset") {
      await tx.mediaPurgeJob.create({ data: { mediaAssetId: row.id, bucket: row.bucket!, path: row.path! } });
    }
    await tx.auditLog.create({ data: {
      action: "PURGE",
      entityType: tableByType[type],
      entityId: row.id,
      beforeSnapshot: { trashed: true },
      afterSnapshot: { purged: true },
    } });
    await tx.$executeRaw(Prisma.sql`DELETE FROM ${table(type)} WHERE "id" = ${row.id}::uuid`);
    return { claimed: 1, purged: 1, blocked: 0 };
  });
}

export async function purgeDueTrash({ limit }: { limit: number }) {
  let claimed = 0;
  let purged = 0;
  let blocked = 0;
  for (const type of PURGE_ORDER) {
    while (claimed < limit) {
      const result = await claimAndPurge(type);
      if (!result.claimed) break;
      claimed += result.claimed;
      purged += result.purged;
      blocked += result.blocked;
    }
    if (claimed >= limit) break;
  }
  return { claimed, purged, blocked };
}

type StorageRemoval = (bucket: string, path: string) => Promise<{ error: unknown }>;

function missingObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: number; statusCode?: number | string; message?: string };
  return Number(value.status ?? value.statusCode) === 404 || /not found|does not exist/i.test(value.message ?? "");
}

async function defaultRemove(bucket: string, path: string) {
  const result = await createSupabaseAdminClient().storage.from(bucket).remove([path]);
  return { error: result.error };
}

export async function processMediaPurgeJobs({ limit, remove = defaultRemove }: { limit: number; remove?: StorageRemoval }) {
  let claimed = 0;
  let removed = 0;
  let retried = 0;
  for (let index = 0; index < limit; index += 1) {
    const token = crypto.randomUUID();
    const job = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; bucket: string; path: string }>>(Prisma.sql`
        SELECT "id", "bucket", "path" FROM "MediaPurgeJob"
        WHERE "nextAttemptAt" <= clock_timestamp()
          AND ("leaseUntil" IS NULL OR "leaseUntil" <= clock_timestamp())
        ORDER BY "nextAttemptAt", "id" LIMIT 1 FOR UPDATE SKIP LOCKED
      `);
      if (!rows[0]) return null;
      const leased = await tx.$executeRaw(Prisma.sql`
        UPDATE "MediaPurgeJob"
        SET "leaseToken" = ${token}::uuid,
            "leaseUntil" = clock_timestamp() + interval '5 minutes'
        WHERE "id" = ${rows[0].id}::uuid
          AND ("leaseUntil" IS NULL OR "leaseUntil" <= clock_timestamp())
      `);
      if (leased !== 1) return null;
      return rows[0];
    });
    if (!job) break;
    claimed += 1;
    try {
      const result = await remove(job.bucket, job.path);
      if (result.error && !missingObject(result.error)) throw result.error;
      const deleted = await prisma.mediaPurgeJob.deleteMany({ where: { id: job.id, leaseToken: token } });
      if (deleted.count) removed += 1;
    } catch {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "MediaPurgeJob"
        SET "attemptCount" = "attemptCount" + 1,
            "nextAttemptAt" = clock_timestamp() + interval '1 day',
            "leaseToken" = NULL,
            "leaseUntil" = NULL
        WHERE "id" = ${job.id}::uuid AND "leaseToken" = ${token}::uuid
      `);
      retried += 1;
    }
  }
  return { claimed, removed, retried };
}

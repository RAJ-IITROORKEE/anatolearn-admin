import { Prisma } from "@prisma/client";

export async function getMediaDependencyState(tx: Prisma.TransactionClient, id: string) {
  const assets = await tx.$queryRaw<Array<{ id: string; uploadedById: string; trashedAt: Date | null }>>(Prisma.sql`
    SELECT "id", "uploadedById", "trashedAt" FROM "MediaAsset"
    WHERE "id" = ${id}::uuid FOR UPDATE
  `);
  const asset = assets[0];
  if (!asset) return null;

  const rows = await tx.$queryRaw<Array<{ referenced: boolean }>>(Prisma.sql`
    SELECT (
      EXISTS (SELECT 1 FROM "Profile" WHERE "avatarMediaId" = ${id}::uuid)
      OR EXISTS (SELECT 1 FROM "OrganSystem" WHERE "coverMediaId" = ${id}::uuid OR "iconMediaId" = ${id}::uuid)
      OR EXISTS (SELECT 1 FROM "Topic" WHERE "coverMediaId" = ${id}::uuid)
      OR EXISTS (SELECT 1 FROM "Flashcard" WHERE "frontMediaId" = ${id}::uuid OR "backMediaId" = ${id}::uuid)
      OR EXISTS (SELECT 1 FROM "Question" WHERE "mediaId" = ${id}::uuid)
      OR EXISTS (SELECT 1 FROM "QuestionOption" WHERE "mediaId" = ${id}::uuid)
      OR EXISTS (SELECT 1 FROM "Feedback" WHERE "attachmentMediaId" = ${id}::uuid)
      OR EXISTS (
        SELECT 1 FROM "ContentLesson" lesson WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(lesson."contentBlocks") = 'array' THEN lesson."contentBlocks"
              WHEN jsonb_typeof(lesson."contentBlocks") = 'object' AND lesson."contentBlocks"->>'version' = '2'
                AND jsonb_typeof(lesson."contentBlocks"->'fallbackBlocks') = 'array' THEN lesson."contentBlocks"->'fallbackBlocks'
              ELSE '[]'::jsonb
            END
          ) block WHERE block->>'mediaId' = ${id}
        )
      )
      OR EXISTS (
        SELECT 1 FROM "AttemptQuestion" question
        WHERE question."mediaIdSnapshot" = ${id}::uuid OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(question."optionsSnapshot") = 'array' THEN question."optionsSnapshot" ELSE '[]'::jsonb END
          ) option WHERE option->>'mediaId' = ${id}
        )
      )
    ) AS "referenced"
  `);
  return { ...asset, referenced: rows[0]?.referenced === true };
}

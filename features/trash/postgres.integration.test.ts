import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = describe.skipIf(!testDatabaseUrl);

async function createContentFixture(tx: Prisma.TransactionClient) {
  const suffix = crypto.randomUUID();
  const system = await tx.organSystem.create({ data: {
    name: `Trash system ${suffix}`,
    slug: `trash-system-${suffix}`,
    shortDescription: "Rollback-only trash integration fixture",
    displayOrder: 0,
  } });
  const topic = await tx.topic.create({ data: {
    organSystemId: system.id,
    title: `Trash topic ${suffix}`,
    slug: `trash-topic-${suffix}`,
    displayOrder: 0,
  } });
  return { system, topic };
}

integrationDescribe("safe trash PostgreSQL boundaries", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = new PrismaClient({ datasourceUrl: testDatabaseUrl! });
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("rejects direct hard delete before trash retention", async () => {
    await expect(client.$transaction(async (tx) => {
      const { topic } = await createContentFixture(tx);
      await tx.topic.delete({ where: { id: topic.id } });
    })).rejects.toThrow(/hard delete is forbidden/i);
  });

  it("guards feedback hard deletion without rewriting its workflow status", async () => {
    await expect(client.$transaction(async (tx) => {
      const suffix = crypto.randomUUID();
      const user = await tx.profile.create({ data: {
        id: crypto.randomUUID(),
        fullName: "Trash feedback learner",
        email: `trash-${suffix}@example.com`,
        emailNormalized: `trash-${suffix}@example.com`,
      } });
      const feedback = await tx.feedback.create({ data: {
        userId: user.id,
        type: "GENERAL",
        subject: "Rollback-only feedback fixture",
        message: "No production data is retained.",
        status: "REVIEWED",
      } });
      await tx.$executeRaw(Prisma.sql`
        WITH clock AS (SELECT clock_timestamp() AS now)
        UPDATE "Feedback" SET "trashedAt" = clock.now,
          "purgeAfter" = clock.now + interval '30 days',
          "nextPurgeAttemptAt" = clock.now + interval '30 days'
        FROM clock WHERE "id" = ${feedback.id}::uuid
      `);
      const stored = await tx.feedback.findUniqueOrThrow({ where: { id: feedback.id }, select: { status: true } });
      expect(stored.status).toBe("REVIEWED");
      await tx.feedback.delete({ where: { id: feedback.id } });
    })).rejects.toThrow(/hard delete is forbidden/i);
  });

  it("forbids a restore that races across the exact database-clock deadline", async () => {
    await expect(client.$transaction(async (tx) => {
      const { topic } = await createContentFixture(tx);
      await tx.$executeRaw(Prisma.sql`
        WITH clock AS (SELECT clock_timestamp() AS now)
        UPDATE "Topic" SET "status" = 'ARCHIVED',
          "trashedAt" = clock.now + interval '50 milliseconds' - interval '30 days',
          "purgeAfter" = clock.now + interval '50 milliseconds',
          "nextPurgeAttemptAt" = clock.now + interval '50 milliseconds'
        FROM clock WHERE "id" = ${topic.id}::uuid
      `);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await tx.topic.update({ where: { id: topic.id }, data: {
        status: "DRAFT", trashedAt: null, purgeAfter: null, nextPurgeAttemptAt: null,
      } });
    })).rejects.toThrow(/PZ001|retention deadline has expired/i);
  });

  it("denies direct client-role access to MediaPurgeJob", async () => {
    await expect(client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE authenticated");
      await tx.$queryRaw(Prisma.sql`SELECT count(*) FROM "MediaPurgeJob"`);
    })).rejects.toThrow(/permission denied|row-level security/i);
  });

  it("keeps an expired trashed topic when a representative FK blocker exists", async () => {
    await expect(client.$transaction(async (tx) => {
      const { topic } = await createContentFixture(tx);
      await tx.contentLesson.create({ data: {
        topicId: topic.id,
        title: "Blocking lesson",
        slug: `blocking-${crypto.randomUUID()}`,
        contentBlocks: [],
        estimatedReadingMinutes: 1,
        displayOrder: 0,
      } });
      await tx.$executeRaw(Prisma.sql`
        WITH clock AS (SELECT clock_timestamp() AS now)
        UPDATE "Topic" SET "status" = 'ARCHIVED', "trashedAt" = clock.now - interval '31 days',
          "purgeAfter" = clock.now - interval '1 day', "nextPurgeAttemptAt" = clock.now - interval '1 day'
        FROM clock WHERE "id" = ${topic.id}::uuid
      `);
      await tx.topic.delete({ where: { id: topic.id } });
    })).rejects.toThrow(/foreign key constraint|Foreign key constraint/i);
  });
});

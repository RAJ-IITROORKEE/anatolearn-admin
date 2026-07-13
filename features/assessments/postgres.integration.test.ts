import { Prisma, PrismaClient, type Prisma as PrismaTypes } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { attemptInclude, databaseNow, finalizeLockedAttempt } from "./finalization-service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const hasDedicatedDatabase = Boolean(testDatabaseUrl && testDatabaseUrl !== process.env.DATABASE_URL);
const integrationDescribe = describe.skipIf(!hasDedicatedDatabase);
const rollbackMarker = "ROLLBACK_ASSESSMENT_INTEGRATION_TEST";

type Transaction = PrismaTypes.TransactionClient;

async function createFixture(tx: Transaction) {
  const suffix = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const systemId = crypto.randomUUID();
  const topicId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();

  await tx.profile.create({ data: {
    id: userId, fullName: "Integration learner", email: `${suffix}@example.test`, emailNormalized: `${suffix}@example.test`,
  } });
  await tx.organSystem.create({ data: {
    id: systemId, name: `Integration system ${suffix}`, slug: `integration-system-${suffix}`,
    shortDescription: "Rollback-only integration fixture", displayOrder: 0, status: "PUBLISHED", isActive: true,
  } });
  await tx.topic.create({ data: {
    id: topicId, organSystemId: systemId, title: `Integration topic ${suffix}`, slug: `integration-topic-${suffix}`,
    displayOrder: 0, status: "PUBLISHED",
  } });
  const questions = await Promise.all(Array.from({ length: 5 }, async (_, index) => {
    const sourceQuestionId = crypto.randomUUID();
    const correctOptionKey = crypto.randomUUID();
    const wrongOptionKey = crypto.randomUUID();
    await tx.question.create({ data: {
      id: sourceQuestionId, topicId, assessmentType: "QUIZ", questionText: `Current source prompt ${index + 1}`,
      explanation: `Current source explanation ${index + 1}`, difficulty: "EASY", status: "PUBLISHED", isActive: true,
      options: { create: [
        { key: correctOptionKey, label: "A", displayOrder: 1, optionText: "Correct source option", isCorrect: true },
        { key: wrongOptionKey, label: "B", displayOrder: 2, optionText: "Wrong source option", isCorrect: false },
      ] },
    } });
    return {
      attemptQuestionId: crypto.randomUUID(),
      sourceQuestionId,
      correctOptionKey,
      wrongOptionKey,
      displayOrder: index + 1,
    };
  }));
  await tx.assessmentAttempt.create({ data: {
    id: attemptId, userId, assessmentType: "QUIZ", organSystemId: systemId,
    requestedQuestionCount: 5, totalQuestionCount: 5, unansweredCount: 5,
    topics: { create: [{ topicId }] },
    questions: { create: questions.map((question) => ({
      id: question.attemptQuestionId, sourceQuestionId: question.sourceQuestionId,
      sourceQuestionSnapshotId: question.sourceQuestionId, displayOrder: question.displayOrder,
      questionTextSnapshot: `Immutable snapshot prompt ${question.displayOrder}`,
      explanationSnapshot: `Immutable snapshot explanation ${question.displayOrder}`,
      optionsSnapshot: [
        { key: question.correctOptionKey, label: "A", displayOrder: 1, optionText: "Snapshot correct option", imageUrl: null, mediaId: null },
        { key: question.wrongOptionKey, label: "B", displayOrder: 2, optionText: "Snapshot wrong option", imageUrl: null, mediaId: null },
      ] as Prisma.InputJsonValue,
      correctOptionKey: question.correctOptionKey, topicIdSnapshot: topicId, topicTitleSnapshot: "Immutable topic",
      difficultySnapshot: "EASY", organSystemIdSnapshot: systemId, organSystemNameSnapshot: "Immutable system",
    })) },
  } });
  return { attemptId, userId, questions };
}

async function finalizeFixture(client: PrismaClient, attemptId: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await client.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT "id" FROM "AssessmentAttempt" WHERE "id" = ${attemptId}::uuid FOR UPDATE
        `);
        const locked = await tx.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: attemptInclude });
        return finalizeLockedAttempt(tx, locked, await databaseNow(tx));
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (
        error.code === "P2034"
        || (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code)))
      );
      if (retryable && attempt < 3) continue;
      throw error;
    }
  }
  throw new Error("Concurrent finalization retry limit was exhausted.");
}

integrationDescribe("assessment PostgreSQL guards with dedicated TEST_DATABASE_URL", () => {
  let client: PrismaClient;

  beforeAll(() => {
    client = new PrismaClient({ datasourceUrl: testDatabaseUrl! });
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("rejects snapshot mutation and rolls back the whole fixture transaction", async () => {
    let attemptId = "";
    await expect(client.$transaction(async (tx) => {
      const fixture = await createFixture(tx);
      attemptId = fixture.attemptId;
      await tx.attemptQuestion.update({
        where: { id: fixture.questions[0].attemptQuestionId },
        data: { questionTextSnapshot: "Mutated snapshot" },
      });
    })).rejects.toThrow(/Attempt question snapshots are immutable/);
    await expect(client.assessmentAttempt.count({ where: { id: attemptId } })).resolves.toBe(0);
  });

  it("rejects terminal result mutation and rolls back the whole fixture transaction", async () => {
    let attemptId = "";
    await expect(client.$transaction(async (tx) => {
      const fixture = await createFixture(tx);
      attemptId = fixture.attemptId;
      await tx.assessmentAttempt.update({
        where: { id: fixture.attemptId },
        data: { status: "COMPLETED", completedAt: new Date(), durationSeconds: 1, correctCount: 1, unansweredCount: 4, scorePercentage: 20 },
      });
      await tx.assessmentAttempt.update({ where: { id: fixture.attemptId }, data: { scorePercentage: 0 } });
    })).rejects.toThrow(/Terminal assessment results are immutable/);
    await expect(client.assessmentAttempt.count({ where: { id: attemptId } })).resolves.toBe(0);
  });

  it("keeps attempt snapshots stable after source edits and then rolls back", async () => {
    let attemptId = "";
    await expect(client.$transaction(async (tx) => {
      const fixture = await createFixture(tx);
      attemptId = fixture.attemptId;
      await tx.question.update({
        where: { id: fixture.questions[0].sourceQuestionId },
        data: { questionText: "Edited source prompt", explanation: "Edited source explanation" },
      });
      const snapshot = await tx.attemptQuestion.findUniqueOrThrow({ where: { id: fixture.questions[0].attemptQuestionId } });
      expect(snapshot.questionTextSnapshot).toBe("Immutable snapshot prompt 1");
      expect(snapshot.explanationSnapshot).toBe("Immutable snapshot explanation 1");
      throw new Error(rollbackMarker);
    })).rejects.toThrow(rollbackMarker);
    await expect(client.assessmentAttempt.count({ where: { id: attemptId } })).resolves.toBe(0);
  });

  it("serializes concurrent finalization into one immutable terminal result", async () => {
    const fixture = await client.$transaction(createFixture);
    await client.$transaction([
      client.attemptQuestion.update({
        where: { id: fixture.questions[0].attemptQuestionId },
        data: {
          answeredOptionKey: fixture.questions[0].correctOptionKey,
          answeredAt: new Date(),
          isCorrect: true,
        },
      }),
      client.attemptQuestion.update({
        where: { id: fixture.questions[1].attemptQuestionId },
        data: {
          answeredOptionKey: fixture.questions[1].wrongOptionKey,
          answeredAt: new Date(),
          isCorrect: false,
        },
      }),
    ]);

    const secondClient = new PrismaClient({ datasourceUrl: testDatabaseUrl! });
    try {
      const [first, second] = await Promise.all([
        finalizeFixture(client, fixture.attemptId),
        finalizeFixture(secondClient, fixture.attemptId),
      ]);
      const stored = await client.assessmentAttempt.findUniqueOrThrow({ where: { id: fixture.attemptId } });

      expect(first.status).toBe("COMPLETED");
      expect(second.status).toBe("COMPLETED");
      expect(stored).toMatchObject({
        status: "COMPLETED",
        correctCount: 1,
        incorrectCount: 1,
        unansweredCount: 3,
      });
      expect(stored.scorePercentage.toString()).toBe("20");
      expect(first.completedAt?.toISOString()).toBe(second.completedAt?.toISOString());
      await expect(client.assessmentAttempt.update({
        where: { id: fixture.attemptId },
        data: { scorePercentage: 0 },
      })).rejects.toThrow(/Terminal assessment results are immutable/);
    } finally {
      await secondClient.$disconnect();
    }
  });
});

import { Prisma, PrismaClient, type Prisma as PrismaTypes } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
  const sourceQuestionId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();
  const attemptQuestionId = crypto.randomUUID();
  const correctOptionKey = crypto.randomUUID();
  const wrongOptionKey = crypto.randomUUID();

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
  await tx.question.create({ data: {
    id: sourceQuestionId, topicId, assessmentType: "QUIZ", questionText: "Current source prompt",
    explanation: "Current source explanation", difficulty: "EASY", status: "PUBLISHED", isActive: true,
    options: { create: [
      { key: correctOptionKey, label: "A", displayOrder: 1, optionText: "Correct source option", isCorrect: true },
      { key: wrongOptionKey, label: "B", displayOrder: 2, optionText: "Wrong source option", isCorrect: false },
    ] },
  } });
  await tx.assessmentAttempt.create({ data: {
    id: attemptId, userId, assessmentType: "QUIZ", organSystemId: systemId,
    requestedQuestionCount: 1, totalQuestionCount: 1, unansweredCount: 1,
    topics: { create: [{ topicId }] },
    questions: { create: [{
      id: attemptQuestionId, sourceQuestionId, sourceQuestionSnapshotId: sourceQuestionId, displayOrder: 1,
      questionTextSnapshot: "Immutable snapshot prompt", explanationSnapshot: "Immutable snapshot explanation",
      optionsSnapshot: [
        { key: correctOptionKey, label: "A", displayOrder: 1, optionText: "Snapshot correct option", imageUrl: null, mediaId: null },
        { key: wrongOptionKey, label: "B", displayOrder: 2, optionText: "Snapshot wrong option", imageUrl: null, mediaId: null },
      ] as Prisma.InputJsonValue,
      correctOptionKey, topicIdSnapshot: topicId, topicTitleSnapshot: "Immutable topic",
      difficultySnapshot: "EASY", organSystemIdSnapshot: systemId, organSystemNameSnapshot: "Immutable system",
    }] },
  } });
  return { attemptId, attemptQuestionId, sourceQuestionId };
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
        where: { id: fixture.attemptQuestionId },
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
        data: { status: "COMPLETED", completedAt: new Date(), durationSeconds: 1, correctCount: 1, unansweredCount: 0, scorePercentage: 100 },
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
        where: { id: fixture.sourceQuestionId },
        data: { questionText: "Edited source prompt", explanation: "Edited source explanation" },
      });
      const snapshot = await tx.attemptQuestion.findUniqueOrThrow({ where: { id: fixture.attemptQuestionId } });
      expect(snapshot.questionTextSnapshot).toBe("Immutable snapshot prompt");
      expect(snapshot.explanationSnapshot).toBe("Immutable snapshot explanation");
      throw new Error(rollbackMarker);
    })).rejects.toThrow(rollbackMarker);
    await expect(client.assessmentAttempt.count({ where: { id: attemptId } })).resolves.toBe(0);
  });

  it.skip("concurrent submission serialization requires isolated multi-connection orchestration outside this rollback-only harness", () => {});
});

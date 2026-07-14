import type { Prisma, PrismaClient } from "@prisma/client";

import { assertCanonicalSeed, type CanonicalSeedPlan } from "./seed-data";

type UpsertDelegate<T> = { upsert(args: T): PromiseLike<unknown> };

export type SeedStore = {
  organSystem: UpsertDelegate<Prisma.OrganSystemUpsertArgs>;
  topic: UpsertDelegate<Prisma.TopicUpsertArgs>;
  contentLesson: UpsertDelegate<Prisma.ContentLessonUpsertArgs>;
  flashcard: UpsertDelegate<Prisma.FlashcardUpsertArgs>;
  question: UpsertDelegate<Prisma.QuestionUpsertArgs>;
  questionOption: UpsertDelegate<Prisma.QuestionOptionUpsertArgs>;
};

export async function installCanonicalSeed(store: SeedStore, plan: CanonicalSeedPlan): Promise<void> {
  assertCanonicalSeed(plan);

  for (const system of plan.systems) {
    await store.organSystem.upsert({ where: { id: system.id }, update: {}, create: system });
  }
  for (const topic of plan.topics) {
    await store.topic.upsert({ where: { id: topic.id }, update: {}, create: topic });
  }
  await store.contentLesson.upsert({
    where: { id: plan.lesson.id },
    update: {},
    create: plan.lesson,
  });
  for (const flashcard of plan.flashcards) {
    await store.flashcard.upsert({ where: { id: flashcard.id }, update: {}, create: flashcard });
  }
  for (const questionWithOptions of plan.questions) {
    const { options, ...question } = questionWithOptions;
    await store.question.upsert({ where: { id: question.id }, update: {}, create: question });
    for (const option of options) {
      await store.questionOption.upsert({ where: { id: option.id }, update: {}, create: option });
    }
  }
}

export function asSeedStore(prisma: PrismaClient | Prisma.TransactionClient): SeedStore {
  return prisma as unknown as SeedStore;
}

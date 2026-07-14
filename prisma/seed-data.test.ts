import { AssessmentType, PublishStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { contentBlocksSchema } from "../features/content/schemas";
import { assertCanonicalSeed, createCanonicalSeedPlan } from "./seed-data";
import { installCanonicalSeed, type SeedStore } from "./seed-service";

describe("canonical seed data", () => {
  it("defines unique deterministic demo records with the required counts", () => {
    const plan = createCanonicalSeedPlan();
    const allIds = [
      ...plan.systems,
      ...plan.topics,
      plan.lesson,
      ...plan.flashcards,
      ...plan.questions,
      ...plan.questions.flatMap((question) => question.options),
    ].map((record) => record.id);

    expect(() => assertCanonicalSeed(plan)).not.toThrow();
    expect(plan.systems).toHaveLength(11);
    expect(plan.topics).toHaveLength(2);
    expect(plan.flashcards).toHaveLength(4);
    expect(plan.questions.filter(({ assessmentType }) => assessmentType === AssessmentType.QUIZ)).toHaveLength(10);
    expect(plan.questions.filter(({ assessmentType }) => assessmentType === AssessmentType.TEST)).toHaveLength(10);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(new Set(plan.systems.map(({ name }) => name)).size).toBe(11);
    expect(new Set(plan.systems.map(({ slug }) => slug)).size).toBe(11);
    const optionKeys = plan.questions.flatMap(({ options }) => options.map(({ key }) => key));
    expect(new Set(optionKeys).size).toBe(optionKeys.length);
  });

  it("keeps every demo resource in draft and explicitly marked for academic review", () => {
    const plan = createCanonicalSeedPlan();
    const reviewText = [
      ...plan.systems.map(({ longDescription }) => longDescription),
      ...plan.topics.map(({ summary }) => summary),
      plan.lesson.summary,
      ...plan.flashcards.map(({ notes }) => notes),
      ...plan.questions.map(({ explanation }) => explanation),
    ];

    expect([...plan.systems, ...plan.topics, plan.lesson, ...plan.flashcards, ...plan.questions]
      .every(({ status }) => status === PublishStatus.DRAFT)).toBe(true);
    expect(reviewText.every((value) => value.toLowerCase().includes("academic review"))).toBe(true);
  });

  it("uses the production lesson block schema and valid deterministic option aggregates", () => {
    const plan = createCanonicalSeedPlan();

    expect(contentBlocksSchema.safeParse(plan.lesson.contentBlocks).success).toBe(true);
    for (const question of plan.questions) {
      expect(question.options).toHaveLength(4);
      expect(question.options.filter(({ isCorrect }) => isCorrect)).toHaveLength(1);
      expect(question.options.map(({ label }) => label)).toEqual(["A", "B", "C", "D"]);
      expect(question.options.map(({ displayOrder }) => displayOrder)).toEqual([1, 2, 3, 4]);
      expect(new Set(question.options.map(({ key }) => key)).size).toBe(4);
    }
  });

  it("uses create-if-missing upserts so edited and published canonical records are preserved", async () => {
    const plan = createCanonicalSeedPlan();
    const calls: Array<{ model: string; args: unknown }> = [];
    const records = new Map<string, Record<string, unknown>>([
      [plan.systems[0].id, { ...plan.systems[0], name: "Edited circulatory module", status: PublishStatus.PUBLISHED }],
      [plan.questions[0].options[0].id, { ...plan.questions[0].options[0], optionText: "Academically reviewed answer" }],
      ["unknown-user-content", { title: "User-authored content" }],
    ]);
    const delegate = (model: string) => ({
      upsert: vi.fn(async (args: unknown) => {
        calls.push({ model, args: structuredClone(args) });
        const { where, update, create } = args as {
          where: { id: string };
          update: Record<string, unknown>;
          create: Record<string, unknown>;
        };
        const existing = records.get(where.id);
        if (existing) Object.assign(existing, update);
        else records.set(where.id, structuredClone(create));
        return {};
      }),
    });
    const store = {
      organSystem: delegate("organSystem"),
      topic: delegate("topic"),
      contentLesson: delegate("contentLesson"),
      flashcard: delegate("flashcard"),
      question: delegate("question"),
      questionOption: delegate("questionOption"),
    } as unknown as SeedStore;

    await installCanonicalSeed(store, plan);
    const firstRun = structuredClone(calls);
    calls.length = 0;
    await installCanonicalSeed(store, plan);

    expect(calls).toEqual(firstRun);
    expect(firstRun).toHaveLength(11 + 2 + 1 + 4 + 20 + 80);
    expect(firstRun.every(({ args }) => {
      const update = (args as { update: unknown }).update;
      return JSON.stringify(update) === "{}";
    })).toBe(true);
    expect(records.get(plan.systems[0].id)).toMatchObject({
      name: "Edited circulatory module",
      status: PublishStatus.PUBLISHED,
    });
    expect(records.get(plan.questions[0].options[0].id)).toMatchObject({ optionText: "Academically reviewed answer" });
    expect(records.get(plan.questions[0].options[1].id)).toEqual(plan.questions[0].options[1]);
    expect(records.get("unknown-user-content")).toEqual({ title: "User-authored content" });
    const knownIds = new Set([
      ...plan.systems,
      ...plan.topics,
      plan.lesson,
      ...plan.flashcards,
      ...plan.questions,
      ...plan.questions.flatMap(({ options }) => options),
    ].map(({ id }) => id));
    expect(firstRun.every(({ args }) => {
      const where = (args as { where: { id: string } }).where;
      return knownIds.has(where.id);
    })).toBe(true);
    expect(Object.keys(store)).toEqual([
      "organSystem",
      "topic",
      "contentLesson",
      "flashcard",
      "question",
      "questionOption",
    ]);
  });
});

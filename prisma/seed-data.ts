import { AssessmentType, Difficulty, PublishStatus } from "@prisma/client";

import { contentBlocksSchema } from "../features/content/schemas";

const ACADEMIC_REVIEW_NOTICE = "Demonstration content; requires academic review before educational use.";

function uuid(group: number, item: number) {
  return `${group.toString(16).padStart(8, "0")}-0000-4000-8000-${item.toString(16).padStart(12, "0")}`;
}

export function createCanonicalSeedPlan() {
  const systemNames = [
    "Circulatory",
    "Respiratory",
    "Urinary",
    "Endocrine",
    "Lymphatic",
    "Digestive",
    "Reproductive",
    "Muscular",
    "Integumentary",
    "Nervous",
    "Skeletal",
  ];
  const systems = systemNames.map((name, index) => ({
    id: uuid(1, index + 1),
    name,
    slug: name.toLowerCase(),
    shortDescription: `Sample ${name.toLowerCase()} system learning module.`,
    longDescription: ACADEMIC_REVIEW_NOTICE,
    coverImageUrl: null,
    coverMediaId: null,
    iconImageUrl: null,
    iconMediaId: null,
    displayOrder: index + 1,
    status: PublishStatus.DRAFT,
    isActive: true,
  }));
  const topics = [
    { id: uuid(2, 1), title: "Heart structure", slug: "heart-structure" },
    { id: uuid(2, 2), title: "Blood vessels", slug: "blood-vessels" },
  ].map((topic, index) => ({
    ...topic,
    organSystemId: systems[0].id,
    summary: ACADEMIC_REVIEW_NOTICE,
    coverImageUrl: null,
    coverMediaId: null,
    displayOrder: index + 1,
    status: PublishStatus.DRAFT,
  }));
  const lesson = {
    id: uuid(3, 1),
    topicId: topics[0].id,
    title: "Sample heart overview",
    slug: "sample-heart-overview",
    summary: ACADEMIC_REVIEW_NOTICE,
    contentBlocks: [
      { id: "sample-heading", type: "heading" as const, level: 2 as const, text: "Heart overview" },
      {
        id: "sample-paragraph",
        type: "paragraph" as const,
        text: "The heart is a muscular organ that supports circulation through the body.",
      },
    ],
    estimatedReadingMinutes: 2,
    displayOrder: 1,
    status: PublishStatus.DRAFT,
  };
  const flashcards = Array.from({ length: 4 }, (_, offset) => {
    const index = offset + 1;
    return {
      id: uuid(4, index),
      topicId: topics[offset % topics.length].id,
      frontText: `Sample circulatory prompt ${index}`,
      backText: `Sample answer ${index}.`,
      frontImageUrl: null,
      frontMediaId: null,
      backImageUrl: null,
      backMediaId: null,
      difficulty: Difficulty.EASY,
      notes: ACADEMIC_REVIEW_NOTICE,
      displayOrder: index,
      status: PublishStatus.DRAFT,
    };
  });
  const questions = [AssessmentType.QUIZ, AssessmentType.TEST].flatMap((assessmentType) => {
    const typeGroup = assessmentType === AssessmentType.QUIZ ? 5 : 6;
    return Array.from({ length: 10 }, (_, offset) => {
      const index = offset + 1;
      const id = uuid(typeGroup, index);
      return {
        id,
        topicId: topics[offset % topics.length].id,
        assessmentType,
        questionText: `Sample ${assessmentType.toLowerCase()} question ${index}?`,
        imageUrl: null,
        mediaId: null,
        explanation: ACADEMIC_REVIEW_NOTICE,
        difficulty: Difficulty.EASY,
        conceptTag: "sample",
        status: PublishStatus.DRAFT,
        isActive: true,
        options: Array.from({ length: 4 }, (_, optionOffset) => {
          const optionIndex = optionOffset + 1;
          return {
            id: uuid(typeGroup + 10, index * 10 + optionIndex),
            questionId: id,
            key: uuid(typeGroup + 20, index * 10 + optionIndex),
            label: String.fromCharCode(64 + optionIndex),
            displayOrder: optionIndex,
            optionText: `Sample option ${optionIndex}`,
            imageUrl: null,
            mediaId: null,
            isCorrect: optionIndex === 1,
          };
        }),
      };
    });
  });

  return { systems, topics, lesson, flashcards, questions };
}

export type CanonicalSeedPlan = ReturnType<typeof createCanonicalSeedPlan>;

export function assertCanonicalSeed(plan: CanonicalSeedPlan): void {
  if (plan.systems.length !== 11 || plan.topics.length !== 2 || plan.flashcards.length !== 4) {
    throw new Error("Canonical seed counts are invalid.");
  }
  if (!contentBlocksSchema.safeParse(plan.lesson.contentBlocks).success) {
    throw new Error("Canonical lesson blocks are invalid.");
  }
  const records = [
    ...plan.systems,
    ...plan.topics,
    plan.lesson,
    ...plan.flashcards,
    ...plan.questions,
    ...plan.questions.flatMap(({ options }) => options),
  ];
  if (new Set(records.map(({ id }) => id)).size !== records.length) {
    throw new Error("Canonical seed IDs must be unique.");
  }
  if (new Set(plan.systems.map(({ name }) => name)).size !== 11 || new Set(plan.systems.map(({ slug }) => slug)).size !== 11) {
    throw new Error("Canonical system names and slugs must be unique.");
  }
  for (const type of [AssessmentType.QUIZ, AssessmentType.TEST]) {
    if (plan.questions.filter(({ assessmentType }) => assessmentType === type).length !== 10) {
      throw new Error("Canonical assessment counts are invalid.");
    }
  }
  for (const question of plan.questions) {
    if (question.options.length !== 4 || question.options.filter(({ isCorrect }) => isCorrect).length !== 1) {
      throw new Error("Canonical question options are invalid.");
    }
    if (question.options.some(({ label, displayOrder }, index) => label !== String.fromCharCode(65 + index) || displayOrder !== index + 1)) {
      throw new Error("Canonical question option labels and ordering are invalid.");
    }
    if (new Set(question.options.flatMap(({ id, key }) => [id, key])).size !== question.options.length * 2) {
      throw new Error("Canonical option IDs and keys must be unique within a question.");
    }
  }
  const optionKeys = plan.questions.flatMap(({ options }) => options.map(({ key }) => key));
  if (new Set(optionKeys).size !== optionKeys.length) {
    throw new Error("Canonical option keys must be globally unique.");
  }
  const draftRecords = [...plan.systems, ...plan.topics, plan.lesson, ...plan.flashcards, ...plan.questions];
  if (draftRecords.some(({ status }) => status !== PublishStatus.DRAFT)) {
    throw new Error("Canonical demonstration content must remain draft.");
  }
  const reviewFields = [
    ...plan.systems.map(({ longDescription }) => longDescription),
    ...plan.topics.map(({ summary }) => summary),
    plan.lesson.summary,
    ...plan.flashcards.map(({ notes }) => notes),
    ...plan.questions.map(({ explanation }) => explanation),
  ];
  if (reviewFields.some((value) => !value.toLowerCase().includes("academic review"))) {
    throw new Error("Canonical demonstration content must be marked for academic review.");
  }
}

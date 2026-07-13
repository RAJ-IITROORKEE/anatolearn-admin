import { AssessmentType, Difficulty, PrismaClient, PublishStatus } from "@prisma/client";

const prisma = new PrismaClient();

const systems = [
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
] as const;

function uuid(group: number, item: number) {
  return `${group.toString(16).padStart(8, "0")}-0000-4000-8000-${item.toString(16).padStart(12, "0")}`;
}

async function main() {
  for (const [index, name] of systems.entries()) {
    const slug = name.toLowerCase();
    await prisma.organSystem.upsert({
      where: { id: uuid(1, index + 1) },
      update: {},
      create: {
        id: uuid(1, index + 1),
        name,
        slug,
        shortDescription: `Sample ${name.toLowerCase()} system learning module.`,
        displayOrder: index + 1,
        status: PublishStatus.DRAFT,
      },
    });
  }

  const circulatoryId = uuid(1, 1);
  const topicDefinitions = [
    { id: uuid(2, 1), title: "Heart structure", slug: "heart-structure" },
    { id: uuid(2, 2), title: "Blood vessels", slug: "blood-vessels" },
  ];

  for (const [index, topic] of topicDefinitions.entries()) {
    await prisma.topic.upsert({
      where: { id: topic.id },
      update: {},
      create: {
        ...topic,
        organSystemId: circulatoryId,
        summary: "Demonstration content for application development; requires academic review.",
        displayOrder: index + 1,
        status: PublishStatus.DRAFT,
      },
    });
  }

  await prisma.contentLesson.upsert({
    where: { id: uuid(3, 1) },
    update: {},
    create: {
      id: uuid(3, 1),
      topicId: topicDefinitions[0].id,
      title: "Sample heart overview",
      slug: "sample-heart-overview",
      summary: "Demonstration lesson requiring academic review before publication.",
      contentBlocks: [
        { id: "sample-heading", type: "heading", level: 2, text: "Heart overview" },
        {
          id: "sample-paragraph",
          type: "paragraph",
          text: "The heart is a muscular organ that supports circulation through the body.",
        },
      ],
      estimatedReadingMinutes: 2,
      displayOrder: 1,
      status: PublishStatus.DRAFT,
    },
  });

  for (let index = 1; index <= 4; index += 1) {
    await prisma.flashcard.upsert({
      where: { id: uuid(4, index) },
      update: {},
      create: {
        id: uuid(4, index),
        topicId: topicDefinitions[(index - 1) % topicDefinitions.length].id,
        frontText: `Sample circulatory prompt ${index}`,
        backText: `Sample answer ${index}; review before educational use.`,
        difficulty: Difficulty.EASY,
        displayOrder: index,
        status: PublishStatus.DRAFT,
      },
    });
  }

  for (const assessmentType of [AssessmentType.QUIZ, AssessmentType.TEST]) {
    const typeGroup = assessmentType === AssessmentType.QUIZ ? 5 : 6;
    for (let index = 1; index <= 10; index += 1) {
      const questionId = uuid(typeGroup, index);
      await prisma.question.upsert({
        where: { id: questionId },
        update: {},
        create: {
          id: questionId,
          topicId: topicDefinitions[(index - 1) % topicDefinitions.length].id,
          assessmentType,
          questionText: `Sample ${assessmentType.toLowerCase()} question ${index}?`,
          explanation: "Demonstration explanation requiring academic review.",
          difficulty: Difficulty.EASY,
          conceptTag: "sample",
          status: PublishStatus.DRAFT,
        },
      });

      for (let optionIndex = 1; optionIndex <= 4; optionIndex += 1) {
        await prisma.questionOption.upsert({
          where: { id: uuid(typeGroup + 10, index * 10 + optionIndex) },
          update: {},
          create: {
            id: uuid(typeGroup + 10, index * 10 + optionIndex),
            questionId,
            key: uuid(typeGroup + 20, index * 10 + optionIndex),
            label: String.fromCharCode(64 + optionIndex),
            displayOrder: optionIndex,
            optionText: `Sample option ${optionIndex}`,
            isCorrect: optionIndex === 1,
          },
        });
      }
    }
  }

  console.log("Seed completed: canonical systems and draft demonstration content are present.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed without exposing database credentials.");
    if (error instanceof Error) console.error(error.message.replace(/postgresql:\/\/[^\s]+/g, "[redacted]"));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

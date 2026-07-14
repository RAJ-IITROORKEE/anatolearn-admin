import type { AssessmentType, Difficulty, Prisma, PrismaClient, PublishStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type EligibleCandidate = {
  status: PublishStatus;
  isActive: boolean;
  media: { archivedAt: Date | null } | null;
  topic: { status: PublishStatus; organSystem: { status: PublishStatus; isActive: boolean } };
  options: Array<{ isCorrect: boolean; media: { archivedAt: Date | null } | null }>;
};

export function isEligibleSelectionQuestion(candidate: EligibleCandidate) {
  return candidate.status === "PUBLISHED"
    && candidate.isActive
    && candidate.topic.status === "PUBLISHED"
    && candidate.topic.organSystem.status === "PUBLISHED"
    && candidate.topic.organSystem.isActive
    && candidate.media?.archivedAt == null
    && candidate.options.length >= 2
    && candidate.options.length <= 6
    && candidate.options.filter((option) => option.isCorrect).length === 1
    && candidate.options.every((option) => option.media?.archivedAt == null);
}

// Internal assessment-engine boundary. No route exposes the question bank.
export async function getEligibleQuestions(input: {
  assessmentType: AssessmentType;
  organSystemId: string;
  topicIds?: string[];
  difficulty?: Difficulty;
}, db: Prisma.TransactionClient | PrismaClient = prisma) {
  const rows = await db.question.findMany({
    where: {
      trashedAt: null,
      assessmentType: input.assessmentType,
      status: "PUBLISHED",
      isActive: true,
      difficulty: input.difficulty,
      topicId: input.topicIds?.length ? { in: input.topicIds } : undefined,
      topic: { trashedAt: null, status: "PUBLISHED", organSystemId: input.organSystemId, organSystem: { trashedAt: null, status: "PUBLISHED", isActive: true } },
    },
    include: {
      media: { select: { archivedAt: true } },
      topic: { select: { id: true, title: true, status: true, organSystem: { select: { id: true, name: true, status: true, isActive: true } } } },
      options: { orderBy: { displayOrder: "asc" }, include: { media: { select: { archivedAt: true } } } },
    },
    orderBy: { id: "asc" },
  });
  return rows.filter(isEligibleSelectionQuestion);
}

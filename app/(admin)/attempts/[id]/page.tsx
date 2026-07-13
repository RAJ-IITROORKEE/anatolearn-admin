import { notFound } from "next/navigation";

import { AttemptDetail } from "@/components/assessments/attempt-detail";
import { getAdminAttempt } from "@/features/assessments/admin-service";
import { AssessmentError } from "@/features/assessments/domain";
import { attemptIdSchema } from "@/features/assessments/schemas";
import { getAdminMediaMap } from "@/features/media/service";

async function loadAttempt(id: string) {
  try {
    return await getAdminAttempt(id);
  } catch (error) {
    if (error instanceof AssessmentError && error.status === 404) notFound();
    throw error;
  }
}

export default async function AttemptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!attemptIdSchema.safeParse(id).success) notFound();
  const attempt = await loadAttempt(id);
  const mediaIds = attempt.questions.flatMap((question) => [
    question.mediaId,
    ...question.options.map((option) => option.mediaId),
  ]).filter((mediaId): mediaId is string => Boolean(mediaId));
  const mediaById = await getAdminMediaMap(mediaIds);
  return <AttemptDetail attempt={attempt} mediaById={mediaById} />;
}

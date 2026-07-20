import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getAdminLessonRouteById } from "@/components/phase3/data";
import { ContentError } from "@/features/content/domain";

export default async function LegacyContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  let lesson;
  try {
    lesson = await getAdminLessonRouteById(id);
  } catch (error) {
    if (error instanceof ContentError && error.code === "NOT_FOUND" && error.status === 404) notFound();
    throw error;
  }

  redirect(`/organ-systems/${lesson.organSystemSlug}/topics/${lesson.topicSlug}/content/${lesson.slug}`);
}

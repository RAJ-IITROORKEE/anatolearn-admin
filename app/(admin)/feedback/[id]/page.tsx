import { notFound } from "next/navigation";

import { FeedbackDetail } from "@/components/phase6/feedback-detail";
import { FeedbackError } from "@/features/feedback/domain";
import { feedbackIdSchema } from "@/features/feedback/schemas";
import { getAdminFeedback } from "@/features/feedback/service";

async function loadFeedback(id: string) {
  try { return await getAdminFeedback(id); }
  catch (error) { if (error instanceof FeedbackError && error.status === 404) notFound(); throw error; }
}

export default async function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!feedbackIdSchema.safeParse(id).success) notFound();
  return <FeedbackDetail feedback={await loadFeedback(id)} />;
}

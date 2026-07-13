import { notFound } from "next/navigation";

import { UserProgress } from "@/components/progress/user-progress";
import { ProgressError } from "@/features/progress/domain";
import { resourceIdSchema } from "@/features/progress/schemas";
import { getAdminUserProgress } from "@/features/progress/service";

async function loadProgress(id: string) {
  try {
    return await getAdminUserProgress(id);
  } catch (error) {
    if (error instanceof ProgressError && error.status === 404) notFound();
    throw error;
  }
}

export default async function UserProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!resourceIdSchema.safeParse(id).success) notFound();
  const progress = await loadProgress(id);
  return <UserProgress data={progress} />;
}

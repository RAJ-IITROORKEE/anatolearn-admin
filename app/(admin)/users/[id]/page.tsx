import { notFound } from "next/navigation";

import { UserProgress } from "@/components/progress/user-progress";
import { ProgressError } from "@/features/progress/domain";
import { resourceIdSchema } from "@/features/progress/schemas";
import { getAdminUserProgress } from "@/features/progress/service";
import { getLearner, getLearnerDeviceCounts } from "@/features/users/service";
import { UserManagementError } from "@/features/users/domain";

async function loadProgress(id: string) {
  try {
    return await getAdminUserProgress(id);
  } catch (error) {
    if (error instanceof ProgressError && error.status === 404) notFound();
    throw error;
  }
}

async function loadManagement(id: string) {
  try {
    const [user, devices] = await Promise.all([getLearner(id), getLearnerDeviceCounts(id)]);
    return { user, devices };
  } catch (error) {
    if (error instanceof UserManagementError && error.status === 404) notFound();
    throw error;
  }
}

export default async function UserProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!resourceIdSchema.safeParse(id).success) notFound();
  const [progress, management] = await Promise.all([loadProgress(id), loadManagement(id)]);
  return <UserProgress data={progress} management={{ userId: id, devices: management.devices, activity: management.user.activity }} />;
}

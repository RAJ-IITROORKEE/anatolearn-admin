import { getAdminUserProgress } from "@/features/progress/service";
import { resourceIdSchema } from "@/features/progress/schemas";
import { requireAdmin } from "@/lib/api/admin";
import { mapApiError } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const userId = resourceIdSchema.parse((await params).id);
    return apiSuccess(await getAdminUserProgress(userId), { requestId: auth.id });
  } catch (error) {
    return mapApiError(error, auth.id);
  }
}

import { getPublishedLessons } from "@/features/content/service";
import { withApiErrors } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async (id) => {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
    return apiSuccess(await getPublishedLessons((await params).id, identity.profile.id), { requestId: id });
  });
}

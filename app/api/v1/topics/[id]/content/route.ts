import { requireUser } from "@/features/content/route-handlers";
import { getPublishedLessons } from "@/features/content/service";
import { withApiErrors } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async (id) => {
    const denied = await requireUser(request, id); if (denied) return denied;
    return apiSuccess(await getPublishedLessons((await params).id), { requestId: id });
  });
}

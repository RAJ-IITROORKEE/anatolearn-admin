import { listQuerySchema } from "@/features/content/schemas";
import { requireUser } from "@/features/content/route-handlers";
import { listPublishedSystems } from "@/features/content/service";
import { withApiErrors } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  return withApiErrors(async (id) => {
    const denied = await requireUser(request, id); if (denied) return denied;
    const query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await listPublishedSystems(query);
    return apiSuccess(result.items, { requestId: id, pagination: result.pagination });
  });
}

import { parseEmptyJsonBody } from "@/lib/api/body";
import { requireAdmin } from "@/lib/api/admin";
import { mapApiError } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { restoreFromTrash } from "@/features/trash/service";
import { trashTypeSchema } from "@/features/trash/schemas";

type Context = { params: Promise<{ type: string; id: string }> };

export async function POST(request: Request, { params }: Context) {
  const auth = await requireAdmin(request, true);
  if ("response" in auth) return auth.response!;
  try {
    await parseEmptyJsonBody(request);
    const values = await params;
    const type = trashTypeSchema.parse(values.type);
    return apiSuccess(await restoreFromTrash(type, values.id, {
      actorId: auth.identity.profile.id,
      requestId: auth.id,
      userAgent: request.headers.get("user-agent"),
    }), { requestId: auth.id });
  } catch (error) {
    return mapApiError(error, auth.id, "/api/v1/admin/trash/[type]/[id]/restore");
  }
}

import { mediaError } from "@/features/media/http";
import { mediaUpdateSchema } from "@/features/media/schemas";
import { getMedia, updateMedia } from "@/features/media/service";
import { moveToTrash } from "@/features/trash/service";
import { requireAdmin } from "@/lib/api/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireAdmin(request); if ("response" in auth) return auth.response;
  try { return apiSuccess(await getMedia((await context.params).id), { requestId: auth.id }); } catch (error) { return mediaError(error, auth.id); }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireAdmin(request, true); if ("response" in auth) return auth.response;
  const input = mediaUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid media update.", 400, auth.id, input.error.flatten().fieldErrors);
  try { return apiSuccess(await updateMedia((await context.params).id, input.data.altText!, auth.identity.profile.id, auth.id), { requestId: auth.id }); } catch (error) { return mediaError(error, auth.id); }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await requireAdmin(request, true); if ("response" in auth) return auth.response;
  try { return apiSuccess(await moveToTrash("media-asset", (await context.params).id, { actorId: auth.identity.profile.id, requestId: auth.id }), { requestId: auth.id }); } catch (error) { return mediaError(error, auth.id); }
}

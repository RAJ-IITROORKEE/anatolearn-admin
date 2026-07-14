import { mapApiError } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/api/admin";
import { apiSuccess } from "@/lib/api/response";
import { campaignUpdateSchema } from "@/features/notifications/schemas";
import { getCampaign, updateCampaign } from "@/features/notifications/service";
import { parseId } from "@/features/notifications/route-utils";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await requireAdmin(request); if (auth.response) return auth.response;
  try { const id = parseId((await context.params).id, auth.id); if (id instanceof Response) return id; return apiSuccess(await getCampaign(id), { requestId: auth.id }); }
  catch (error) { return mapApiError(error, auth.id); }
}
export async function PATCH(request: Request, context: Context) {
  const auth = await requireAdmin(request, true); if (auth.response) return auth.response;
  try { const id = parseId((await context.params).id, auth.id); if (id instanceof Response) return id; const input = campaignUpdateSchema.parse(await request.json().catch(() => null)); return apiSuccess(await updateCampaign(id, input, { actorId: auth.identity.profile.id, requestId: auth.id, userAgent: request.headers.get("user-agent") }), { requestId: auth.id }); }
  catch (error) { return mapApiError(error, auth.id); }
}

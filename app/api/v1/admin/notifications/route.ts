import { mapApiError } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/api/admin";
import { apiSuccess } from "@/lib/api/response";
import { campaignCreateSchema } from "@/features/notifications/schemas";
import { createCampaign, listCampaigns } from "@/features/notifications/service";
import { parseList } from "@/features/notifications/route-utils";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try { const result = await listCampaigns(parseList(request)); return apiSuccess(result.items, { requestId: auth.id, pagination: result.pagination }); }
  catch (error) { return mapApiError(error, auth.id); }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request, true);
  if (auth.response) return auth.response;
  try {
    const input = campaignCreateSchema.parse(await request.json().catch(() => null));
    return apiSuccess(await createCampaign(input, { actorId: auth.identity.profile.id, requestId: auth.id, userAgent: request.headers.get("user-agent") }), { requestId: auth.id }, 201);
  } catch (error) { return mapApiError(error, auth.id); }
}

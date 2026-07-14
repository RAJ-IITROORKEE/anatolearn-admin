import { mapApiError } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/api/admin";
import { apiSuccess } from "@/lib/api/response";
import { adminUserListSchema, updateUserActivitySchema, userIdSchema } from "./schemas";
import { getLearner, listLearners, setLearnerActivity } from "./service";

type Context = { params: Promise<{ id: string }> };

export async function adminUserListHandler(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const input = adminUserListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await listLearners(input);
    return apiSuccess(result.items, { requestId: auth.id, pagination: result.pagination, summary: result.summary });
  } catch (error) { return mapApiError(error, auth.id); }
}

export async function adminUserItemHandler(request: Request, context: Context) {
  const mutation = request.method === "PATCH";
  const auth = await requireAdmin(request, mutation);
  if (auth.response) return auth.response;
  try {
    const id = userIdSchema.parse((await context.params).id);
    if (!mutation) return apiSuccess(await getLearner(id), { requestId: auth.id });
    const input = updateUserActivitySchema.parse(await request.json().catch(() => null));
    return apiSuccess(await setLearnerActivity(id, input.isActive, {
      actorId: auth.identity.profile.id, requestId: auth.id, userAgent: request.headers.get("user-agent") ?? undefined,
    }), { requestId: auth.id });
  } catch (error) { return mapApiError(error, auth.id); }
}

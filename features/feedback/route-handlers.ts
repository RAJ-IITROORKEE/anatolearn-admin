import { mapApiError } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/api/admin";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { allowRequest } from "@/lib/rate-limit";
import { hasSafeOrigin } from "@/lib/security/origin";
import { adminFeedbackListSchema, adminFeedbackUpdateSchema, createFeedbackSchema, feedbackIdSchema, mineFeedbackListSchema } from "./schemas";
import { createFeedback, getAdminFeedback, listAdminFeedback, listMyFeedback, updateFeedback } from "./service";

type Context = { params: Promise<{ id: string }> };

async function requireActiveIdentity(request: Request, mutation: boolean) {
  const id = requestId();
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return { response: apiError("UNAUTHORIZED", "Authentication is required.", 401, id), id } as const;
    if (mutation && identity.mode === "cookie" && !hasSafeOrigin(request.headers)) {
      return { response: apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id), id } as const;
    }
    return { identity, id } as const;
  } catch (error) {
    return { response: mapApiError(error, id), id } as const;
  }
}

export async function feedbackSubmitHandler(request: Request) {
  const auth = await requireActiveIdentity(request, true);
  if ("response" in auth) return auth.response;
  const key = `feedback:user:${auth.identity.profile.id}`;
  if (!allowRequest(key, 5, 60_000)) {
    const response = apiError("RATE_LIMITED", "Try again later.", 429, auth.id);
    response.headers.set("Retry-After", "60");
    return response;
  }
  try {
    const input = createFeedbackSchema.parse(await request.json().catch(() => null));
    return apiSuccess(await createFeedback(auth.identity.profile.id, input), { requestId: auth.id }, 201);
  } catch (error) { return mapApiError(error, auth.id); }
}

export async function feedbackMineHandler(request: Request) {
  const auth = await requireActiveIdentity(request, false);
  if ("response" in auth) return auth.response;
  try {
    const input = mineFeedbackListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await listMyFeedback(auth.identity.profile.id, input);
    return apiSuccess(result.items, { requestId: auth.id, pagination: result.pagination });
  } catch (error) { return mapApiError(error, auth.id); }
}

export async function adminFeedbackListHandler(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const input = adminFeedbackListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await listAdminFeedback(input);
    return apiSuccess(result.items, { requestId: auth.id, pagination: result.pagination });
  } catch (error) { return mapApiError(error, auth.id); }
}

export async function adminFeedbackItemHandler(request: Request, context: Context) {
  const mutation = request.method === "PATCH";
  const auth = await requireAdmin(request, mutation);
  if (auth.response) return auth.response;
  try {
    const id = feedbackIdSchema.parse((await context.params).id);
    if (!mutation) return apiSuccess(await getAdminFeedback(id), { requestId: auth.id });
    const input = adminFeedbackUpdateSchema.parse(await request.json().catch(() => null));
    return apiSuccess(await updateFeedback(id, input, {
      actorId: auth.identity.profile.id, requestId: auth.id, userAgent: request.headers.get("user-agent") ?? undefined,
    }), { requestId: auth.id });
  } catch (error) { return mapApiError(error, auth.id); }
}

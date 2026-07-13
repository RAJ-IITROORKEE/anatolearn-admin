import { mapApiError } from "@/lib/api/handler";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { hasSafeOrigin } from "@/lib/security/origin";
import { updateLessonProgress } from "./lesson-service";
import { lessonProgressSchema, resourceIdSchema } from "./schemas";
import { getUserDashboard, getUserProgress } from "./service";

type SystemContext = { params: Promise<{ organSystemId: string }> };
type LessonContext = { params: Promise<{ id: string }> };

async function userHandler(request: Request, mutation: boolean, callback: (userId: string, id: string) => Promise<Response>) {
  const id = requestId();
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
    if (mutation && identity.mode === "cookie" && !hasSafeOrigin(request.headers)) {
      return apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id);
    }
    return await callback(identity.profile.id, id);
  } catch (error) {
    return mapApiError(error, id);
  }
}

export function progressListHandler(request: Request) {
  return userHandler(request, false, async (userId, id) => apiSuccess(await getUserProgress(userId), { requestId: id }));
}

export function progressDetailHandler(request: Request, context: SystemContext) {
  return userHandler(request, false, async (userId, id) => {
    const organSystemId = resourceIdSchema.parse((await context.params).organSystemId);
    const systems = await getUserProgress(userId, organSystemId);
    return apiSuccess(systems[0], { requestId: id });
  });
}

export function dashboardHandler(request: Request) {
  return userHandler(request, false, async (userId, id) => apiSuccess(await getUserDashboard(userId), { requestId: id }));
}

export function lessonProgressHandler(request: Request, context: LessonContext) {
  return userHandler(request, true, async (userId, id) => {
    const lessonId = resourceIdSchema.parse((await context.params).id);
    const input = lessonProgressSchema.parse(await request.json().catch(() => null));
    return apiSuccess(await updateLessonProgress(lessonId, userId, input), { requestId: id });
  });
}

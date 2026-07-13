import { apiError, apiSuccess } from "@/lib/api/response";
import { withApiErrors } from "@/lib/api/handler";
import { hasRole, resolveRequestIdentity } from "@/lib/auth/request";
import { hasSafeOrigin } from "@/lib/security/origin";
import { contentLessonCreateSchema, contentLessonUpdateSchema, listQuerySchema, organSystemCreateSchema, organSystemUpdateSchema, reorderSchema, statusUpdateSchema, topicCreateSchema, topicUpdateSchema } from "./schemas";
import { createContent, getAdmin, listAdmin, reorderContent, setStatus, updateContent } from "./service";

export type Resource = "organSystem" | "topic" | "contentLesson";
const schemas = {
  organSystem: { create: organSystemCreateSchema, update: organSystemUpdateSchema },
  topic: { create: topicCreateSchema, update: topicUpdateSchema },
  contentLesson: { create: contentLessonCreateSchema, update: contentLessonUpdateSchema },
};

async function admin(request: Request, id: string, mutation = false) {
  const identity = await resolveRequestIdentity(request);
  if (!identity) return { error: apiError("UNAUTHORIZED", "Authentication is required.", 401, id) };
  if (!hasRole(identity, "ADMIN")) return { error: apiError("FORBIDDEN", "Administrator access is required.", 403, id) };
  if (mutation && identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return { error: apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id) };
  return { identity };
}

function context(request: Request, actorId: string, id: string) {
  return { actorId, requestId: id, userAgent: request.headers.get("user-agent") };
}

export function adminCollectionHandlers(resource: Resource) {
  return {
    GET: (request: Request) => withApiErrors(async (id) => {
      const auth = await admin(request, id); if (auth.error) return auth.error;
      const query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
      const result = await listAdmin(resource, query);
      return apiSuccess(result.items, { requestId: id, pagination: result.pagination });
    }),
    POST: (request: Request) => withApiErrors(async (id) => {
      const auth = await admin(request, id, true); if (auth.error || !auth.identity) return auth.error!;
      const input = schemas[resource].create.parse(await request.json().catch(() => null));
      return apiSuccess(await createContent(resource, input, context(request, auth.identity.profile.id, id)), { requestId: id }, 201);
    }),
    PATCH: (request: Request) => withApiErrors(async (id) => {
      const auth = await admin(request, id, true); if (auth.error || !auth.identity) return auth.error!;
      const input = reorderSchema.parse(await request.json().catch(() => null));
      if (resource !== "organSystem" && !input.parentId) return apiError("VALIDATION_ERROR", "parentId is required.", 400, id);
      return apiSuccess(await reorderContent(resource, input.parentId, input.ids, context(request, auth.identity.profile.id, id)), { requestId: id });
    }),
  };
}

export function adminItemHandlers(resource: Resource) {
  return {
    GET: (request: Request, { params }: { params: Promise<{ id: string }> }) => withApiErrors(async (id) => {
      const auth = await admin(request, id); if (auth.error) return auth.error;
      return apiSuccess(await getAdmin(resource, (await params).id), { requestId: id });
    }),
    PATCH: (request: Request, { params }: { params: Promise<{ id: string }> }) => withApiErrors(async (id) => {
      const auth = await admin(request, id, true); if (auth.error || !auth.identity) return auth.error!;
      const body: unknown = await request.json().catch(() => null);
      const target = (await params).id;
      const status = statusUpdateSchema.safeParse(body);
      const result = status.success ? await setStatus(resource, target, status.data.status, context(request, auth.identity.profile.id, id)) : await updateContent(resource, target, schemas[resource].update.parse(body), context(request, auth.identity.profile.id, id));
      return apiSuccess(result, { requestId: id });
    }),
    DELETE: (request: Request, { params }: { params: Promise<{ id: string }> }) => withApiErrors(async (id) => {
      const auth = await admin(request, id, true); if (auth.error || !auth.identity) return auth.error!;
      const result = await setStatus(resource, (await params).id, "ARCHIVED", context(request, auth.identity.profile.id, id));
      return apiSuccess(result, { requestId: id });
    }),
  };
}

export async function requireUser(request: Request, id: string) {
  const identity = await resolveRequestIdentity(request);
  return identity ? null : apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
}

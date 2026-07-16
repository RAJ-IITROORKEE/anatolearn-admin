import { apiError, apiSuccess } from "@/lib/api/response";
import { withApiErrors } from "@/lib/api/handler";
import { hasRole, resolveRequestIdentity } from "@/lib/auth/request";
import { hasSafeOrigin } from "@/lib/security/origin";
import {
  flashcardBulkStatusSchema,
  flashcardCreateSchema,
  flashcardIdSchema,
  flashcardListQuerySchema,
  flashcardReorderSchema,
  flashcardStatusUpdateSchema,
  flashcardUpdateSchema,
} from "./schemas";
import {
  bulkSetFlashcardStatus,
  createFlashcard,
  getAdminFlashcard,
  listAdminFlashcards,
  reorderFlashcards,
  setFlashcardStatus,
  updateFlashcard,
} from "./service";
import { moveToTrash } from "@/features/trash/service";
import { cleanupDirectUploads, directUploadContext, formBoolean, formNullable, formNumber, formValue, resolveMediaField } from "@/features/media/direct-upload";

async function requireAdmin(request: Request, requestId: string, mutation = false) {
  const identity = await resolveRequestIdentity(request);
  if (!identity) return { error: apiError("UNAUTHORIZED", "Authentication is required.", 401, requestId) };
  if (!hasRole(identity, "ADMIN")) return { error: apiError("FORBIDDEN", "Administrator access is required.", 403, requestId) };
  if (mutation && identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return { error: apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, requestId) };
  return { identity };
}

function context(request: Request, actorId: string, requestId: string) {
  return { actorId, requestId, userAgent: request.headers.get("user-agent") };
}

async function multipartInput(request: Request, actorId: string, requestId: string) {
  const data = await request.formData();
  const uploads = directUploadContext(actorId, requestId, request.headers.get("user-agent"));
  try {
    return { uploads, input: {
      topicId: formValue(data, "topicId"), frontText: formValue(data, "frontText"), backText: formValue(data, "backText"),
      frontMediaId: await resolveMediaField(data, { fileKey: "frontFile", altText: formValue(data, "frontAltText"), existingId: formNullable(data, "frontMediaId"), clear: formBoolean(data, "clearFront") }, uploads),
      backMediaId: await resolveMediaField(data, { fileKey: "backFile", altText: formValue(data, "backAltText"), existingId: formNullable(data, "backMediaId"), clear: formBoolean(data, "clearBack") }, uploads),
      difficulty: formValue(data, "difficulty"), notes: formNullable(data, "notes"), displayOrder: formNumber(data, "displayOrder"),
    } };
  } catch (error) { await cleanupDirectUploads(uploads); throw error; }
}

async function routeId(params: Promise<{ id: string }>) {
  return flashcardIdSchema.parse((await params).id);
}

export const adminFlashcardCollectionHandlers = {
  GET: (request: Request) => withApiErrors(async (requestId) => {
    const auth = await requireAdmin(request, requestId);
    if (auth.error) return auth.error;
    const query = flashcardListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await listAdminFlashcards(query);
    return apiSuccess(result.items, { requestId, pagination: result.pagination });
  }),
  POST: (request: Request) => withApiErrors(async (requestId) => {
    const auth = await requireAdmin(request, requestId, true);
    if (auth.error || !auth.identity) return auth.error!;
     if (request.headers.get("content-type")?.includes("multipart/form-data")) { const parsed = await multipartInput(request, auth.identity.profile.id, requestId); try { const input = flashcardCreateSchema.parse(parsed.input); return apiSuccess(await createFlashcard(input, context(request, auth.identity.profile.id, requestId)), { requestId }, 201); } catch (error) { await cleanupDirectUploads(parsed.uploads); throw error; } }
     const input = flashcardCreateSchema.parse(await request.json().catch(() => null));
     return apiSuccess(await createFlashcard(input, context(request, auth.identity.profile.id, requestId)), { requestId }, 201);
  }),
  PATCH: (request: Request) => withApiErrors(async (requestId) => {
    const auth = await requireAdmin(request, requestId, true);
    if (auth.error || !auth.identity) return auth.error!;
    const input = flashcardReorderSchema.parse(await request.json().catch(() => null));
    return apiSuccess(await reorderFlashcards(input.parentId, input.ids, context(request, auth.identity.profile.id, requestId)), { requestId });
  }),
};

export const adminFlashcardItemHandlers = {
  GET: (request: Request, { params }: { params: Promise<{ id: string }> }) => withApiErrors(async (requestId) => {
    const auth = await requireAdmin(request, requestId);
    if (auth.error) return auth.error;
    return apiSuccess(await getAdminFlashcard(await routeId(params)), { requestId });
  }),
  PATCH: (request: Request, { params }: { params: Promise<{ id: string }> }) => withApiErrors(async (requestId) => {
    const auth = await requireAdmin(request, requestId, true);
    if (auth.error || !auth.identity) return auth.error!;
     let uploads: ReturnType<typeof directUploadContext> | undefined;
     const body: unknown = request.headers.get("content-type")?.includes("multipart/form-data") ? (await multipartInput(request, auth.identity.profile.id, requestId).then((parsed) => { uploads = parsed.uploads; return parsed.input; })) : await request.json().catch(() => null);
    const status = flashcardStatusUpdateSchema.safeParse(body);
    const mutationContext = context(request, auth.identity.profile.id, requestId);
     try {
       const result = status.success
         ? await setFlashcardStatus(await routeId(params), status.data.status, mutationContext)
         : await updateFlashcard(await routeId(params), flashcardUpdateSchema.parse(body), mutationContext);
       return apiSuccess(result, { requestId });
     } catch (error) { if (uploads) await cleanupDirectUploads(uploads); throw error; }
  }),
  DELETE: (request: Request, { params }: { params: Promise<{ id: string }> }) => withApiErrors(async (requestId) => {
    const auth = await requireAdmin(request, requestId, true);
    if (auth.error || !auth.identity) return auth.error!;
    return apiSuccess(await moveToTrash("flashcard", await routeId(params), context(request, auth.identity.profile.id, requestId)), { requestId });
  }),
};

export function adminFlashcardBulkStatusHandler(request: Request) {
  return withApiErrors(async (requestId) => {
    const auth = await requireAdmin(request, requestId, true);
    if (auth.error || !auth.identity) return auth.error!;
    const input = flashcardBulkStatusSchema.parse(await request.json().catch(() => null));
    return apiSuccess(await bulkSetFlashcardStatus(input.ids, input.status, context(request, auth.identity.profile.id, requestId)), { requestId });
  });
}

export function adminFlashcardStatusHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async (requestId) => {
    const auth = await requireAdmin(request, requestId, true);
    if (auth.error || !auth.identity) return auth.error!;
    const input = flashcardStatusUpdateSchema.parse(await request.json().catch(() => null));
    return apiSuccess(await setFlashcardStatus(await routeId(params), input.status, context(request, auth.identity.profile.id, requestId)), { requestId });
  });
}

export function adminFlashcardArchiveHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async (requestId) => {
    const auth = await requireAdmin(request, requestId, true);
    if (auth.error || !auth.identity) return auth.error!;
    return apiSuccess(await moveToTrash("flashcard", await routeId(params), context(request, auth.identity.profile.id, requestId)), { requestId });
  });
}

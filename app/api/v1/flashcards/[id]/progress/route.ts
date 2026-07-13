import { flashcardIdSchema, flashcardProgressSchema } from "@/features/flashcards/schemas";
import { updateFlashcardProgress } from "@/features/flashcards/service";
import { withApiErrors } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { hasSafeOrigin } from "@/lib/security/origin";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async (requestId) => {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, requestId);
    if (identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, requestId);
    const input = flashcardProgressSchema.parse(await request.json().catch(() => null));
    return apiSuccess(await updateFlashcardProgress(flashcardIdSchema.parse((await params).id), identity.profile.id, input), { requestId });
  });
}

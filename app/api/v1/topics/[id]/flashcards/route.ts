import { listPublishedFlashcards } from "@/features/flashcards/service";
import { flashcardIdSchema } from "@/features/flashcards/schemas";
import { withApiErrors } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async (requestId) => {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, requestId);
    return apiSuccess(await listPublishedFlashcards(flashcardIdSchema.parse((await params).id), identity.profile.id), { requestId });
  });
}

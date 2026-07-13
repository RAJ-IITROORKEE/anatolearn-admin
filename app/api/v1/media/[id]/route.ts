import { mediaError } from "@/features/media/http";
import { getPublishedMedia } from "@/features/media/service";
import { mediaIdSchema } from "@/features/media/schemas";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = requestId();
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
    const mediaId = mediaIdSchema.parse((await params).id);
    return apiSuccess(await getPublishedMedia(mediaId, identity.profile.id), { requestId: id });
  } catch (error) {
    return mediaError(error, id);
  }
}

import { AvatarError, deleteManagedAvatar, replaceManagedAvatar } from "@/features/profile/avatar-service";
import { MediaServiceError } from "@/features/media/domain";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { allowRequest } from "@/lib/rate-limit";
import { hasSafeOrigin } from "@/lib/security/origin";

async function authorize(request: Request, id: string) {
  const identity = await resolveRequestIdentity(request);
  if (!identity) return { response: apiError("UNAUTHORIZED", "Authentication is required.", 401, id) };
  if (identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return { response: apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id) };
  if (!await allowRequest(`avatar:${identity.profile.id}`, 10, 60_000)) {
    const response = apiError("RATE_LIMITED", "Too many avatar requests.", 429, id);
    response.headers.set("Retry-After", "60");
    return { response };
  }
  return { identity };
}

function failure(error: unknown, id: string) {
  if (error instanceof AvatarError || error instanceof MediaServiceError) {
    if (error.code === "INVALID_FILE") return apiError("INVALID_FILE", "The avatar file is invalid.", 422, id);
    if (error.code === "STORAGE_ERROR") return apiError("MEDIA_UNAVAILABLE", "Avatar storage is temporarily unavailable.", 503, id);
    if (error.code === "NOT_FOUND") return apiError("NOT_FOUND", "Active profile was not found.", 404, id);
  }
  return apiError("INTERNAL_ERROR", "The avatar operation failed.", 500, id);
}

export async function PUT(request: Request) {
  const id = requestId();
  try {
    const auth = await authorize(request, id);
    if (auth.response) return auth.response;
    const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (mediaType !== "multipart/form-data") {
      return apiError("VALIDATION_ERROR", "A multipart form body is required.", 400, id);
    }
    let form;
    try {
      form = await request.formData();
    } catch {
      return apiError("VALIDATION_ERROR", "The multipart form body is malformed.", 400, id);
    }
    if ([...form.keys()].some((key) => key !== "file")) return apiError("VALIDATION_ERROR", "Multipart body must contain only file.", 400, id);
    const files = form.getAll("file");
    if (files.length !== 1 || !(files[0] instanceof File) || !files[0].size) return apiError("VALIDATION_ERROR", "Exactly one file is required.", 400, id);
    await replaceManagedAvatar(auth.identity.profile.id, files[0], id);
    return apiSuccess({ avatarUpdated: true }, { requestId: id });
  } catch (error) {
    return failure(error, id);
  }
}

export async function DELETE(request: Request) {
  const id = requestId();
  try {
    const auth = await authorize(request, id);
    if (auth.response) return auth.response;
    await deleteManagedAvatar(auth.identity.profile.id, id);
    return apiSuccess({ avatarUpdated: true }, { requestId: id });
  } catch (error) {
    return failure(error, id);
  }
}

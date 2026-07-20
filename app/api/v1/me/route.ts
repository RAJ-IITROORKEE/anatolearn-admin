import { profileUpdateSchema } from "@/features/auth/api-schemas";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { hasSafeOrigin } from "@/lib/security/origin";
import { getProfileAvatarUrlMap } from "@/features/media/service";
import { mapApiError } from "@/lib/api/handler";

async function profileDto(profile: { id: string; fullName: string; email: string; avatarUrl: string | null; avatarMediaId: string | null; isActive: boolean }) {
  const avatarUrls = await getProfileAvatarUrlMap([profile]);
  return { id: profile.id, fullName: profile.fullName, email: profile.email, avatarUrl: avatarUrls.get(profile.id) ?? null, isActive: profile.isActive };
}

export async function GET(request: Request) {
  const id = requestId();
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
    return apiSuccess(await profileDto(identity.profile), { requestId: id });
  } catch (error) { return mapApiError(error, id, "/api/v1/me"); }
}

export async function PATCH(request: Request) {
  const id = requestId();
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
    if (identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id);
    const input = profileUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!input.success || Object.keys(input.data).length === 0) return apiError("VALIDATION_ERROR", "Invalid profile update.", 400, id, input.success ? undefined : input.error.flatten().fieldErrors);
    const profile = await prisma.profile.update({ where: { id: identity.profile.id }, data: input.data });
    return apiSuccess(await profileDto(profile), { requestId: id });
  } catch (error) { return mapApiError(error, id, "/api/v1/me"); }
}

import { profileUpdateSchema } from "@/features/auth/api-schemas";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { hasSafeOrigin } from "@/lib/security/origin";

function profileDto(profile: { id: string; fullName: string; email: string; role: string; avatarUrl: string | null; isActive: boolean }) {
  return { id: profile.id, fullName: profile.fullName, email: profile.email, role: profile.role, avatarUrl: profile.avatarUrl, isActive: profile.isActive };
}

export async function GET(request: Request) {
  const id = requestId();
  const identity = await resolveRequestIdentity(request);
  if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
  return apiSuccess(profileDto(identity.profile), { requestId: id });
}

export async function PATCH(request: Request) {
  const id = requestId();
  const identity = await resolveRequestIdentity(request);
  if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
  if (identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id);
  const input = profileUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || Object.keys(input.data).length === 0) return apiError("VALIDATION_ERROR", "Invalid profile update.", 400, id, input.success ? undefined : input.error.flatten().fieldErrors);
  const profile = await prisma.profile.update({ where: { id: identity.profile.id }, data: input.data });
  return apiSuccess(profileDto(profile), { requestId: id });
}

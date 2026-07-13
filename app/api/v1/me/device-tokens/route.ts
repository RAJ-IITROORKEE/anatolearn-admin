import { deviceTokenSchema } from "@/features/auth/api-schemas";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { hasSafeOrigin } from "@/lib/security/origin";

export async function POST(request: Request) {
  const id = requestId();
  const identity = await resolveRequestIdentity(request);
  if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
  if (identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id);
  const input = deviceTokenSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid device token.", 400, id, input.error.flatten().fieldErrors);
  const token = await prisma.deviceToken.upsert({
    where: { expoPushToken: input.data.expoPushToken },
    create: { ...input.data, userId: identity.profile.id },
    update: { userId: identity.profile.id, platform: input.data.platform, isActive: true, lastSeenAt: new Date() },
    select: { id: true, platform: true, isActive: true, lastSeenAt: true },
  });
  return apiSuccess(token, { requestId: id }, 201);
}

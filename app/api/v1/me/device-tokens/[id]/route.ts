import { z } from "zod";

import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { prisma } from "@/lib/db/prisma";
import { hasSafeOrigin } from "@/lib/security/origin";

const idSchema = z.uuid();

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestIdentifier = requestId();
  const identity = await resolveRequestIdentity(request);
  if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, requestIdentifier);
  if (identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, requestIdentifier);
  const parsedId = idSchema.safeParse((await context.params).id);
  if (!parsedId.success) return apiError("NOT_FOUND", "Device token was not found.", 404, requestIdentifier);
  const result = await prisma.deviceToken.updateMany({ where: { id: parsedId.data, userId: identity.profile.id }, data: { isActive: false } });
  if (!result.count) return apiError("NOT_FOUND", "Device token was not found.", 404, requestIdentifier);
  return apiSuccess({ deactivated: true }, { requestId: requestIdentifier });
}

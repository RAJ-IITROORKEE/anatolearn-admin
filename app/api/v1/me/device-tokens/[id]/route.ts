import { z } from "zod";

import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { mapApiError } from "@/lib/api/handler";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { deactivateDeviceToken } from "@/features/notifications/device-token-service";
import { allowRequest } from "@/lib/rate-limit";
import { hasSafeOrigin } from "@/lib/security/origin";

const idSchema = z.uuid();

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestIdentifier = requestId();
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, requestIdentifier);
    if (identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, requestIdentifier);
    if (!await allowRequest(`device-token:${identity.profile.id}`, 20)) {
      const response = apiError("RATE_LIMITED", "Too many requests.", 429, requestIdentifier);
      response.headers.set("Retry-After", "60");
      return response;
    }
    const parsedId = idSchema.safeParse((await context.params).id);
    if (!parsedId.success) return apiError("NOT_FOUND", "Device token was not found.", 404, requestIdentifier);
    return apiSuccess(await deactivateDeviceToken(identity.profile.id, parsedId.data), { requestId: requestIdentifier });
  } catch (error) { return mapApiError(error, requestIdentifier); }
}

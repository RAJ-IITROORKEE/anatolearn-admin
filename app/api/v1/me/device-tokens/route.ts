import { deviceTokenSchema } from "@/features/auth/api-schemas";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { mapApiError } from "@/lib/api/handler";
import { resolveRequestIdentity } from "@/lib/auth/request";
import { registerDeviceToken } from "@/features/notifications/device-token-service";
import { allowRequest } from "@/lib/rate-limit";
import { hasSafeOrigin } from "@/lib/security/origin";

export async function POST(request: Request) {
  const id = requestId();
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
    if (identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id);
    if (!await allowRequest(`device-token:${identity.profile.id}`, 20)) {
      const response = apiError("RATE_LIMITED", "Too many requests.", 429, id);
      response.headers.set("Retry-After", "60");
      return response;
    }
    const input = deviceTokenSchema.parse(await request.json().catch(() => null));
    return apiSuccess(await registerDeviceToken(identity.profile.id, input), { requestId: id }, 201);
  } catch (error) { return mapApiError(error, id); }
}

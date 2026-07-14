import { resolveRequestIdentity } from "@/lib/auth/request";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";

export async function GET(request: Request) {
  const id = requestId();
  const identity = await resolveRequestIdentity(request);
  if (!identity) return apiError("UNAUTHORIZED", "Authentication is required.", 401, id);
  return apiSuccess({ profile: { id: identity.profile.id, fullName: identity.profile.fullName, email: identity.profile.email } }, { requestId: id });
}

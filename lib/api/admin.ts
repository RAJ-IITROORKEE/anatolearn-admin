import { apiError, requestId } from "@/lib/api/response";
import { resolveRequestIdentity, type RequestIdentity } from "@/lib/auth/request";
import { hasSafeOrigin } from "@/lib/security/origin";

type AdminResult =
  | { response: Response; identity?: never; id: string }
  | { identity: RequestIdentity; response?: never; id: string };

export async function requireAdmin(request: Request, mutation = false): Promise<AdminResult> {
  const id = requestId();
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return { response: apiError("UNAUTHORIZED", "Authentication is required.", 401, id), id };
    if (identity.profile.role !== "ADMIN") return { response: apiError("FORBIDDEN", "Administrator access is required.", 403, id), id };
    if (mutation && identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return { response: apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id), id };
    return { identity, id };
  } catch (error) {
    console.error("Admin identity resolution failed", { requestId: id, error });
    return { response: apiError("INTERNAL_ERROR", "An unexpected error occurred.", 500, id), id };
  }
}

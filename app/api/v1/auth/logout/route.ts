import { resolveRequestIdentity } from "@/lib/auth/request";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { hasSafeOrigin } from "@/lib/security/origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const id = requestId();
  const identity = await resolveRequestIdentity(request);
  if (!identity) return apiSuccess({ loggedOut: true }, { requestId: id });
  if (identity.mode === "cookie" && !hasSafeOrigin(request.headers)) return apiError("INVALID_ORIGIN", "Request origin is not allowed.", 403, id);
  if (identity.mode === "cookie") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } else {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token) await createSupabaseAdminClient().auth.admin.signOut(token, "local");
  }
  return apiSuccess({ loggedOut: true }, { requestId: id });
}

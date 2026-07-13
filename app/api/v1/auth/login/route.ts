import { loginSchema } from "@/features/auth/api-schemas";
import { findProfileForUser } from "@/features/auth/profile-service";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { allowRequest, requestClientKey } from "@/lib/rate-limit";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function POST(request: Request) {
  const id = requestId();
  if (!allowRequest(requestClientKey(request, "login"), 10)) return apiError("RATE_LIMITED", "Try again later.", 429, id);
  const input = loginSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid credentials.", 400, id);
  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword(input.data);
  if (error || !data.user || !data.session) return apiError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401, id);
  const profile = await findProfileForUser(data.user.id);
  if (!profile?.isActive) return apiError("ACCOUNT_INACTIVE", "Account access is unavailable.", 403, id);
  return apiSuccess({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    tokenType: data.session.token_type,
    profile: { id: profile.id, fullName: profile.fullName, role: profile.role },
  }, { requestId: id });
}

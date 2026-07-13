import { emailSchema } from "@/features/auth/api-schemas";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { getAuthRedirectUrls } from "@/lib/env";
import { allowRequest, requestClientKey } from "@/lib/rate-limit";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function POST(request: Request) {
  const id = requestId();
  if (!allowRequest(requestClientKey(request, "forgot-password"), 5)) return apiError("RATE_LIMITED", "Try again later.", 429, id);
  const input = emailSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Enter a valid email address.", 400, id);
  const supabase = createSupabaseAuthClient();
  const { passwordReset } = getAuthRedirectUrls();
  await supabase.auth.resetPasswordForEmail(input.data.email, { redirectTo: passwordReset });
  return apiSuccess({ message: "If an account exists, reset instructions have been sent." }, { requestId: id });
}

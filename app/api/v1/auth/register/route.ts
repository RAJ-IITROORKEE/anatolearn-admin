import { registerSchema } from "@/features/auth/api-schemas";
import { provisionUserProfile } from "@/features/auth/profile-service";
import { apiError, apiSuccess, requestId } from "@/lib/api/response";
import { allowRequest, requestClientKey } from "@/lib/rate-limit";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export async function POST(request: Request) {
  const id = requestId();
  if (!allowRequest(requestClientKey(request, "register"), 5)) return apiError("RATE_LIMITED", "Try again later.", 429, id);
  const input = registerSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid registration details.", 400, id, input.error.flatten().fieldErrors);
  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.data.email,
    password: input.data.password,
    options: { data: { full_name: input.data.fullName } },
  });
  if (error || !data.user) return apiError("REGISTRATION_FAILED", "Registration could not be completed.", 409, id);
  await provisionUserProfile(data.user, input.data.fullName);
  return apiSuccess({ userId: data.user.id, emailConfirmationRequired: !data.session }, { requestId: id }, 201);
}

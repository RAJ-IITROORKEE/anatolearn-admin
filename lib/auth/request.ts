import "server-only";

import type { Profile, UserRole } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

import { findProfileForUser } from "@/features/auth/profile-service";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasRecoveryMethod } from "./token-claims";

export type RequestIdentity = { user: User; profile: Profile; mode: "bearer" | "cookie" };

export async function resolveRequestIdentity(request: Request): Promise<RequestIdentity | null> {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer && hasRecoveryMethod(bearer)) return null;
  const supabase = bearer ? createSupabaseAuthClient() : await createSupabaseServerClient();
  if (!bearer) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token || hasRecoveryMethod(sessionData.session.access_token)) return null;
  }
  const { data, error } = bearer ? await supabase.auth.getUser(bearer) : await supabase.auth.getUser();
  if (error || !data.user) return null;
  const profile = await findProfileForUser(data.user.id);
  if (!profile?.isActive) return null;
  return { user: data.user, profile, mode: bearer ? "bearer" : "cookie" };
}

export function hasRole(identity: RequestIdentity, role: UserRole) {
  return identity.profile.role === role;
}

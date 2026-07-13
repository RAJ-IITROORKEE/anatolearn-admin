import "server-only";

import type { Profile, UserRole } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

import { findProfileForUser } from "@/features/auth/profile-service";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RequestIdentity = { user: User; profile: Profile; mode: "bearer" | "cookie" };

export async function resolveRequestIdentity(request: Request): Promise<RequestIdentity | null> {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabase = bearer ? createSupabaseAuthClient() : await createSupabaseServerClient();
  const { data, error } = bearer ? await supabase.auth.getUser(bearer) : await supabase.auth.getUser();
  if (error || !data.user) return null;
  const profile = await findProfileForUser(data.user.id);
  if (!profile?.isActive) return null;
  return { user: data.user, profile, mode: bearer ? "bearer" : "cookie" };
}

export function hasRole(identity: RequestIdentity, role: UserRole) {
  return identity.profile.role === role;
}

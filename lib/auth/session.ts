import "server-only";

import { redirect } from "next/navigation";

import { findProfileForUser } from "@/features/auth/profile-service";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentIdentity() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const profile = await findProfileForUser(data.user.id);
  return profile ? { user: data.user, profile } : null;
}

export async function requireAdminPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/login?reason=session-required");
  if (!canAccessAdmin(identity.profile)) redirect("/login?reason=admin-required");
  return identity;
}

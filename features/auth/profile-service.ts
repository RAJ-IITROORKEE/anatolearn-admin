import "server-only";

import type { User } from "@supabase/supabase-js";

import { prisma } from "@/lib/db/prisma";

export async function provisionUserProfile(user: User, fullName?: string) {
  if (!user.email) throw new Error("Authenticated user has no email address.");
  const emailNormalized = user.email.trim().toLowerCase();
  const resolvedName = fullName?.trim() || String(user.user_metadata.full_name ?? "Learner");

  return prisma.profile.upsert({
    where: { id: user.id },
    update: { email: user.email, emailNormalized },
    create: {
      id: user.id,
      fullName: resolvedName,
      email: user.email,
      emailNormalized,
      role: "USER",
    },
  });
}

export async function findProfileForUser(userId: string) {
  return prisma.profile.findUnique({ where: { id: userId } });
}

import "server-only";

import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";

const profileNameSchema = z.string().trim().min(2).max(100);

export async function provisionUserProfile(user: User, fullName?: string) {
  if (!user.email) throw new Error("Authenticated user has no email address.");
  const emailNormalized = user.email.trim().toLowerCase();
  const suppliedName = fullName ?? user.user_metadata.full_name;
  const parsedName = profileNameSchema.safeParse(suppliedName);
  const resolvedName = parsedName.success ? parsedName.data : "Learner";

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

export async function syncProfileEmail(user: { id: string; email?: string | null }) {
  if (!user.email) return;
  await prisma.profile.updateMany({
    where: { id: user.id },
    data: { email: user.email, emailNormalized: user.email.trim().toLowerCase() },
  });
}

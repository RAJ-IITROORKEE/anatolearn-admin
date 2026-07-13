import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

async function main() {
  const [{ prisma }, { getBootstrapEnv }] = await Promise.all([
    import("../lib/db/prisma"),
    import("../lib/env"),
  ]);
  const env = getBootstrapEnv();

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const normalizedEmail = env.ADMIN_BOOTSTRAP_EMAIL.trim().toLowerCase();
  let authUser = null;

  for (let page = 1; page <= 100 && !authUser; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error("Unable to query Supabase Auth users.");
    authUser = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail) ?? null;
    if (data.users.length < 100) break;
  }

  if (!authUser) {
    if (!env.ADMIN_BOOTSTRAP_PASSWORD) {
      throw new Error("ADMIN_BOOTSTRAP_PASSWORD is required when creating the Auth user.");
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: env.ADMIN_BOOTSTRAP_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error("Unable to create the Supabase Auth user.");
    authUser = data.user;
  }

  await prisma.profile.upsert({
    where: { id: authUser.id },
    update: { email: normalizedEmail, emailNormalized: normalizedEmail, role: "ADMIN", isActive: true },
    create: {
      id: authUser.id,
      fullName: String(authUser.user_metadata.full_name ?? "Administrator"),
      email: normalizedEmail,
      emailNormalized: normalizedEmail,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("Bootstrap complete: an active administrator profile is linked to Supabase Auth.");
  console.warn("Rotate any temporary bootstrap password, then remove it from the environment.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Administrator bootstrap failed.");
  process.exitCode = 1;
});

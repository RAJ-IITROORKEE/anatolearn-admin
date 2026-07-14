import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { bootstrapAdmin, runBootstrapAdminCli } from "./bootstrap-admin-service";

loadEnvConfig(process.cwd());

async function main() {
  const { prisma } = await import("../lib/db/prisma");
  const exitCode = await runBootstrapAdminCli({
    execute: async () => {
      const { getBootstrapEnv } = await import("../lib/env");
      const env = getBootstrapEnv();
      const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      return bootstrapAdmin({
        email: env.ADMIN_BOOTSTRAP_EMAIL,
        password: env.ADMIN_BOOTSTRAP_PASSWORD,
        auth: {
          listUsers: async (input) => {
            const { data, error } = await supabase.auth.admin.listUsers(input);
            if (error) throw error;
            return { users: data.users };
          },
          createUser: async ({ email, password, emailConfirm }) => {
            const { data, error } = await supabase.auth.admin.createUser({
              email,
              password,
              email_confirm: emailConfirm,
            });
            if (error || !data.user) throw error ?? new Error("Auth user was not returned.");
            return { user: data.user };
          },
          deleteUser: async (id) => {
            const { error } = await supabase.auth.admin.deleteUser(id);
            if (error) throw error;
          },
        },
        profiles: {
          upsertAdmin: async (profile) => {
            await prisma.profile.upsert({
              where: { id: profile.id },
              update: {
                email: profile.email,
                emailNormalized: profile.emailNormalized,
                role: profile.role,
                isActive: profile.isActive,
              },
              create: profile,
            });
          },
        },
      });
    },
    disconnect: () => prisma.$disconnect(),
    logger: { info: console.log, error: console.error },
  });
  process.exitCode = exitCode;
}

main().catch(() => {
  console.error("Administrator bootstrap failed before database initialization.");
  process.exitCode = 1;
});

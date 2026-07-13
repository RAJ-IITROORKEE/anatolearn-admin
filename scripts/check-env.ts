import { loadEnvConfig } from "@next/env";

import { envCheckSchema } from "../lib/env";

loadEnvConfig(process.cwd());

const result = envCheckSchema.safeParse(process.env);

if (!result.success) {
  const invalidKeys = [
    ...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "environment"))),
  ].sort();

  console.error(`Environment check failed. Missing or invalid: ${invalidKeys.join(", ")}`);
  process.exitCode = 1;
} else {
  const pooledPort = new URL(result.data.DATABASE_URL).port;
  const directPort = new URL(result.data.DIRECT_URL).port;
  const checks = [
    ["pooled database port is 6543", pooledPort === "6543"],
    ["direct/session database port is 5432", directPort === "5432"],
    [
      "Supabase secret uses the modern format",
      result.data.SUPABASE_SECRET_KEY.startsWith("sb_secret_"),
    ],
  ] as const;
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);

  if (failed.length > 0) {
    console.error(`Environment check failed. Review: ${failed.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("Environment check passed; required values and safe shapes are present.");
  }
}

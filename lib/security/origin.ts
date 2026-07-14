import { publicEnvSchema } from "@/lib/env";

export function hasSafeOrigin(headers: Headers) {
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    const appUrl = publicEnvSchema.shape.NEXT_PUBLIC_APP_URL.parse(process.env.NEXT_PUBLIC_APP_URL);
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

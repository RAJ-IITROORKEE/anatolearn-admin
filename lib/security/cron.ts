import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function hasValidCronAuthorization(authorization: string | null, secret: string) {
  const provided = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  return timingSafeEqual(digest(provided), digest(secret));
}

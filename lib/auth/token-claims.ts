type AmrEntry = { method?: unknown };

export function hasRecoveryMethod(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as { amr?: unknown };
    return Array.isArray(claims.amr) && claims.amr.some((entry: AmrEntry) => entry?.method === "recovery");
  } catch {
    return false;
  }
}

export function isAuthProviderUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? Number(error.status) : Number.NaN;
  return !Number.isFinite(status) || status === 0 || status === 429 || status >= 500;
}

type Entry = { count: number; resetsAt: number };

const entries = new Map<string, Entry>();

export function allowRequest(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const current = entries.get(key);
  if (!current || current.resetsAt <= now) {
    entries.set(key, { count: 1, resetsAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function requestClientKey(request: Request, namespace: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${namespace}:${forwarded ?? "unknown"}`;
}

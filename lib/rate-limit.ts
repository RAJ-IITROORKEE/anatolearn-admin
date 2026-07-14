type Entry = { count: number; resetsAt: number };

const entries = new Map<string, Entry>();
export const PROCESS_LOCAL_RATE_LIMIT_MAX_KEYS = 10_000;
const SWEEP_INTERVAL = 256;
let newKeysSinceSweep = 0;

function makeRoom(now: number) {
  for (const [key, entry] of entries) {
    if (entry.resetsAt <= now) entries.delete(key);
  }
  while (entries.size >= PROCESS_LOCAL_RATE_LIMIT_MAX_KEYS) {
    const oldestKey = entries.keys().next().value as string | undefined;
    if (!oldestKey) break;
    entries.delete(oldestKey);
  }
}

// Development fallback only. Production rate limiting requires a shared store.
export function allowRequest(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const current = entries.get(key);
  if (!current || current.resetsAt <= now) {
    if (!current) {
      newKeysSinceSweep += 1;
      if (newKeysSinceSweep >= SWEEP_INTERVAL || entries.size >= PROCESS_LOCAL_RATE_LIMIT_MAX_KEYS) {
        makeRoom(now);
        newKeysSinceSweep = 0;
      }
    }
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

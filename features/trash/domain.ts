export const TRASH_TYPES = [
  "organ-system",
  "topic",
  "content-lesson",
  "flashcard",
  "question",
  "feedback",
  "media-asset",
] as const;

export type TrashType = (typeof TRASH_TYPES)[number];
export type RetentionState = "RESTORABLE" | "EXPIRED";
export type TrashEligibility = "PENDING" | "ELIGIBLE" | "BLOCKED";

export class TrashError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "RESTORE_EXPIRED" | "PARENT_UNAVAILABLE" | "PURGE_BLOCKED",
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const RESTORE_DEADLINE_SQLSTATE = "PZ001";
const RESTORE_DEADLINE_DATABASE_MESSAGE = "Trash retention deadline has expired";

export function isRestoreDeadlineDatabaseError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { message?: unknown; meta?: unknown };
  const meta = value.meta && typeof value.meta === "object"
    ? value.meta as { code?: unknown; message?: unknown }
    : null;
  if (meta?.code === RESTORE_DEADLINE_SQLSTATE) return true;
  const message = typeof value.message === "string" ? value.message : "";
  let metadata = "";
  try { metadata = JSON.stringify(meta); } catch { metadata = ""; }
  return (message.includes(RESTORE_DEADLINE_SQLSTATE) || metadata.includes(RESTORE_DEADLINE_SQLSTATE))
    && (message.includes(RESTORE_DEADLINE_DATABASE_MESSAGE) || metadata.includes(RESTORE_DEADLINE_DATABASE_MESSAGE));
}

export function retentionState(now: Date, purgeAfter: Date): RetentionState {
  return now.getTime() < purgeAfter.getTime() ? "RESTORABLE" : "EXPIRED";
}

export function trashEligibility(now: Date, purgeAfter: Date, blockerCount: number): TrashEligibility {
  if (now.getTime() < purgeAfter.getTime()) return "PENDING";
  return blockerCount > 0 ? "BLOCKED" : "ELIGIBLE";
}

export function blockerSummary(reason: string | null, count: number) {
  if (!reason || count <= 0) return null;
  const boundedReason = reason.length <= 160 ? reason : `${reason.slice(0, 157)}...`;
  return { reason: boundedReason, count: Math.min(Math.max(Math.trunc(count), 0), 9_999) };
}

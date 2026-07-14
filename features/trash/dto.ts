import { blockerSummary, retentionState, trashEligibility, type TrashType } from "./domain";

export type TrashItemRecord = {
  id: string;
  type: TrashType;
  label: string;
  trashedAt: Date;
  purgeAfter: Date;
  nextPurgeAttemptAt: Date;
  blockerReason: string | null;
  blockerCount: number;
};

export function trashItemDto(item: TrashItemRecord, now: Date) {
  return {
    id: item.id,
    type: item.type,
    displayLabel: item.label,
    trashedAt: item.trashedAt.toISOString(),
    purgeAfter: item.purgeAfter.toISOString(),
    nextPurgeAttemptAt: item.nextPurgeAttemptAt.toISOString(),
    retentionState: retentionState(now, item.purgeAfter),
    eligibility: trashEligibility(now, item.purgeAfter, item.blockerCount),
    blocker: blockerSummary(item.blockerReason, item.blockerCount),
  };
}

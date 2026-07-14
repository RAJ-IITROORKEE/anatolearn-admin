import type { AuditAction, FeedbackStatus, Prisma } from "@prisma/client";
import type { AdminFeedbackUpdateInput } from "./schemas";

export class FeedbackError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "FeedbackError";
  }
}

type CurrentFeedback = { status: FeedbackStatus; adminNotes: string | null; reviewedById: string | null };

export function planFeedbackUpdate(current: CurrentFeedback, input: AdminFeedbackUpdateInput, actorId: string, now: Date): {
  changed: boolean;
  action: AuditAction;
  data: Prisma.FeedbackUncheckedUpdateInput;
} {
  if (current.status === "RESOLVED" && input.status && input.status !== "RESOLVED") {
    throw new FeedbackError("INVALID_TRANSITION", "Resolved feedback is terminal.", 409);
  }
  if (current.status === "NEW" && input.status === "RESOLVED") {
    throw new FeedbackError("INVALID_TRANSITION", "Feedback must be reviewed before it can be resolved.", 409);
  }
  const notesChanged = input.adminNotes !== undefined && input.adminNotes !== current.adminNotes;
  let nextStatus: FeedbackStatus = current.status;
  if (input.status) nextStatus = input.status;
  else if (current.status === "NEW" && notesChanged) nextStatus = "REVIEWED";
  const statusChanged = nextStatus !== current.status;
  if (!notesChanged && !statusChanged) return { changed: false, action: "UPDATE", data: {} };

  const data: Prisma.FeedbackUncheckedUpdateInput = {};
  if (notesChanged) data.adminNotes = input.adminNotes;
  if (statusChanged) data.status = nextStatus;
  if (current.status === "NEW" && nextStatus === "REVIEWED") {
    data.reviewedById = actorId;
    data.reviewedAt = now;
  }
  if (current.status === "REVIEWED" && nextStatus === "RESOLVED") {
    data.resolvedById = actorId;
    data.resolvedAt = now;
  }
  const action: AuditAction = nextStatus === "RESOLVED" && statusChanged ? "RESOLVE" : nextStatus === "REVIEWED" && statusChanged ? "REVIEW" : "UPDATE";
  return { changed: true, action, data };
}

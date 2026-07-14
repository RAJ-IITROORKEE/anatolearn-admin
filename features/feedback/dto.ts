type FeedbackValue = {
  id: string; type: string; subject: string; message: string; status: string;
  createdAt: Date; updatedAt: Date;
};

export function learnerFeedbackDto(value: FeedbackValue) {
  return {
    id: value.id, type: value.type, subject: value.subject, message: value.message,
    status: value.status, createdAt: value.createdAt, updatedAt: value.updatedAt,
  };
}

type Person = { id: string; fullName: string; email: string; isActive: boolean };
type AdminFeedbackValue = FeedbackValue & {
  adminNotes: string | null; reviewedAt: Date | null; resolvedAt: Date | null;
  user: Person | null; reviewedBy: Person | null; resolvedBy: Person | null;
};

function personDto(value: Person | null) {
  return value ? { id: value.id, fullName: value.fullName, email: value.email, isActive: value.isActive } : null;
}

export function adminFeedbackDto(value: AdminFeedbackValue) {
  return {
    ...learnerFeedbackDto(value),
    adminNotes: value.adminNotes,
    reviewedAt: value.reviewedAt,
    resolvedAt: value.resolvedAt,
    submitter: personDto(value.user),
    reviewer: personDto(value.reviewedBy),
    resolver: personDto(value.resolvedBy),
  };
}

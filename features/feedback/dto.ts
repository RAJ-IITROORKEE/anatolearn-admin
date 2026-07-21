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

type Person = { id: string; fullName: string; email: string; isActive: boolean; avatarUrl?: string | null; avatarMediaId?: string | null };
type AdminFeedbackValue = FeedbackValue & {
  rating: null | number | string | { toString(): string };
  adminNotes: string | null; reviewedAt: Date | null; resolvedAt: Date | null;
  user: Person | null; reviewedBy: Person | null; resolvedBy: Person | null;
};

function personDto(value: Person | null, avatarUrls: ReadonlyMap<string, string | null>) {
  return value ? { id: value.id, fullName: value.fullName, email: value.email, isActive: value.isActive, avatarUrl: avatarUrls.has(value.id) ? avatarUrls.get(value.id) ?? null : value.avatarUrl ?? null } : null;
}

export function adminFeedbackDto(value: AdminFeedbackValue, avatarUrls: ReadonlyMap<string, string | null> = new Map()) {
  return {
    ...learnerFeedbackDto(value),
    rating: value.rating === null ? null : Number(value.rating.toString()),
    adminNotes: value.adminNotes,
    reviewedAt: value.reviewedAt,
    resolvedAt: value.resolvedAt,
    submitter: personDto(value.user, avatarUrls),
    reviewer: personDto(value.reviewedBy, avatarUrls),
    resolver: personDto(value.resolvedBy, avatarUrls),
  };
}

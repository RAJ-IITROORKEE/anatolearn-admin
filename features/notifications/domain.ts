import type { NotificationStatus, NotificationType } from "@prisma/client";

export class NotificationError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "NotificationError";
  }
}

export function finalCampaignStatus(recipients: Array<{ statuses: string[] }>): NotificationStatus {
  if (!recipients.length) return "FAILED";
  const sent = recipients.filter((recipient) => recipient.statuses.includes("SENT")).length;
  if (sent === recipients.length) return "SENT";
  if (sent > 0) return "PARTIAL";
  return "FAILED";
}

type AuditSource = {
  status: NotificationStatus;
  type: NotificationType;
  targetFilter?: unknown;
  recipientCount?: number;
  title?: string;
  message?: string;
};

export function campaignAuditSnapshot(source: AuditSource) {
  const target = source.targetFilter as { type?: unknown } | undefined;
  return {
    status: source.status,
    type: source.type,
    audienceType: target?.type === "SELECTED_USERS" ? "SELECTED_USERS" : "ALL_ACTIVE_USERS",
    recipientCount: source.recipientCount ?? 0,
  };
}

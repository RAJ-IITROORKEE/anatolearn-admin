export const CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "PROCESSING", "SENT", "PARTIAL", "FAILED", "CANCELLED"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (character) => character.toUpperCase());
}

export function deliveryEvidence(status: string) {
  switch (status) {
    case "TICKETED": return "Accepted by provider; receipt pending";
    case "SENT": return "Delivery receipt confirmed by provider";
    case "FAILED": return "Delivery failed";
    case "CANCELLED": return "Delivery cancelled before provider acceptance";
    default: return "Waiting to be submitted to provider";
  }
}

export function summarizeEvidence(
  recipients: Array<{ readAt: Date | string | null; _count: { deliveries: number } }>,
  deliveries: Array<{ status: string }>,
) {
  return {
    recipients: recipients.length,
    deliveries: recipients.reduce((total, recipient) => total + recipient._count.deliveries, 0),
    receiptConfirmed: deliveries.filter((delivery) => delivery.status === "SENT").length,
    ticketed: deliveries.filter((delivery) => delivery.status === "TICKETED").length,
    failed: deliveries.filter((delivery) => delivery.status === "FAILED").length,
    read: recipients.filter((recipient) => recipient.readAt).length,
  };
}

export function audienceLabel(target: unknown) {
  if (target && typeof target === "object" && "type" in target && target.type === "SELECTED_USERS" && "userIds" in target && Array.isArray(target.userIds)) {
    return `${target.userIds.length} selected active learner${target.userIds.length === 1 ? "" : "s"}`;
  }
  return "All active learners at processing time";
}

export function formatDate(value: Date | string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

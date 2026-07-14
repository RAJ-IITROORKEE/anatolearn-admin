type DeviceTokenRow = { id: string; platform: string; isActive: boolean; lastSeenAt: Date; expoPushToken?: string };
type DeliveryRow = {
  id: string;
  status: string;
  attemptCount: number;
  receiptAttemptCount?: number;
  providerErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  tokenSnapshot?: string;
};

export function deviceTokenDto(row: DeviceTokenRow) {
  return { id: row.id, platform: row.platform, isActive: row.isActive, lastSeenAt: row.lastSeenAt };
}

export function deliveryDto(row: DeliveryRow) {
  return {
    id: row.id,
    status: row.status,
    attemptCount: row.attemptCount,
    receiptAttemptCount: row.receiptAttemptCount ?? 0,
    providerErrorCode: row.providerErrorCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function campaignDto(row: {
  id: string; type: string; title: string; message: string; targetFilter: unknown; scheduledAt: Date | null;
  sentAt: Date | null; status: string; createdAt: Date; updatedAt: Date;
}) {
  return { id: row.id, type: row.type, title: row.title, message: row.message, target: row.targetFilter, scheduledAt: row.scheduledAt, sentAt: row.sentAt, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export function learnerNotificationDto(row: {
  id: string; readAt: Date | null; createdAt: Date;
  campaign: { type: string; title: string; message: string; sentAt: Date | null };
}) {
  return { id: row.id, type: row.campaign.type, title: row.campaign.title, message: row.campaign.message, sentAt: row.campaign.sentAt, readAt: row.readAt, createdAt: row.createdAt };
}

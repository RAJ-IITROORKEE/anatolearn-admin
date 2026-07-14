import "server-only";

import { getCampaignEvidence, getCampaignStatusCounts } from "@/features/notifications/service";
import type { CampaignStatus } from "./presentation";

export async function campaignStatusCounts() {
  return getCampaignStatusCounts() as Promise<Record<CampaignStatus, number>>;
}

export async function campaignEvidence(ids: string[]) {
  return getCampaignEvidence(ids);
}

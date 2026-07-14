import { notFound } from "next/navigation";

import { CampaignDetail } from "@/components/notifications/campaign-detail";
import { campaignEvidence } from "@/components/notifications/notification-data";
import { NotificationError } from "@/features/notifications/domain";
import { getProviderConfig } from "@/features/notifications/provider";
import { uuidSchema } from "@/features/notifications/schemas";
import { getCampaign, listDeliveries, listRecipients } from "@/features/notifications/service";
import { getLearnerPickerOptions, searchActiveLearnerOptions } from "@/features/users/service";
import { searchNotificationLearnersAction } from "../actions";

type SearchParams = { recipientPage?: string; deliveryPage?: string };

export default async function NotificationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const parsed = uuidSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const query = await searchParams;
  const recipientPage = Math.max(1, Number.parseInt(query.recipientPage ?? "1", 10) || 1);
  const deliveryPage = Math.max(1, Number.parseInt(query.deliveryPage ?? "1", 10) || 1);
  let campaign;
  try { campaign = await getCampaign(parsed.data); }
  catch (error) { if (error instanceof NotificationError && error.status === 404) notFound(); throw error; }
  const selectedIds = campaign.target && typeof campaign.target === "object" && "type" in campaign.target && campaign.target.type === "SELECTED_USERS" && "userIds" in campaign.target && Array.isArray(campaign.target.userIds) ? campaign.target.userIds.filter((id): id is string => typeof id === "string") : [];
  const [recipients, deliveries, evidenceById, learners, selectedLearners] = await Promise.all([
    listRecipients(parsed.data, { page: recipientPage, pageSize: 20 }),
    listDeliveries(parsed.data, { page: deliveryPage, pageSize: 20 }),
    campaignEvidence([parsed.data]),
    campaign.status === "DRAFT" ? searchActiveLearnerOptions({ page: 1 }) : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
    campaign.status === "DRAFT" ? getLearnerPickerOptions(selectedIds) : Promise.resolve([]),
  ]);
  return <CampaignDetail campaign={campaign} deliveries={deliveries} evidence={evidenceById[parsed.data]} learners={learners} providerReady={getProviderConfig().ready} recipients={recipients} searchAction={searchNotificationLearnersAction} selectedLearners={selectedLearners} />;
}

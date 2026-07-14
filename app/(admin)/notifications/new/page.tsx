import { PageHeader } from "@/components/app-shell/page-header";
import { CampaignEditor } from "@/components/notifications/campaign-editor";
import { getProviderConfig } from "@/features/notifications/provider";
import { searchActiveLearnerOptions } from "@/features/users/service";
import { createCampaignAction, searchNotificationLearnersAction } from "../actions";

export default async function NewNotificationPage() {
  const [learners, provider] = await Promise.all([
    searchActiveLearnerOptions({ page: 1 }),
    Promise.resolve(getProviderConfig()),
  ]);
  return <><PageHeader description="Compose a concise campaign, choose an allowlisted audience, preview it, then save, schedule, or queue provider processing." eyebrow="Notifications" title="Create notification" /><CampaignEditor action={createCampaignAction} learners={learners} providerReady={provider.ready} searchAction={searchNotificationLearnersAction} /></>;
}

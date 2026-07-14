import { Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { CampaignList } from "@/components/notifications/campaign-list";
import { campaignEvidence, campaignStatusCounts } from "@/components/notifications/notification-data";
import { CAMPAIGN_STATUSES, type CampaignStatus } from "@/components/notifications/presentation";
import { StatusTabs } from "@/components/notifications/status-tabs";
import { fieldClass } from "@/components/phase3/admin-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { StatusAlert } from "@/components/shared/status-alert";
import { buttonVariants } from "@/components/ui/button";
import { getProviderConfig } from "@/features/notifications/provider";
import { listCampaigns } from "@/features/notifications/service";

type SearchParams = { page?: string; pageSize?: string; status?: string };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = [10, 20, 50].includes(Number(query.pageSize)) ? Number(query.pageSize) : 20;
  const status = CAMPAIGN_STATUSES.includes(query.status as CampaignStatus) ? query.status as CampaignStatus : undefined;
  const [result, counts] = await Promise.all([listCampaigns({ page, pageSize, status }), campaignStatusCounts()]);
  const summaries = await campaignEvidence(result.items.map((campaign) => campaign.id));
  const provider = getProviderConfig();

  return <>
    <PageHeader action={<Link className={buttonVariants()} href="/notifications/new"><Plus aria-hidden="true" className="size-4" />Create notification</Link>} description="Draft, schedule, and inspect campaigns using provider receipts and in-app read evidence." eyebrow="Community" title="Notifications" />
    <div className="mb-5"><StatusAlert variant={provider.ready ? "success" : "warning"}>{provider.ready ? "Push provider is ready. Send now queues processing; delivery remains unconfirmed until receipts arrive." : provider.enabled ? "Push sending is enabled but provider credentials are incomplete. Send now is disabled." : "Push sending is disabled. You can save drafts and schedules, but campaigns will not be submitted until the provider is configured."}</StatusAlert></div>
    <StatusTabs counts={counts} current={status} />
    <form className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-end" method="get">
      {status && <input name="status" type="hidden" value={status} />}
      <label className="grid gap-2 text-sm font-semibold text-body">Rows per page<select className={fieldClass} defaultValue={pageSize} name="pageSize"><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
      <button className={buttonVariants({ variant: "outline" })} type="submit">Apply filters</button>
      {(status || pageSize !== 20) && <Link className={buttonVariants({ variant: "ghost" })} href="/notifications">Clear filters</Link>}
    </form>
    {result.items.length ? <><CampaignList campaigns={result.items} evidence={summaries} /><div className="mt-5"><Pagination page={result.pagination.page} pageCount={Math.max(1, result.pagination.totalPages)} pathname="/notifications" /></div></> : <EmptyState action={{ href: "/notifications/new", label: "Create notification" }} description={status ? "No campaigns have this status." : "Create a draft campaign to begin."} title="No notification campaigns" />}
  </>;
}

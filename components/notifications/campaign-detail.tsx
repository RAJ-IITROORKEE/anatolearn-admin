import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { StatusBadge, panelClass } from "@/components/phase3/admin-ui";
import { StatusAlert } from "@/components/shared/status-alert";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cancelCampaignAction, sendCampaignAction, updateCampaignAction } from "@/app/(admin)/notifications/actions";
import { CampaignAction } from "./campaign-actions";
import { CampaignEditor } from "./campaign-editor";
import type { LearnerOption, LearnerSearchResult } from "./learner-picker";
import { audienceLabel, deliveryEvidence, formatDate, humanize } from "./presentation";

type Campaign = { id: string; type: string; title: string; message: string; target: unknown; status: string; scheduledAt: Date | string | null; sentAt: Date | string | null; createdAt: Date | string; updatedAt: Date | string };
type Recipient = { id: string; userId: string; readAt: Date | string | null; createdAt: Date | string; _count: { deliveries: number } };
type Delivery = { id: string; status: string; attemptCount: number; receiptAttemptCount: number; providerErrorCode: string | null; createdAt: Date | string; updatedAt: Date | string };
type Evidence = { recipients: number; deliveries: number; pending: number; receiptConfirmed: number; ticketed: number; failed: number; cancelled: number; read: number };
type PageData<T> = { items: T[]; pagination: { page: number; totalPages: number; total: number } };

function MiniPagination({ campaignId, current, kind, pages }: { campaignId: string; current: number; kind: "recipientPage" | "deliveryPage"; pages: number }) {
  if (pages <= 1) return null;
  const link = (page: number) => `/notifications/${campaignId}?${kind}=${page}`;
  return <nav aria-label={`${kind === "recipientPage" ? "Recipient" : "Delivery"} pagination`} className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm"><span className="text-muted">Page {current} of {pages}</span><div className="flex gap-2"><Link aria-disabled={current <= 1} className={cn(buttonVariants({ variant: "outline", size: "sm" }), current <= 1 && "pointer-events-none opacity-50")} href={link(Math.max(1, current - 1))}>Previous</Link><Link aria-disabled={current >= pages} className={cn(buttonVariants({ variant: "outline", size: "sm" }), current >= pages && "pointer-events-none opacity-50")} href={link(Math.min(pages, current + 1))}>Next</Link></div></nav>;
}

export function CampaignDetail({ campaign, deliveries, evidence, learners, providerReady, recipients, searchAction, selectedLearners }: {
  campaign: Campaign; deliveries: PageData<Delivery>; evidence: Evidence; learners: LearnerSearchResult; providerReady: boolean; recipients: PageData<Recipient>;
  searchAction: (query: string, page: number) => Promise<LearnerSearchResult>; selectedLearners: LearnerOption[];
}) {
  const terminal = ["SENT", "PARTIAL", "FAILED", "CANCELLED"].includes(campaign.status);
  return <>
    <PageHeader action={<div className="flex flex-wrap items-center gap-2"><StatusBadge status={campaign.status} />{campaign.status === "DRAFT" && <CampaignAction action={sendCampaignAction.bind(null, campaign.id)} confirmLabel="Queue campaign" description="This queues provider processing. A provider ticket is not a delivery receipt." disabled={!providerReady} title="Send this campaign now?">Send now</CampaignAction>}{["DRAFT", "SCHEDULED"].includes(campaign.status) && <CampaignAction action={cancelCampaignAction.bind(null, campaign.id)} confirmLabel="Cancel campaign" description="Cancellation is terminal and cannot be undone." title="Cancel this campaign?">Cancel campaign</CampaignAction>}</div>} description="Review campaign scope, scheduling, recipient reads, and provider evidence without exposing device tokens." eyebrow="Notifications" title={campaign.title} />
    {!providerReady && <div className="mb-5"><StatusAlert variant="warning">Provider delivery is unavailable. Existing evidence remains visible, but send now is disabled.</StatusAlert></div>}
    {campaign.status === "DRAFT" ? <CampaignEditor action={updateCampaignAction.bind(null, campaign.id)} campaign={campaign} learners={learners} providerReady={providerReady} searchAction={searchAction} selectedLearners={selectedLearners} /> : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.45fr)]">
      <section className={panelClass}><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-primary">{humanize(campaign.type)}</p>{terminal && <span className="text-xs font-semibold text-muted">Immutable terminal record</span>}</div><h2 className="mt-4 text-xl font-bold text-foreground">{campaign.title}</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-body">{campaign.message}</p></section>
      <aside className={panelClass}><h2 className="font-bold text-foreground">Audience and schedule</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-muted">Audience</dt><dd className="mt-1 font-medium text-body">{audienceLabel(campaign.target)}</dd></div><div><dt className="text-muted">Scheduled</dt><dd className="mt-1 font-medium text-body">{formatDate(campaign.scheduledAt)}</dd></div><div><dt className="text-muted">Provider-finalized</dt><dd className="mt-1 font-medium text-body">{formatDate(campaign.sentAt)}</dd></div></dl>{campaign.status === "SCHEDULED" && <p className="mt-4 text-xs leading-5 text-muted">The backend locks scheduled campaign content. Cancel remains available; changing the timestamp requires a new draft.</p>}</aside>
    </div>}

    <section className="mt-6" aria-labelledby="outcomes-heading"><h2 className="text-xl font-bold text-foreground" id="outcomes-heading">Aggregate outcomes</h2><p className="mt-1 text-sm text-muted">Provider evidence and in-app reads are separate signals. Neither proves a notification was physically displayed.</p><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">{[
      ["Recipients", evidence.recipients], ["Delivery records", evidence.deliveries], ["Provider-ticketed", evidence.ticketed], ["Receipt-confirmed", evidence.receiptConfirmed], ["Failed", evidence.failed], ["Read in app", evidence.read],
      ["Pending", evidence.pending], ["Cancelled deliveries", evidence.cancelled],
    ].map(([label, count]) => <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm" key={String(label)}><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{count}</p></div>)}</div></section>

    <div className="mt-6 grid gap-5 xl:grid-cols-2">
      <section className={panelClass}><h2 className="font-bold text-foreground">Recipient evidence</h2><p className="mt-1 text-sm text-muted">Read means the learner opened this item in the application.</p>{recipients.items.length ? <div className="mt-4 grid gap-2">{recipients.items.map((recipient, index) => <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-subtle p-3 text-sm" key={recipient.id}><div><p className="font-semibold text-foreground">Recipient {(recipients.pagination.page - 1) * 20 + index + 1}</p><p className="text-xs text-muted">{recipient._count.deliveries} delivery record{recipient._count.deliveries === 1 ? "" : "s"}</p></div><span className={recipient.readAt ? "font-semibold text-success" : "text-muted"}>{recipient.readAt ? `Read ${formatDate(recipient.readAt)}` : "Not read in app"}</span></div>)}</div> : <p className="mt-4 rounded-xl bg-subtle p-4 text-sm text-muted">No recipients have been materialized.</p>}<MiniPagination campaignId={campaign.id} current={recipients.pagination.page} kind="recipientPage" pages={Math.max(1, recipients.pagination.totalPages)} /></section>
      <section className={panelClass}><h2 className="font-bold text-foreground">Delivery evidence</h2><p className="mt-1 text-sm text-muted">No push tokens or provider receipt identifiers are shown.</p>{deliveries.items.length ? <div className="mt-4 grid gap-2">{deliveries.items.map((delivery) => <div className="rounded-xl border border-border bg-subtle p-3 text-sm" key={delivery.id}><div className="flex items-center justify-between gap-3"><span className="font-semibold text-foreground">{deliveryEvidence(delivery.status)}</span><StatusBadge status={delivery.status} /></div><p className="mt-2 text-xs text-muted">Provider attempts: {delivery.attemptCount}; receipt checks: {delivery.receiptAttemptCount}{delivery.providerErrorCode ? `; failure code: ${delivery.providerErrorCode}` : ""}</p></div>)}</div> : <p className="mt-4 rounded-xl bg-subtle p-4 text-sm text-muted">No delivery attempts have been recorded.</p>}<MiniPagination campaignId={campaign.id} current={deliveries.pagination.page} kind="deliveryPage" pages={Math.max(1, deliveries.pagination.totalPages)} /></section>
    </div>
  </>;
}

import Link from "next/link";

import { StatusBadge } from "@/components/phase3/admin-ui";
import { audienceLabel, formatDate, humanize } from "./presentation";

type Evidence = { recipients: number; deliveries: number; pending: number; receiptConfirmed: number; ticketed: number; failed: number; cancelled: number; read: number };
type Campaign = {
  id: string; type: string; title: string; status: string; target: unknown;
  scheduledAt: Date | string | null; sentAt: Date | string | null; createdAt: Date | string;
};

function EvidenceSummary({ evidence }: { evidence: Evidence }) {
  return <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 break-words text-xs text-muted">
    <span>{evidence.recipients} recipients</span><span>{evidence.ticketed} provider-ticketed</span>
    <span>{evidence.receiptConfirmed} receipt-confirmed</span><span>{evidence.pending} pending</span><span>{evidence.failed} failed</span><span>{evidence.cancelled} cancelled</span><span>{evidence.read} read in app</span>
  </div>;
}

export function CampaignList({ campaigns, evidence }: { campaigns: Campaign[]; evidence: Record<string, Evidence> }) {
  return <>
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm lg:block">
      <table className="w-full min-w-[900px] text-left text-sm">
        <caption className="sr-only">Notification campaigns</caption>
        <thead className="bg-subtle text-xs text-muted"><tr><th className="px-5 py-3 font-semibold" scope="col">Campaign</th><th className="px-4 py-3 font-semibold" scope="col">Status</th><th className="px-4 py-3 font-semibold" scope="col">Audience</th><th className="px-4 py-3 font-semibold" scope="col">Evidence</th><th className="px-5 py-3 font-semibold" scope="col">Timing</th></tr></thead>
        <tbody className="divide-y divide-border">{campaigns.map((campaign) => <tr className="align-top hover:bg-subtle/60" key={campaign.id}>
          <th className="max-w-72 break-words px-5 py-4 text-left font-normal" scope="row"><Link className="font-bold text-foreground hover:text-primary" href={`/notifications/${campaign.id}`}>{campaign.title}</Link><p className="mt-1 text-xs text-muted">{humanize(campaign.type)}</p></th>
          <td className="px-4 py-4"><StatusBadge status={campaign.status} /></td>
          <td className="max-w-56 px-4 py-4 text-body">{audienceLabel(campaign.target)}</td>
          <td className="max-w-64 px-4 py-4"><EvidenceSummary evidence={evidence[campaign.id]} /></td>
          <td className="px-5 py-4 text-xs text-muted">{campaign.scheduledAt ? <>Scheduled<br /><span className="text-body">{formatDate(campaign.scheduledAt)}</span></> : <>Created<br /><span className="text-body">{formatDate(campaign.createdAt)}</span></>}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="grid gap-3 lg:hidden">{campaigns.map((campaign) => <article className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm" key={campaign.id}>
      <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><Link className="break-words font-bold text-foreground" href={`/notifications/${campaign.id}`}>{campaign.title}</Link><p className="mt-1 text-xs text-muted">{humanize(campaign.type)}</p></div><StatusBadge status={campaign.status} /></div>
      <p className="mt-3 text-sm text-body">{audienceLabel(campaign.target)}</p><div className="mt-3"><EvidenceSummary evidence={evidence[campaign.id]} /></div><p className="mt-3 border-t border-border pt-3 text-xs text-muted">{campaign.scheduledAt ? "Scheduled " : "Created "}{formatDate(campaign.scheduledAt ?? campaign.createdAt)}</p>
    </article>)}</div>
  </>;
}

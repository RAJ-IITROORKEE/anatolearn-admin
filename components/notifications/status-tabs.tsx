import Link from "next/link";

import { cn } from "@/lib/utils";
import { CAMPAIGN_STATUSES, humanize, type CampaignStatus } from "./presentation";

export function StatusTabs({ counts, current }: { counts: Record<CampaignStatus, number>; current?: CampaignStatus }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return <nav aria-label="Campaign status" className="mb-5 overflow-x-auto"><div className="flex min-w-max gap-2 rounded-2xl border border-border bg-surface p-2">
    <Link aria-current={!current ? "page" : undefined} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", !current ? "bg-primary-soft text-primary" : "text-body hover:bg-subtle")} href="/notifications">All <span className="ml-1 tabular-nums">{total}</span></Link>
    {CAMPAIGN_STATUSES.map((status) => <Link aria-current={current === status ? "page" : undefined} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", current === status ? "bg-primary-soft text-primary" : "text-body hover:bg-subtle")} href={`/notifications?status=${status}`} key={status}>{humanize(status)} <span className="ml-1 tabular-nums">{counts[status]}</span></Link>)}
  </div></nav>;
}

import Link from "next/link";

import { cn } from "@/lib/utils";
import type { FeedbackFilterValues, FeedbackTab } from "./filters";

export function FeedbackTabs({ counts, values }: { counts: Record<FeedbackTab, number>; values: FeedbackFilterValues }) {
  const tabs: Array<{ key: FeedbackTab; label: string }> = [{ key: "all", label: "All" }, { key: "new", label: "New" }, { key: "reviewed", label: "Reviewed" }, { key: "resolved", label: "Resolved" }];
  const href = (tab: FeedbackTab) => {
    const query = new URLSearchParams();
    if (tab !== "all") query.set("tab", tab);
    for (const [key, value] of Object.entries(values)) if (key !== "tab" && value) query.set(key, value);
    const text = query.toString();
    return text ? `/feedback?${text}` : "/feedback";
  };
  return <nav aria-label="Feedback status" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
    {tabs.map((tab) => <Link aria-current={values.tab === tab.key ? "page" : undefined} className={cn("whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold text-muted", values.tab === tab.key ? "border-primary text-primary" : "border-transparent hover:text-foreground")} href={href(tab.key)} key={tab.key}>{tab.label} <span className="ml-1 rounded-full bg-subtle px-2 py-0.5 tabular-nums text-xs">{counts[tab.key]}</span></Link>)}
  </nav>;
}

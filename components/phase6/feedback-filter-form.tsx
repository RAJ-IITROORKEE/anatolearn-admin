import { Search } from "lucide-react";
import Link from "next/link";

import { fieldClass, labelClass } from "@/components/phase3/admin-ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FeedbackFilterValues } from "./filters";

export function FeedbackFilterForm({ hasFilters, values }: { hasFilters: boolean; values: FeedbackFilterValues }) {
  return <form className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm" method="get">
    {values.tab !== "all" && <input name="tab" type="hidden" value={values.tab} />}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className={cn(labelClass, "md:col-span-2")}>Subject, message, or user<span className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" /><input className={cn(fieldClass, "pl-9")} defaultValue={values.q} name="q" placeholder="Search feedback" type="search" /></span></label>
      <label className={labelClass}>Feedback type<select className={fieldClass} defaultValue={values.type} name="type"><option value="">All types</option><option value="GENERAL">General</option><option value="BUG_REPORT">Bug report</option><option value="QUESTION_REQUEST">Question request</option><option value="IMPROVEMENT">Improvement</option></select></label>
      <div className="grid grid-cols-2 gap-3"><label className={labelClass}>Sort by<select className={fieldClass} defaultValue={values.sortBy} name="sortBy"><option value="createdAt">Submitted</option><option value="status">Status</option><option value="type">Type</option></select></label><label className={labelClass}>Order<select className={fieldClass} defaultValue={values.sortOrder} name="sortOrder"><option value="desc">Descending</option><option value="asc">Ascending</option></select></label></div>
      <label className={labelClass}>Submitted from<input className={fieldClass} defaultValue={values.createdFrom} name="createdFrom" type="date" /></label>
      <label className={labelClass}>Submitted through<input className={fieldClass} defaultValue={values.createdTo} name="createdTo" type="date" /></label>
    </div>
    <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">{hasFilters && <Link className={buttonVariants({ variant: "ghost" })} href={values.tab === "all" ? "/feedback" : `/feedback?tab=${values.tab}`}>Clear filters</Link>}<button className={buttonVariants({ variant: "outline" })} type="submit">Apply filters</button></div>
  </form>;
}

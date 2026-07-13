import { Search } from "lucide-react";
import Link from "next/link";

import { fieldClass, labelClass } from "@/components/phase3/admin-ui";
import { buttonVariants } from "@/components/ui/button";
import type { AdminSystem } from "@/components/phase3/data";
import { cn } from "@/lib/utils";
import type { AttemptFilterValues } from "./attempt-filters";

export function AttemptFilterForm({ hasFilters, systems, values }: { hasFilters: boolean; systems: AdminSystem[]; values: AttemptFilterValues }) {
  return (
    <form className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm" method="get">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className={cn(labelClass, "md:col-span-2")}>
          User name or email
          <span className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" />
            <input className={cn(fieldClass, "pl-9")} defaultValue={values.q} name="q" placeholder="Search learners" type="search" />
          </span>
        </label>
        <label className={labelClass}>Assessment type
          <select className={fieldClass} defaultValue={values.assessmentType} name="assessmentType">
            <option value="">All types</option><option value="QUIZ">Quiz</option><option value="TEST">Test</option>
          </select>
        </label>
        <label className={labelClass}>Status
          <select className={fieldClass} defaultValue={values.status} name="status">
            <option value="">All statuses</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="AUTO_SUBMITTED">Auto-submitted</option><option value="ABANDONED">Abandoned</option>
          </select>
        </label>
        <label className={labelClass}>Organ system
          <select className={fieldClass} defaultValue={values.organSystemId} name="organSystemId">
            <option value="">All organ systems</option>
            {systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
          </select>
        </label>
        <label className={labelClass}>Started from
          <input className={fieldClass} defaultValue={values.from} name="from" type="date" />
        </label>
        <label className={labelClass}>Started through
          <input className={fieldClass} defaultValue={values.to} name="to" type="date" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>Sort by
            <select className={fieldClass} defaultValue={values.sortBy} name="sortBy">
              <option value="startedAt">Started</option><option value="completedAt">Completed</option><option value="scorePercentage">Score</option><option value="durationSeconds">Duration</option>
            </select>
          </label>
          <label className={labelClass}>Order
            <select className={fieldClass} defaultValue={values.sortOrder} name="sortOrder">
              <option value="desc">Descending</option><option value="asc">Ascending</option>
            </select>
          </label>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        {hasFilters && <Link className={buttonVariants({ variant: "ghost" })} href="/attempts">Clear filters</Link>}
        <button className={buttonVariants({ variant: "outline" })} type="submit">Apply filters</button>
      </div>
    </form>
  );
}

import { Search } from "lucide-react";
import Link from "next/link";

import { fieldClass, labelClass } from "@/components/phase3/admin-ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserFilterValues } from "./filters";

export function UserFilterForm({ hasFilters, values }: { hasFilters: boolean; values: UserFilterValues }) {
  return <form className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm" method="get">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className={cn(labelClass, "md:col-span-2")}>
        Name or email
        <span className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" /><input className={cn(fieldClass, "pl-9")} defaultValue={values.q} name="q" placeholder="Search learners" type="search" /></span>
      </label>
      <label className={labelClass}>Account status<select className={fieldClass} defaultValue={values.isActive} name="isActive"><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>Sort by<select className={fieldClass} defaultValue={values.sortBy} name="sortBy"><option value="createdAt">Joined</option><option value="lastLoginAt">Last login</option><option value="fullName">Name</option><option value="email">Email</option></select></label>
        <label className={labelClass}>Order<select className={fieldClass} defaultValue={values.sortOrder} name="sortOrder"><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
      </div>
      <label className={labelClass}>Joined from<input className={fieldClass} defaultValue={values.createdFrom} name="createdFrom" type="date" /></label>
      <label className={labelClass}>Joined through<input className={fieldClass} defaultValue={values.createdTo} name="createdTo" type="date" /></label>
    </div>
    <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">{hasFilters && <Link className={buttonVariants({ variant: "ghost" })} href="/users">Clear filters</Link>}<button className={buttonVariants({ variant: "outline" })} type="submit">Apply filters</button></div>
  </form>;
}

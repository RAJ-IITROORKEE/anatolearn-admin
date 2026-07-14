import { Activity, CalendarPlus, UserRoundCheck, UserRoundX } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/app-shell/page-header";
import { MetricCard } from "@/components/assessments/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { parseUserFilters, type Phase6SearchParams } from "@/components/phase6/filters";
import { UserFilterForm } from "@/components/phase6/user-filter-form";
import { UserList } from "@/components/phase6/user-list";
import { listLearners } from "@/features/users/service";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Phase6SearchParams> }) {
  const filters = parseUserFilters(await searchParams);
  const result = await listLearners(filters.input);
  const cards = [
    { icon: Activity, label: "Total learners", value: result.summary.total, detail: "Learner accounts only" },
    { icon: UserRoundCheck, label: "Active", value: result.summary.active, detail: "Can access learning content" },
    { icon: UserRoundX, label: "Inactive", value: result.summary.inactive, detail: "Access currently disabled" },
    { icon: CalendarPlus, label: "Joined in 30 days", value: result.summary.joined30Days, detail: "Recent registrations" },
  ];
  return <>
    <PageHeader description="Review learner access and learning activity without deleting history." eyebrow="Community" title="Users" />
    <section aria-labelledby="user-summary"><h2 className="sr-only" id="user-summary">User summary</h2><div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <MetricCard {...card} key={card.label} />)}</div></section>
    <UserFilterForm hasFilters={filters.hasFilters} values={filters.values} />
    {result.items.length ? <><UserList users={result.items} /><div className="mt-5"><Pagination page={result.pagination.page} pageCount={Math.max(1, result.pagination.totalPages)} pathname="/users" /></div></> : <EmptyState action={filters.hasFilters ? { href: "/users", label: "Clear filters" } : undefined} description={filters.hasFilters ? "No learners match the current filters." : "Learner accounts will appear after users register."} title={filters.hasFilters ? "No matching users" : "No users yet"} />}
  </>;
}

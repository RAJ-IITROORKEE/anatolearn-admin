import { PageHeader } from "@/components/app-shell/page-header";
import { FeedbackFilterForm } from "@/components/phase6/feedback-filter-form";
import { FeedbackList } from "@/components/phase6/feedback-list";
import { FeedbackTabs } from "@/components/phase6/feedback-tabs";
import { parseFeedbackFilters, type Phase6SearchParams } from "@/components/phase6/filters";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { listAdminFeedback } from "@/features/feedback/service";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Phase6SearchParams> }) {
  const filters = parseFeedbackFilters(await searchParams);
  const countInput = { ...filters.input, page: 1, pageSize: 1, status: undefined };
  const [result, newResult, reviewedResult, resolvedResult] = await Promise.all([
    listAdminFeedback(filters.input),
    listAdminFeedback({ ...countInput, status: "NEW" }),
    listAdminFeedback({ ...countInput, status: "REVIEWED" }),
    listAdminFeedback({ ...countInput, status: "RESOLVED" }),
  ]);
  const counts = { new: newResult.pagination.total, reviewed: reviewedResult.pagination.total, resolved: resolvedResult.pagination.total, all: newResult.pagination.total + reviewedResult.pagination.total + resolvedResult.pagination.total };
  return <>
    <PageHeader description="Triage learner reports, preserve internal context, and move each item through review." eyebrow="Community" title="Feedback" />
    <FeedbackTabs counts={counts} values={filters.values} />
    <FeedbackFilterForm hasFilters={filters.hasFilters} values={filters.values} />
    {result.items.length ? <><FeedbackList items={result.items} /><div className="mt-5"><Pagination page={result.pagination.page} pageCount={Math.max(1, result.pagination.totalPages)} pathname="/feedback" /></div></> : <EmptyState action={filters.hasFilters ? { href: filters.values.tab === "all" ? "/feedback" : `/feedback?tab=${filters.values.tab}`, label: "Clear filters" } : undefined} description={filters.hasFilters ? "No feedback matches the current filters." : filters.values.tab === "all" ? "Learner feedback will appear here after submission." : `There is no ${filters.values.tab} feedback.`} title={filters.hasFilters ? "No matching feedback" : "No feedback here"} />}
  </>;
}

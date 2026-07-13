import { PageHeader } from "@/components/app-shell/page-header";
import { AttemptFilterForm } from "@/components/assessments/attempt-filter-form";
import { parseAttemptFilters, type AttemptSearchParams } from "@/components/assessments/attempt-filters";
import { AttemptList } from "@/components/assessments/attempt-list";
import { listAdmin } from "@/components/phase3/data";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { getAdminAttemptLabels } from "@/features/assessments/admin-label-service";
import { listAdminAttempts } from "@/features/assessments/admin-service";

export default async function AttemptsPage({ searchParams }: { searchParams: Promise<AttemptSearchParams> }) {
  const filters = parseAttemptFilters(await searchParams);
  const result = await listAdminAttempts(filters.input);
  const [systems, labels] = await Promise.all([
    listAdmin("organSystem", { page: 1, pageSize: 100, sortBy: "name", sortOrder: "asc" }),
    getAdminAttemptLabels({
      organSystemIds: result.items.map((attempt) => attempt.organSystemId),
      topicIds: result.items.flatMap((attempt) => attempt.topicIds),
    }),
  ]);

  return (
    <>
      <PageHeader description="Review learner quiz and test history without changing attempts or results." eyebrow="Assessments" title="Attempts" />
      <AttemptFilterForm hasFilters={filters.hasFilters} systems={systems.items} values={filters.values} />
      {result.items.length ? <>
        <AttemptList attempts={result.items} systemLabels={labels.systemLabels} topicLabels={labels.topicLabels} />
        <div className="mt-5"><Pagination page={result.pagination.page} pageCount={Math.max(1, result.pagination.totalPages)} pathname="/attempts" /></div>
      </> : <EmptyState action={filters.hasFilters ? { href: "/attempts", label: "Clear filters" } : undefined} description={filters.hasFilters ? "No attempts match the current filters." : "Learner attempts will appear here after an assessment is started."} title="No attempts found" />}
    </>
  );
}

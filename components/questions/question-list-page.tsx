import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { QuestionList } from "@/components/questions/question-list";
import { FilterBar, fieldClass } from "@/components/phase3/admin-ui";
import { listAdmin } from "@/components/phase3/data";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { buttonVariants } from "@/components/ui/button";
import { listQuestions } from "@/features/questions/service";
import { questionListSchema } from "@/features/questions/schemas";
import { cn } from "@/lib/utils";
import { bulkQuestionStatusAction, trashQuestionAction } from "@/app/(admin)/phase4-actions";

type AssessmentType = "QUIZ" | "TEST";
type Params = Record<string, string | string[] | undefined>;
const scalar = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

export async function QuestionListPage({ assessmentType, searchParams }: { assessmentType: AssessmentType; searchParams: Promise<Params> }) {
  const params = await searchParams;
  const parsed = questionListSchema.safeParse({
    page: scalar(params.page), pageSize: 15, q: scalar(params.q), assessmentType,
    topicId: scalar(params.topicId), difficulty: scalar(params.difficulty), status: scalar(params.status),
    isActive: scalar(params.isActive), conceptTag: scalar(params.conceptTag), sortBy: "updatedAt", sortOrder: "desc",
  });
  const input = parsed.success ? parsed.data : questionListSchema.parse({ pageSize: 15, assessmentType, sortBy: "updatedAt", sortOrder: "desc" });
  const [result, topics] = await Promise.all([
    listQuestions(input),
    listAdmin("topic", { page: 1, pageSize: 100, sortBy: "title", sortOrder: "asc" }),
  ]);
  const quiz = assessmentType === "QUIZ";
  const base = `/questions/${assessmentType.toLowerCase()}`;

  return <>
    <PageHeader
      action={<Link className={cn(buttonVariants(), quiz ? "bg-quiz hover:bg-quiz/90" : "bg-test hover:bg-test/90")} href={`${base}/new`}><Plus className="size-4" />Add {quiz ? "quiz" : "test"} question</Link>}
      description={`Create, review, and publish ${quiz ? "untimed quiz" : "timed test"} questions with atomic answer options.`}
      eyebrow={quiz ? "Quiz assessment" : "Test assessment"}
      title={`${quiz ? "Quiz" : "Test"} questions`}
    />
    <div className={cn("mb-5 rounded-r-xl border-l-4 p-3 text-sm font-medium", quiz ? "border-quiz bg-quiz-soft text-quiz" : "border-test bg-test-soft text-test")}>{quiz ? "Quiz" : "Test"} identity is shown with both text and color throughout this workspace.</div>
    <FilterBar defaultValue={input.q} placeholder={`Search ${quiz ? "quiz" : "test"} questions`}>
      <select aria-label="Topic" className={fieldClass} defaultValue={input.topicId ?? ""} name="topicId"><option value="">All topics</option>{topics.items.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
      <select aria-label="Status" className={fieldClass} defaultValue={input.status ?? ""} name="status"><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select>
      <select aria-label="Difficulty" className={fieldClass} defaultValue={input.difficulty ?? ""} name="difficulty"><option value="">All difficulties</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select>
      <select aria-label="Activity" className={fieldClass} defaultValue={input.isActive === undefined ? "" : String(input.isActive)} name="isActive"><option value="">Any activity</option><option value="true">Active</option><option value="false">Inactive</option></select>
    </FilterBar>
    {result.items.length ? <><QuestionList assessmentType={assessmentType} bulkAction={bulkQuestionStatusAction} items={result.items} page={result.pagination.page} pageSize={result.pagination.pageSize} trashAction={trashQuestionAction.bind(null, base)} /><Pagination page={result.pagination.page} pageCount={Math.max(1, result.pagination.totalPages)} pathname={base} /></> : <EmptyState actionHref={`${base}/new`} actionLabel={`Add ${quiz ? "quiz" : "test"} question`} description="Create a question or change the current filters." title={`No ${quiz ? "quiz" : "test"} questions found`} />}
  </>;
}

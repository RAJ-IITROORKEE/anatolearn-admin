import Link from "next/link";
import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/app-shell/page-header";
import { FlashcardList } from "@/components/flashcards/flashcard-list";
import { FilterBar, fieldClass } from "@/components/phase3/admin-ui";
import { listAdmin } from "@/components/phase3/data";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { buttonVariants } from "@/components/ui/button";
import { listFlashcards } from "@/components/flashcards/data";
import { flashcardListQuerySchema } from "@/features/flashcards/schemas";
import { cn } from "@/lib/utils";
import { bulkFlashcardStatusAction, trashFlashcardAction } from "../phase4-actions";

export const metadata: Metadata = { title: "Flashcards" };
type Params = Record<string, string | string[] | undefined>;
const scalar = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

export default async function FlashcardsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const parsed = flashcardListQuerySchema.safeParse({ page: scalar(params.page), pageSize: 15, q: scalar(params.q), status: scalar(params.status), difficulty: scalar(params.difficulty), topicId: scalar(params.topicId), sortBy: "updatedAt", sortOrder: "desc" });
  const input = parsed.success ? parsed.data : flashcardListQuerySchema.parse({ pageSize: 15, sortBy: "updatedAt", sortOrder: "desc" });
  const [result, topics] = await Promise.all([listFlashcards(input), listAdmin("topic", { page: 1, pageSize: 100, sortBy: "title", sortOrder: "asc" })]);

  return <>
    <PageHeader action={<Link className={cn(buttonVariants(), "bg-success hover:bg-success/90")} href="/flashcards/new"><Plus className="size-4" />Add flashcard</Link>} description="Manage concise front-and-back study cards by topic and difficulty." eyebrow="Learning content" title="Flashcards" />
    <FilterBar defaultValue={input.q} placeholder="Search front, back, or notes"><select aria-label="Topic" className={fieldClass} defaultValue={input.topicId ?? ""} name="topicId"><option value="">All topics</option>{topics.items.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select><select aria-label="Status" className={fieldClass} defaultValue={input.status ?? ""} name="status"><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select><select aria-label="Difficulty" className={fieldClass} defaultValue={input.difficulty ?? ""} name="difficulty"><option value="">All difficulties</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select></FilterBar>
    <p className="mb-4 text-sm text-muted">{result.pagination.total} flashcard{result.pagination.total === 1 ? "" : "s"}</p>
    {result.items.length ? <><FlashcardList bulkAction={bulkFlashcardStatusAction} items={result.items} page={result.pagination.page} pageSize={result.pagination.pageSize} trashAction={trashFlashcardAction} /><Pagination page={result.pagination.page} pageCount={Math.max(1, result.pagination.totalPages)} pathname="/flashcards" /></> : <EmptyState actionHref="/flashcards/new" actionLabel="Add flashcard" description="Create a flashcard or change the current filters." title="No flashcards found" />}
  </>;
}

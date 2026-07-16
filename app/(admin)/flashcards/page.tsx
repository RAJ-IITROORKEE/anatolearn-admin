import Link from "next/link";
import { Grid2X2, List, Plus } from "lucide-react";
import type { Metadata } from "next";

import { BulkActionForm } from "@/components/admin/bulk-action-form";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminMediaThumbnail } from "@/components/media/admin-media-thumbnail";
import { FilterBar, StatusBadge, fieldClass } from "@/components/phase3/admin-ui";
import { listAdmin } from "@/components/phase3/data";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { buttonVariants } from "@/components/ui/button";
import { listFlashcards } from "@/components/flashcards/data";
import { getAdminMediaMap } from "@/features/media/service";
import { flashcardListQuerySchema } from "@/features/flashcards/schemas";
import { cn } from "@/lib/utils";
import { bulkFlashcardStatusAction } from "../phase4-actions";

export const metadata: Metadata = { title: "Flashcards" };
type Params = Record<string, string | string[] | undefined>;
const scalar = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

export default async function FlashcardsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const parsed = flashcardListQuerySchema.safeParse({ page: scalar(params.page), pageSize: 15, q: scalar(params.q), status: scalar(params.status), difficulty: scalar(params.difficulty), topicId: scalar(params.topicId), sortBy: "updatedAt", sortOrder: "desc" });
  const input = parsed.success ? parsed.data : flashcardListQuerySchema.parse({ pageSize: 15, sortBy: "updatedAt", sortOrder: "desc" });
  const [result, topics] = await Promise.all([listFlashcards(input), listAdmin("topic", { page: 1, pageSize: 100, sortBy: "title", sortOrder: "asc" })]);
  const media = await getAdminMediaMap(result.items.flatMap((item) => [item.frontMediaId, item.backMediaId].filter((id): id is string => Boolean(id))));
  const grid = scalar(params.view) !== "list";
  const viewHref = (view: string) => { const query = new URLSearchParams(); for (const [key, raw] of Object.entries(params)) if (typeof raw === "string" && key !== "view") query.set(key, raw); query.set("view", view); return `/flashcards?${query}`; };

  return <>
    <PageHeader action={<Link className={cn(buttonVariants(), "bg-success hover:bg-success/90")} href="/flashcards/new"><Plus className="size-4" />Add flashcard</Link>} description="Manage concise front-and-back study cards by topic and difficulty." eyebrow="Learning content" title="Flashcards" />
    <FilterBar defaultValue={input.q} placeholder="Search front, back, or notes"><select aria-label="Topic" className={fieldClass} defaultValue={input.topicId ?? ""} name="topicId"><option value="">All topics</option>{topics.items.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select><select aria-label="Status" className={fieldClass} defaultValue={input.status ?? ""} name="status"><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select><select aria-label="Difficulty" className={fieldClass} defaultValue={input.difficulty ?? ""} name="difficulty"><option value="">All difficulties</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select></FilterBar>
    <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-muted">{result.pagination.total} flashcard{result.pagination.total === 1 ? "" : "s"}</p><div className="flex rounded-xl border border-border bg-surface p-1"><Link aria-label="Grid view" className={cn("rounded-lg p-2", grid ? "bg-success-soft text-success" : "text-muted")} href={viewHref("grid")}><Grid2X2 className="size-4" /></Link><Link aria-label="List view" className={cn("rounded-lg p-2", !grid ? "bg-success-soft text-success" : "text-muted")} href={viewHref("list")}><List className="size-4" /></Link></div></div>
    {result.items.length ? <BulkActionForm action={bulkFlashcardStatusAction}><div className={cn("grid gap-4", grid && "md:grid-cols-2 xl:grid-cols-3")}>{result.items.map((item) => {
      const hasFront = Boolean((item.frontMediaId && media.get(item.frontMediaId)?.signedUrl) || item.frontImageUrl);
      const hasBack = Boolean((item.backMediaId && media.get(item.backMediaId)?.signedUrl) || item.backImageUrl);
      return <article className="rounded-2xl border border-success/20 bg-surface p-4 shadow-sm transition hover:border-success/40 sm:p-5" key={item.id}><div className="flex items-start gap-3"><input aria-label={`Select ${item.frontText}`} className="mt-1 size-4" name="ids" type="checkbox" value={item.id} /><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><StatusBadge status={item.status} /><span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">{item.difficulty.toLowerCase()}</span></div>{hasFront || hasBack ? <div className="mt-3 grid grid-cols-2 gap-3"><AdminMediaThumbnail attached={hasFront} label="Front" legacyUrl={item.frontImageUrl} media={item.frontMediaId ? media.get(item.frontMediaId) : undefined} /><AdminMediaThumbnail attached={hasBack} label="Back" legacyUrl={item.backImageUrl} media={item.backMediaId ? media.get(item.backMediaId) : undefined} /></div> : null}<Link className="mt-3 block font-bold leading-6 text-foreground hover:text-success" href={`/flashcards/${item.id}`}>{item.frontText}</Link><details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-body">Show back</summary><p className="mt-2 whitespace-pre-wrap rounded-xl bg-subtle p-3 text-muted">{item.backText}</p></details></div></div></article>;
    })}</div><Pagination page={result.pagination.page} pageCount={Math.max(1, result.pagination.totalPages)} pathname="/flashcards" /></BulkActionForm> : <EmptyState actionHref="/flashcards/new" actionLabel="Add flashcard" description="Create a flashcard or change the current filters." title="No flashcards found" />}
  </>;
}

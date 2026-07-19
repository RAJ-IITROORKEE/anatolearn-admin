import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { FilterBar, fieldClass } from "@/components/phase3/admin-ui";
import { TopicList } from "@/components/phase3/content-lists";
import { listAdmin } from "@/components/phase3/data";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { buttonVariants } from "@/components/ui/button";
import { listQuerySchema } from "@/features/content/schemas";
import { getAdminMediaMap } from "@/features/media/service";
import { trashListResourceAction } from "../phase3-actions";

export const metadata: Metadata = { title: "Topics" };

export default async function TopicsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const systems = await listAdmin("organSystem", { page: 1, pageSize: 100, sortBy: "name", sortOrder: "asc" });
  const parsed = listQuerySchema.safeParse({ page: params.page, pageSize: 15, q: params.q || undefined, status: params.status || undefined, organSystemId: params.organSystemId || undefined, sortBy: "updatedAt", sortOrder: "desc" });
  const input = parsed.success ? parsed.data : listQuerySchema.parse({ pageSize: 15, sortBy: "updatedAt", sortOrder: "desc" });
  const result = await listAdmin("topic", input);
  const media = await getAdminMediaMap(result.items.flatMap((item) => item.coverMediaId ? [item.coverMediaId] : []));

  return <>
    <PageHeader action={<Link className={buttonVariants()} href="/topics/new"><Plus aria-hidden className="size-4" />Add topic</Link>} description="Search and review topics across every organ system." eyebrow="Learning content" title="Topics" />
    <FilterBar defaultValue={input.q}><select aria-label="Organ system" className={fieldClass} defaultValue={input.organSystemId ?? ""} name="organSystemId"><option value="">All organ systems</option>{systems.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Status" className={fieldClass} defaultValue={input.status ?? ""} name="status"><option value="">All statuses</option><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select></FilterBar>
    {result.items.length ? <>
      <TopicList items={result.items} media={media} page={result.pagination.page} pageSize={result.pagination.pageSize} trashAction={trashListResourceAction.bind(null, "topic")} />
      <div className="mt-5"><Pagination page={result.pagination.page} pageCount={Math.max(1, result.pagination.totalPages)} pathname="/topics" /></div>
    </> : <EmptyState action={{ href: "/topics/new", label: "Add topic" }} description="No topics match the current search and filters. Create a topic or adjust the filters." title="No topics found" />}
  </>;
}

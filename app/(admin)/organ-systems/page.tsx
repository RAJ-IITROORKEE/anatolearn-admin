import Link from "next/link";
import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/app-shell/page-header";
import { FilterBar, fieldClass } from "@/components/phase3/admin-ui";
import { OrganSystemList } from "@/components/phase3/content-lists";
import { listAdmin } from "@/components/phase3/data";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { buttonVariants } from "@/components/ui/button";
import { getAdminMediaMap } from "@/features/media/service";
import { listQuerySchema } from "@/features/content/schemas";
import { trashListResourceAction } from "../phase3-actions";

export const metadata: Metadata = { title: "Organ systems" };

export default async function OrganSystemsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const parsed = listQuerySchema.safeParse({ page: params.page, pageSize: 12, q: params.q || undefined, status: params.status || undefined, sortBy: "displayOrder", sortOrder: "asc" });
  const input = parsed.success ? parsed.data : listQuerySchema.parse({ pageSize: 12 });
  const result = await listAdmin("organSystem", input);
  const media = await getAdminMediaMap(result.items.flatMap((item) => [item.coverMediaId, item.iconMediaId].filter((id): id is string => Boolean(id))));

  return <>
    <PageHeader action={<Link className={buttonVariants()} href="/organ-systems/new"><Plus className="size-4" />Add organ system</Link>} description="Manage the top-level anatomy curriculum and publication state." eyebrow="Learning content" title="Organ systems" />
    <FilterBar defaultValue={input.q}><select aria-label="Status" className={fieldClass} defaultValue={input.status ?? ""} name="status"><option value="">All statuses</option><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select></FilterBar>
    {result.items.length ? <><OrganSystemList items={result.items} media={media} page={result.pagination.page} pageSize={result.pagination.pageSize} trashAction={trashListResourceAction.bind(null, "organ-system")} /><div className="mt-5"><Pagination page={result.pagination.page} pageCount={Math.max(1, result.pagination.totalPages)} pathname="/organ-systems" /></div></> : <EmptyState actionHref="/organ-systems/new" actionLabel="Add organ system" description="Create the first organ system or change the current filters." title="No organ systems found" />}
  </>;
}

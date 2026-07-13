import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { buttonVariants } from "@/components/ui/button";
import { FilterBar, ResourceCard, ResourceCards, StatusBadge, fieldClass } from "@/components/phase3/admin-ui";
import { listAdmin } from "@/components/phase3/data";
import { listQuerySchema } from "@/features/content/schemas";

export default async function OrganSystemsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams; const parsed = listQuerySchema.safeParse({ page: params.page, pageSize: 12, q: params.q || undefined, status: params.status || undefined, sortBy: "displayOrder", sortOrder: "asc" });
  const input = parsed.success ? parsed.data : listQuerySchema.parse({ pageSize: 12 }); const result = await listAdmin("organSystem", input);
  return <><PageHeader action={<Link className={buttonVariants()} href="/organ-systems/new"><Plus className="size-4" />Add organ system</Link>} description="Manage the top-level anatomy curriculum and publication state." eyebrow="Learning content" title="Organ systems" /><FilterBar defaultValue={input.q}><select aria-label="Status" className={fieldClass} defaultValue={input.status ?? ""} name="status"><option value="">All statuses</option><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select></FilterBar>{result.items.length ? <><ResourceCards>{result.items.map((item) => <ResourceCard href={`/organ-systems/${item.id}`} key={item.id} title={item.name} actions={<><StatusBadge status={item.status} /><StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} /></>}><p>{item.shortDescription}</p><p className="mt-2">Order {item.displayOrder} · Updated {item.updatedAt.toLocaleDateString()}</p></ResourceCard>)}</ResourceCards><div className="mt-5"><Pagination page={result.pagination.page} pageCount={Math.max(1, result.pagination.totalPages)} pathname="/organ-systems" /></div></> : <EmptyState actionHref="/organ-systems/new" actionLabel="Add organ system" description="Create the first organ system or change the current filters." title="No organ systems found" />}</>;
}

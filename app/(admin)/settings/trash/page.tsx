import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { InlineAction } from "@/components/phase3/action-form";
import { listTrash } from "@/features/trash/service";
import { restoreTrashAction } from "../../phase3-actions";

const labels: Record<string, string> = { "organ-system": "Organ system", topic: "Topic", "content-lesson": "Lesson", flashcard: "Flashcard", question: "Question", "media-asset": "Media" };
const date = (value: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default async function TrashPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") query.set(key, value);
  const result = await listTrash({ page: Number(query.get("page") ?? 1), pageSize: 20, q: query.get("q") || undefined, type: (query.get("type") as never) || undefined, expiry: (query.get("expiry") as never) || "all", eligibility: (query.get("eligibility") as never) || "all", sort: (query.get("sort") as never) || "trashedAt-desc" });
  const hasFilters = Boolean(query.get("q") || query.get("type") || query.get("expiry") || query.get("eligibility"));
  return <div>
    <PageHeader eyebrow="Settings" title="Trash" description="Restore deleted content during its 30-day retention window. Permanent deletion is automatic only when protected learning history no longer references an item." />
    <div className="mt-6 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm text-foreground"><strong>Items are hidden immediately.</strong> Referenced attempts, progress, audits, and delivery evidence are preserved and can block permanent deletion.</div>
    <form className="mt-6 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
      <label className="grid gap-1 text-sm font-semibold">Search<input className="h-11 rounded-xl border border-border bg-surface px-3" defaultValue={query.get("q") ?? ""} name="q" placeholder="Name, title, filename" /></label>
      <label className="grid gap-1 text-sm font-semibold">Type<select className="h-11 rounded-xl border border-border bg-surface px-3" defaultValue={query.get("type") ?? ""} name="type"><option value="">All types</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">Retention<select className="h-11 rounded-xl border border-border bg-surface px-3" defaultValue={query.get("expiry") ?? "all"} name="expiry"><option value="all">All</option><option value="restorable">Restorable</option><option value="expired">Expired</option></select></label>
      <label className="grid gap-1 text-sm font-semibold">Deletion status<select className="h-11 rounded-xl border border-border bg-surface px-3" defaultValue={query.get("eligibility") ?? "all"} name="eligibility"><option value="all">All</option><option value="pending">Waiting period</option><option value="eligible">Eligible</option><option value="blocked">Blocked</option></select></label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4"><button className="min-h-11 rounded-xl bg-primary px-4 font-bold text-white" type="submit">Apply filters</button>{hasFilters ? <a className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href="/settings/trash">Clear filters</a> : null}</div>
    </form>
    {result.items.length ? <>
      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-border bg-surface lg:block"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Deleted items in Trash</caption><thead className="border-b border-border bg-subtle text-xs uppercase text-muted"><tr><th className="p-4">Item</th><th className="p-4">Type</th><th className="p-4">Deleted</th><th className="p-4">Retention</th><th className="p-4">Action</th></tr></thead><tbody>{result.items.map((item) => <tr className="border-b border-border last:border-0" key={`${item.type}-${item.id}`}><td className="max-w-sm p-4 font-bold">{item.displayLabel}</td><td className="p-4">{labels[item.type]}</td><td className="whitespace-nowrap p-4"><time dateTime={item.trashedAt}>{date(item.trashedAt)}</time></td><td className="p-4"><span className="font-semibold">{item.retentionState === "RESTORABLE" ? `Restorable until ${date(item.purgeAfter)}` : item.eligibility === "BLOCKED" ? `Expired: ${item.blocker?.reason}` : "Eligible for automatic deletion"}</span></td><td className="p-4"><InlineAction action={restoreTrashAction.bind(null, item.type, item.id)} confirmMessage={`Restore ${item.displayLabel} as a draft? It will remain unpublished.`}>Restore</InlineAction></td></tr>)}</tbody></table></div>
      <div className="mt-6 grid gap-3 lg:hidden">{result.items.map((item) => <article className="rounded-2xl border border-border bg-surface p-4" key={`${item.type}-${item.id}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-bold">{item.displayLabel}</h2><p className="text-sm text-muted">{labels[item.type]}</p></div><span className="rounded-full bg-subtle px-2 py-1 text-xs font-bold">{item.eligibility}</span></div><p className="mt-3 text-sm text-muted">Deleted <time dateTime={item.trashedAt}>{date(item.trashedAt)}</time></p><p className="mt-1 break-words text-sm">{item.retentionState === "RESTORABLE" ? `Restorable until ${date(item.purgeAfter)}` : item.blocker?.reason ?? "Eligible for automatic deletion"}</p><div className="mt-4"><InlineAction action={restoreTrashAction.bind(null, item.type, item.id)} confirmMessage={`Restore ${item.displayLabel} as a draft? It will remain unpublished.`}>Restore</InlineAction></div></article>)}</div>
      <Pagination page={result.pagination.page} pageCount={result.pagination.totalPages} pathname="/settings/trash" />
    </> : <div className="mt-6"><EmptyState title={hasFilters ? "No deleted items match these filters" : "Trash is empty"} description={hasFilters ? "Clear filters to see all deleted items." : "Deleted content remains restorable for 30 days when it is safe to restore."} /></div>}
  </div>;
}

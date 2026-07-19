/* eslint-disable @next/next/no-img-element -- Admin previews use short-lived signed URLs. */

import { ImageIcon } from "lucide-react";
import Link from "next/link";

import { formatDateTime } from "@/components/assessments/format";
import type { AdminSystem, AdminTopicListItem } from "@/components/phase3/data";
import { InlineAction, type ActionState } from "@/components/phase3/action-form";
import { StatusBadge } from "@/components/phase3/admin-ui";
import { buttonVariants } from "@/components/ui/button";

type TrashAction = (id: string, state: ActionState, data: FormData) => Promise<ActionState>;
type MediaPreview = { altText: string; signedUrl: string };
type MediaMap = ReadonlyMap<string, MediaPreview | undefined>;

function PreviewImage({ alt, source }: { alt: string; source?: string | null }) {
  return source
    ? <img alt={alt} className="size-12 object-contain" src={source} />
    : <span aria-label={`${alt} unavailable`} className="flex size-12 items-center justify-center text-muted"><ImageIcon aria-hidden className="size-5" /></span>;
}

function OrganPreview({ item, media }: { item: AdminSystem; media: MediaMap }) {
  const cover = item.coverMediaId ? media.get(item.coverMediaId) : undefined;
  const icon = item.iconMediaId ? media.get(item.iconMediaId) : undefined;
  return <div className="flex w-fit -space-x-2 overflow-hidden rounded-xl border border-border bg-subtle p-1">
    <div className="overflow-hidden rounded-lg bg-surface"><PreviewImage alt={cover?.altText || `${item.name} cover`} source={cover?.signedUrl ?? item.coverImageUrl} /></div>
    <div className="overflow-hidden rounded-lg border-l border-border bg-surface"><PreviewImage alt={icon?.altText || `${item.name} icon`} source={icon?.signedUrl ?? item.iconImageUrl} /></div>
  </div>;
}

function TopicPreview({ item, media }: { item: AdminTopicListItem; media: MediaMap }) {
  const cover = item.coverMediaId ? media.get(item.coverMediaId) : undefined;
  return <div className="w-fit overflow-hidden rounded-xl border border-border bg-subtle p-1"><PreviewImage alt={cover?.altText || `${item.title} cover`} source={cover?.signedUrl ?? item.coverImageUrl} /></div>;
}

function Identity({ name, slug }: { name: string; slug: string }) {
  return <div className="min-w-0"><p className="font-semibold text-foreground">{name}</p><p className="mt-1 max-w-60 truncate font-mono text-xs text-muted" title={slug}>{slug}</p></div>;
}

function OrganActions({ item, trashAction }: { item: AdminSystem; trashAction: TrashAction }) {
  return <div className="flex flex-wrap justify-end gap-2">
    <Link aria-label={`Edit ${item.name}`} className={buttonVariants({ size: "sm", variant: "outline" })} href={`/organ-systems/${item.slug}`}>Edit</Link>
    <InlineAction action={trashAction.bind(null, item.id)} ariaLabel={`Delete ${item.name}`} confirmLabel="Move to Trash" confirmMessage="This organ system and its descendants will be hidden. It can be restored from Settings > Trash for 30 days." confirmTitle="Move organ system to Trash?">Delete</InlineAction>
  </div>;
}

function TopicActions({ item, trashAction }: { item: AdminTopicListItem; trashAction: TrashAction }) {
  const href = `/organ-systems/${item.organSystemSlug}/topics/${item.slug}`;
  return <div className="flex flex-wrap justify-end gap-2">
    <Link aria-label={`Edit ${item.title}`} className={buttonVariants({ size: "sm", variant: "outline" })} href={href}>Edit</Link>
    <InlineAction action={trashAction.bind(null, item.id)} ariaLabel={`Delete ${item.title}`} confirmLabel="Move to Trash" confirmMessage="This topic and its content will be hidden. It can be restored from Settings > Trash for 30 days." confirmTitle="Move topic to Trash?">Delete</InlineAction>
  </div>;
}

export function OrganSystemList({ items, media, page, pageSize, trashAction }: { items: AdminSystem[]; media: MediaMap; page: number; pageSize: number; trashAction: TrashAction }) {
  return <>
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm md:block">
      <table aria-label="Organ systems" className="w-full min-w-[840px] border-collapse text-left text-sm">
        <thead className="bg-subtle text-muted"><tr><th className="px-3 py-3 font-semibold" scope="col">S.No</th><th className="px-3 py-3 font-semibold" scope="col">Preview</th><th className="px-3 py-3 font-semibold" scope="col">System</th><th className="px-3 py-3 font-semibold" scope="col">Status / activity</th><th className="px-3 py-3 font-semibold" scope="col">Order</th><th className="px-3 py-3 font-semibold" scope="col">Updated</th><th className="px-3 py-3 text-right font-semibold" scope="col">Actions</th></tr></thead>
        <tbody>{items.map((item, index) => <tr className="border-t border-border transition-colors hover:bg-subtle/60" key={item.id}><td aria-label={String((page - 1) * pageSize + index + 1)} className="px-3 py-4 tabular-nums text-body">{(page - 1) * pageSize + index + 1}</td><td className="px-3 py-3"><OrganPreview item={item} media={media} /></td><th className="px-3 py-4" scope="row"><Identity name={item.name} slug={item.slug} /></th><td className="px-3 py-4"><div className="flex flex-wrap gap-2"><StatusBadge status={item.status} /><StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} /></div></td><td className="px-3 py-4 tabular-nums text-body">{item.displayOrder}</td><td className="whitespace-nowrap px-3 py-4 tabular-nums text-body">{formatDateTime(item.updatedAt)}</td><td className="px-3 py-4"><OrganActions item={item} trashAction={trashAction} /></td></tr>)}</tbody>
      </table>
    </div>
    <div className="grid gap-3 md:hidden">{items.map((item, index) => <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm" key={item.id}><div className="flex items-start gap-3"><OrganPreview item={item} media={media} /><div className="min-w-0 flex-1"><p className="text-xs font-semibold tabular-nums text-muted">S.No {(page - 1) * pageSize + index + 1}</p><div className="mt-2"><Identity name={item.name} slug={item.slug} /></div></div></div><div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3"><StatusBadge status={item.status} /><StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} /></div><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="font-semibold text-muted">Order</dt><dd className="mt-1 tabular-nums text-body">{item.displayOrder}</dd></div><div><dt className="font-semibold text-muted">Updated</dt><dd className="mt-1 tabular-nums text-body">{formatDateTime(item.updatedAt)}</dd></div></dl><div className="mt-4 border-t border-border pt-3"><OrganActions item={item} trashAction={trashAction} /></div></article>)}</div>
  </>;
}

export function TopicList({ items, media, page, pageSize, trashAction }: { items: AdminTopicListItem[]; media: MediaMap; page: number; pageSize: number; trashAction: TrashAction }) {
  return <>
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm md:block">
      <table aria-label="Topics" className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead className="bg-subtle text-muted"><tr><th className="px-3 py-3 font-semibold" scope="col">S.No</th><th className="px-3 py-3 font-semibold" scope="col">Preview</th><th className="px-3 py-3 font-semibold" scope="col">Topic</th><th className="px-3 py-3 font-semibold" scope="col">Organ system</th><th className="px-3 py-3 font-semibold" scope="col">Status</th><th className="px-3 py-3 font-semibold" scope="col">Order</th><th className="px-3 py-3 font-semibold" scope="col">Updated</th><th className="px-3 py-3 text-right font-semibold" scope="col">Actions</th></tr></thead>
        <tbody>{items.map((item, index) => <tr className="border-t border-border transition-colors hover:bg-subtle/60" key={item.id}><td aria-label={String((page - 1) * pageSize + index + 1)} className="px-3 py-4 tabular-nums text-body">{(page - 1) * pageSize + index + 1}</td><td className="px-3 py-3"><TopicPreview item={item} media={media} /></td><th className="px-3 py-4" scope="row"><Identity name={item.title} slug={item.slug} /></th><td className="px-3 py-4 text-body">{item.organSystemName}</td><td className="px-3 py-4"><StatusBadge status={item.status} /></td><td className="px-3 py-4 tabular-nums text-body">{item.displayOrder}</td><td className="whitespace-nowrap px-3 py-4 tabular-nums text-body">{formatDateTime(item.updatedAt)}</td><td className="px-3 py-4"><TopicActions item={item} trashAction={trashAction} /></td></tr>)}</tbody>
      </table>
    </div>
    <div className="grid gap-3 md:hidden">{items.map((item, index) => <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm" key={item.id}><div className="flex items-start gap-3"><TopicPreview item={item} media={media} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold tabular-nums text-muted">S.No {(page - 1) * pageSize + index + 1}</p><StatusBadge status={item.status} /></div><div className="mt-2"><Identity name={item.title} slug={item.slug} /></div></div></div><dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm"><div className="col-span-2"><dt className="font-semibold text-muted">Organ system</dt><dd className="mt-1 text-body">{item.organSystemName}</dd></div><div><dt className="font-semibold text-muted">Order</dt><dd className="mt-1 tabular-nums text-body">{item.displayOrder}</dd></div><div><dt className="font-semibold text-muted">Updated</dt><dd className="mt-1 tabular-nums text-body">{formatDateTime(item.updatedAt)}</dd></div></dl><div className="mt-4 border-t border-border pt-3"><TopicActions item={item} trashAction={trashAction} /></div></article>)}</div>
  </>;
}

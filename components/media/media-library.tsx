"use client";

/* eslint-disable @next/next/no-img-element -- Private signed URLs are short-lived and are not stable optimizer sources. */

import * as Dialog from "@radix-ui/react-dialog";
import { Copy, Eye, ImageIcon, Pencil, Trash2, X } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";

import { formatDateTime } from "@/components/assessments/format";
import { InlineAction, type ActionState, type FormAction } from "@/components/phase3/action-form";
import { ActionNotice, StatusBadge, fieldClass, labelClass } from "@/components/phase3/admin-ui";
import { Button } from "@/components/ui/button";

export type MediaLibraryItem = {
  id: string;
  originalFilename: string;
  mimeType: string;
  byteSize: string;
  width: number | null;
  height: number | null;
  altText: string;
  archivedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  uploadedById: string;
  signedUrl: string | null;
  signedUrlExpiresIn: number | null;
};

type BoundAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type ItemAction = (id: string, state: ActionState, formData: FormData) => Promise<ActionState>;

export function formatMediaBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Number((bytes / 1024).toFixed(1))} KB`;
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

function formatDimensions(item: Pick<MediaLibraryItem, "width" | "height">) {
  return item.width && item.height ? `${item.width} x ${item.height}` : "Unknown";
}

function typeLabel(mimeType: string) {
  return mimeType.split("/")[1]?.replace("jpeg", "JPG").toUpperCase() ?? "Image";
}

function DialogFrame({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] data-[state=closed]:opacity-0" />
    <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 max-h-[90vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl focus:outline-none sm:left-1/2 sm:w-[min(680px,calc(100%-2rem))] sm:-translate-x-1/2 sm:p-6">
      <div className="pr-12">
        <Dialog.Title className="text-xl font-bold text-foreground">{title}</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm leading-6 text-muted">{description}</Dialog.Description>
      </div>
      <Dialog.Close asChild><Button aria-label="Close dialog" className="absolute right-4 top-4" size="icon" variant="ghost"><X aria-hidden className="size-5" /></Button></Dialog.Close>
      {children}
    </Dialog.Content>
  </Dialog.Portal>;
}

function Thumbnail({ item }: { item: MediaLibraryItem }) {
  return <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-subtle">
    {item.signedUrl
      ? <img alt={`Preview of ${item.originalFilename}`} className="size-14 object-contain" src={item.signedUrl} />
      : <span className="px-1 text-center text-[10px] font-semibold leading-3 text-muted">Preview unavailable</span>}
  </div>;
}

function PreviewDialog({ item }: { item: MediaLibraryItem }) {
  return <Dialog.Root>
    <Dialog.Trigger asChild><Button aria-label={`View ${item.originalFilename}`} size="sm" variant="outline"><Eye aria-hidden className="size-4" />View</Button></Dialog.Trigger>
    <DialogFrame description="Secure temporary preview and stored image metadata." title={`Preview ${item.originalFilename}`}>
      <div className="mt-5 flex min-h-64 items-center justify-center overflow-hidden rounded-2xl border border-border bg-subtle p-3 sm:min-h-80">
        {item.signedUrl
          ? <img alt={item.altText || `Preview of ${item.originalFilename}`} className="max-h-[55vh] w-full object-contain" src={item.signedUrl} />
          : <div className="grid justify-items-center gap-3 text-center text-muted" role="status"><ImageIcon aria-hidden className="size-8" /><p className="font-semibold">Preview temporarily unavailable</p></div>}
      </div>
      <dl className="mt-5 grid gap-4 rounded-xl border border-border p-4 text-sm sm:grid-cols-2">
        <Metadata label="Filename" value={item.originalFilename} />
        <Metadata label="Alt text" value={item.altText || "No alt text provided"} />
        <Metadata label="Size" value={formatMediaBytes(item.byteSize)} />
        <Metadata label="Dimensions" value={formatDimensions(item)} />
        <Metadata label="Type" value={item.mimeType} />
        <Metadata label="Updated" value={formatDateTime(item.updatedAt)} />
      </dl>
    </DialogFrame>
  </Dialog.Root>;
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-muted">{label}</dt><dd className="mt-1 break-words font-medium text-foreground">{value}</dd></div>;
}

function EditAltDialog({ action, item }: { action: BoundAction; item: MediaLibraryItem }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next.error) toast.error(next.error);
    if (next.success) {
      toast.success(next.success);
      setOpen(false);
    }
    return next;
  }, {});

  return <Dialog.Root onOpenChange={setOpen} open={open}>
    <Dialog.Trigger asChild><Button aria-label={`Edit alt text for ${item.originalFilename}`} size="sm" variant="outline"><Pencil aria-hidden className="size-4" />Edit alt</Button></Dialog.Trigger>
    <DialogFrame description={`Update the accessible description for ${item.originalFilename}. Alt text may be left blank for decorative imagery.`} title="Edit alt text">
      <form action={formAction} className="mt-5 grid gap-5">
        <ActionNotice state={{ error: state.error }} />
        <label className={labelClass}>Alt text <span className="font-normal text-muted">Optional</span><textarea className={`${fieldClass} min-h-28 py-3`} defaultValue={item.altText} maxLength={500} name="altText" /></label>
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Dialog.Close asChild><Button type="button" variant="outline">Cancel</Button></Dialog.Close>
          <Button disabled={pending} type="submit">{pending ? "Saving..." : "Save alt text"}</Button>
        </div>
      </form>
    </DialogFrame>
  </Dialog.Root>;
}

function CopySignedUrlAction({ item }: { item: MediaLibraryItem }) {
  const [message, setMessage] = useState("");
  const copy = async () => {
    if (!item.signedUrl) return;
    try {
      await navigator.clipboard.writeText(item.signedUrl);
      setMessage("Copied secure temporary URL. It expires 15 minutes after generation.");
    } catch {
      setMessage("Could not copy the temporary signed URL.");
    }
  };
  return <div>
    <Button aria-label={`Copy signed URL for ${item.originalFilename}`} disabled={!item.signedUrl} onClick={copy} size="sm" title={item.signedUrl ? "Secure signed URL, valid for 15 minutes after generation" : "Signed URL temporarily unavailable"} type="button" variant="outline"><Copy aria-hidden className="size-4" />Copy 15-min URL</Button>
    {message ? <p className="mt-1 max-w-48 text-xs leading-4 text-muted" role="status">{message}</p> : null}
  </div>;
}

function RowActions({ item, trashAction, updateAction }: { item: MediaLibraryItem; trashAction: ItemAction; updateAction: ItemAction }) {
  return <div className="flex flex-wrap justify-end gap-2">
    <PreviewDialog item={item} />
    <EditAltDialog action={updateAction.bind(null, item.id) as FormAction} item={item} />
    <CopySignedUrlAction item={item} />
    {!item.archivedAt ? <InlineAction action={trashAction.bind(null, item.id)} ariaLabel={`Delete ${item.originalFilename}`} confirmLabel="Move to Trash" confirmMessage="This image will be hidden and can be restored from Settings > Trash for 30 days." confirmTitle="Move image to Trash?" destructive><Trash2 aria-hidden className="size-4" />Delete</InlineAction> : null}
  </div>;
}

function FileSummary({ item }: { item: MediaLibraryItem }) {
  return <div className="min-w-0">
    <p className="max-w-64 truncate font-semibold text-foreground" title={item.originalFilename}>{item.originalFilename}</p>
    <p className="mt-1 max-w-72 line-clamp-2 text-xs leading-5 text-muted">{item.altText || "No alt text provided"}</p>
  </div>;
}

export function MediaLibrary({ items, trashAction, updateAction }: { items: MediaLibraryItem[]; trashAction: ItemAction; updateAction: ItemAction }) {
  return <>
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm md:block">
      <table aria-label="Media library assets" className="w-full min-w-[1120px] border-collapse text-left text-sm">
        <thead className="bg-subtle text-muted"><tr><th className="px-4 py-3 font-semibold" scope="col">Image</th><th className="px-3 py-3 font-semibold" scope="col">File and alt text</th><th className="px-3 py-3 font-semibold" scope="col">Updated</th><th className="px-3 py-3 font-semibold" scope="col">Size</th><th className="px-3 py-3 font-semibold" scope="col">Dimensions</th><th className="px-3 py-3 font-semibold" scope="col">Type</th><th className="px-3 py-3 font-semibold" scope="col">Status</th><th className="px-4 py-3 text-right font-semibold" scope="col">Actions</th></tr></thead>
        <tbody>{items.map((item) => <tr className="border-t border-border align-middle transition-colors hover:bg-subtle/60" key={item.id}>
          <td className="px-4 py-3"><Thumbnail item={item} /></td>
          <th className="px-3 py-3 text-left" scope="row"><FileSummary item={item} /></th>
          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-body">{formatDateTime(item.updatedAt)}</td>
          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-body">{formatMediaBytes(item.byteSize)}</td>
          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-body">{formatDimensions(item)}</td>
          <td className="px-3 py-3"><span className="block font-semibold text-foreground">{typeLabel(item.mimeType)}</span><span className="text-xs text-muted">{item.mimeType}</span></td>
          <td className="px-3 py-3"><StatusBadge status={item.archivedAt ? "ARCHIVED" : "ACTIVE"} /></td>
          <td className="px-4 py-3"><RowActions item={item} trashAction={trashAction} updateAction={updateAction} /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="grid gap-3 md:hidden">{items.map((item) => <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm" key={item.id}>
      <div className="flex items-start gap-3"><Thumbnail item={item} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><FileSummary item={item} /><StatusBadge status={item.archivedAt ? "ARCHIVED" : "ACTIVE"} /></div></div></div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm">
        <Metadata label="Updated" value={formatDateTime(item.updatedAt)} />
        <Metadata label="Size" value={formatMediaBytes(item.byteSize)} />
        <Metadata label="Dimensions" value={formatDimensions(item)} />
        <Metadata label="Type" value={item.mimeType} />
      </dl>
      <div className="mt-4 border-t border-border pt-4"><RowActions item={item} trashAction={trashAction} updateAction={updateAction} /></div>
    </article>)}</div>
  </>;
}

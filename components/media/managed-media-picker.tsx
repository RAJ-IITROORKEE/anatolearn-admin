"use client";

/* eslint-disable @next/next/no-img-element -- Private signed URLs are short-lived and not optimizer sources. */

import * as Dialog from "@radix-ui/react-dialog";
import { ImageIcon, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { searchManagedMediaAction } from "@/app/(admin)/managed-media-actions";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/phase3/admin-ui";

export type ManagedMediaItem = {
  id: string;
  originalFilename: string;
  mimeType: string;
  altText: string;
  signedUrl: string | null;
};

type Result = {
  items: ManagedMediaItem[];
  pagination: { page: number; totalPages: number };
  selected?: ManagedMediaItem | null;
};

export function ManagedMediaPicker({ label, name, required = false, value = "", onChange }: { label: string; name: string; required?: boolean; value?: string | null; onChange?: (id: string, item: ManagedMediaItem | null) => void }) {
  const [selectedId, setSelectedId] = useState(value ?? "");
  const [selected, setSelected] = useState<ManagedMediaItem | null>(null);
  const [result, setResult] = useState<Result>({ items: [], pagination: { page: 1, totalPages: 0 } });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    inputRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [selectedId]);

  const load = (page: number, query = search) => startTransition(async () => {
    const currentRequest = ++requestId.current;
    try {
      const next = await searchManagedMediaAction({ page, search: query, ...(selectedId ? { selectedId } : {}) });
      if (currentRequest !== requestId.current) return;
      setResult(next);
      if (next.selected) setSelected(next.selected);
      setError("");
    } catch {
      if (currentRequest !== requestId.current) return;
      setError("Managed media could not be loaded. Try again.");
    }
  });
  const choose = (item: ManagedMediaItem | null) => {
    setSelectedId(item?.id ?? "");
    setSelected(item);
    onChange?.(item?.id ?? "", item);
    setOpen(false);
  };

  return <div className="grid gap-2">
    <span className="text-sm font-semibold text-body">{label} <span className="font-normal text-muted">{required ? "Required" : "Optional"}</span></span>
    <input name={name} ref={inputRef} type="hidden" value={selectedId} />
    {selectedId ? <div className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-subtle p-3">
      {selected?.signedUrl ? <img alt="" className="size-16 rounded-lg object-contain" src={selected.signedUrl} /> : <div className="flex size-16 items-center justify-center rounded-lg bg-surface text-muted"><ImageIcon aria-hidden className="size-5" /></div>}
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{selected?.originalFilename ?? "Managed media selected"}</p><p className="line-clamp-2 text-xs text-muted">{selected?.altText ?? "Open the picker to refresh asset details."}</p></div>
      <button aria-label={`Clear ${label}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border hover:text-destructive" onClick={() => choose(null)} type="button"><X aria-hidden className="size-4" /></button>
    </div> : null}
    <Dialog.Root onOpenChange={(next) => {
      setOpen(next);
      if (next) {
        setSearch("");
        load(1, "");
      }
    }} open={open}>
      <Dialog.Trigger asChild><Button className="w-full sm:w-fit" variant="outline">Choose {label}</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 max-h-[85vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-xl sm:left-1/2 sm:w-[min(720px,calc(100%-2rem))] sm:-translate-x-1/2 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><Dialog.Title className="text-xl font-bold">Choose {label}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted">Only current, unarchived managed media is shown.</Dialog.Description></div><Dialog.Close aria-label="Close media picker" className="inline-flex size-11 items-center justify-center rounded-xl border border-border"><X aria-hidden className="size-4" /></Dialog.Close></div>
          <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); load(1); }}><label className="sr-only" htmlFor={`${name}-media-search`}>Search managed media</label><input className={fieldClass} id={`${name}-media-search`} onChange={(event) => setSearch(event.target.value)} placeholder="Filename or alt text" type="search" value={search} /><Button disabled={pending} type="submit"><Search aria-hidden className="size-4" />Search</Button></form>
          {error ? <p className="mt-4 rounded-xl bg-destructive-soft p-3 text-sm font-semibold text-destructive" role="alert">{error}</p> : null}
          {pending ? <p className="mt-6 text-sm text-muted" role="status">Loading managed media...</p> : result.items.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{result.items.map((item) => <article className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-xl border border-border p-3" key={item.id}>
            <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-subtle">{item.signedUrl ? <img alt="" className="h-full w-full object-contain" src={item.signedUrl} /> : <span className="px-2 text-center text-xs font-semibold text-muted">Preview temporarily unavailable</span>}</div>
            <div className="min-w-0"><p className="truncate text-sm font-bold">{item.originalFilename}</p><p className="text-xs text-muted">{item.mimeType}</p><p className="mt-1 line-clamp-2 text-xs text-body">{item.altText}</p><button aria-label={`Select ${item.originalFilename}`} className="mt-2 min-h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-white" onClick={() => choose(item)} type="button">Select</button></div>
          </article>)}</div> : <p className="mt-6 rounded-xl bg-subtle p-5 text-center text-sm text-muted">No current media found.</p>}
          {result.pagination.totalPages > 1 ? <div className="mt-5 flex items-center justify-between gap-3"><Button disabled={pending || result.pagination.page <= 1} onClick={() => load(result.pagination.page - 1)} variant="outline">Previous</Button><span className="text-sm text-muted">Page {result.pagination.page} of {result.pagination.totalPages}</span><Button disabled={pending || result.pagination.page >= result.pagination.totalPages} onClick={() => load(result.pagination.page + 1)} variant="outline">Next</Button></div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}

"use client";

import { Search, X } from "lucide-react";
import { useState, useTransition } from "react";

import { fieldClass } from "@/components/phase3/admin-ui";
import { Button } from "@/components/ui/button";

export type LearnerOption = { id: string; fullName: string; email: string };
export type LearnerSearchResult = { items: LearnerOption[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };

export function LearnerPicker({ initial, initialSelected, onDirty, searchAction }: {
  initial: LearnerSearchResult;
  initialSelected: LearnerOption[];
  onDirty?: () => void;
  searchAction: (query: string, page: number) => Promise<LearnerSearchResult>;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(initial);
  const [selected, setSelected] = useState(() => new Map(initialSelected.map((learner) => [learner.id, learner])));
  const [pending, startTransition] = useTransition();

  const search = (page: number) => startTransition(async () => setResult(await searchAction(query.trim(), page)));
  const toggle = (learner: LearnerOption, checked: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      if (checked) next.set(learner.id, learner); else next.delete(learner.id);
      return next;
    });
    onDirty?.();
  };
  const selectedItems = [...selected.values()];

  return <div className="grid gap-3">
    {selectedItems.map((learner) => <input key={learner.id} name="userIds" type="hidden" value={learner.id} />)}
    <p className="text-sm font-semibold text-body">{selected.size} learner{selected.size === 1 ? "" : "s"} selected <span className="font-normal text-muted">(maximum 500)</span></p>
    {selectedItems.length > 0 && <div aria-label="Selected learners" className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-xl border border-border bg-surface p-2">
      {selectedItems.map((learner) => <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary" key={learner.id}>{learner.fullName}<button aria-label={`Remove ${learner.fullName}`} className="rounded-full p-0.5 hover:bg-primary/10" onClick={() => toggle(learner, false)} type="button"><X aria-hidden="true" className="size-3" /></button></span>)}
    </div>}
    <div className="flex gap-2" role="search">
      <label className="relative grow"><span className="sr-only">Search active learners</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" /><input aria-label="Search active learners" className={`${fieldClass} pl-9`} maxLength={200} onChange={(event) => { event.stopPropagation(); setQuery(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search(1); } }} placeholder="Search by name or email" value={query} /></label>
      <Button disabled={pending} onClick={() => search(1)} type="button" variant="outline">{pending ? "Searching..." : "Search"}</Button>
    </div>
    <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-2" role="group" aria-label="Active learner search results">
      {result.items.length ? result.items.map((learner) => {
        const checked = selected.has(learner.id);
        return <label className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-subtle" key={learner.id}><input aria-label={`${learner.fullName} (${learner.email})`} checked={checked} disabled={!checked && selected.size >= 500} onChange={(event) => toggle(learner, event.target.checked)} type="checkbox" /><span><strong className="block text-foreground">{learner.fullName}</strong><span className="text-muted">{learner.email}</span></span></label>;
      }) : <p className="p-2 text-sm text-muted">No active learners match this search.</p>}
    </div>
    <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">Page {result.pagination.page} of {Math.max(1, result.pagination.totalPages)}; {result.pagination.total} matches</span><div className="flex gap-2"><Button disabled={pending || result.pagination.page <= 1} onClick={() => search(result.pagination.page - 1)} size="sm" type="button" variant="outline">Previous</Button><Button disabled={pending || result.pagination.page >= result.pagination.totalPages} onClick={() => search(result.pagination.page + 1)} size="sm" type="button" variant="outline">Next</Button></div></div>
  </div>;
}

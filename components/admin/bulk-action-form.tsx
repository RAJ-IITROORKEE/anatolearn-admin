"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ActionNotice } from "@/components/phase3/admin-ui";
import type { ActionState, FormAction } from "@/components/phase3/action-form";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Button } from "@/components/ui/button";

export function BulkActionForm({ action, children, itemIds, itemLabel, trashOnly = false }: { action: FormAction; children: React.ReactNode; itemIds: string[]; itemLabel: string; trashOnly?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const operationRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const itemIdsKey = JSON.stringify(itemIds);
  const [selectionPageKey, setSelectionPageKey] = useState(itemIdsKey);
  const checkboxes = () => Array.from(containerRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]') ?? []);
  if (selectionPageKey !== itemIdsKey) {
    const currentPageIds = new Set(itemIds);
    setSelectionPageKey(itemIdsKey);
    setSelectedIds((current) => current.filter((id) => currentPageIds.has(id)));
  }
  useEffect(() => {
    const selected = new Set(selectedIds);
    checkboxes().forEach((checkbox) => { checkbox.checked = selected.has(checkbox.value); });
  }, [itemIds, selectedIds]);
  const updateSelection = (event: React.ChangeEvent<HTMLDivElement>) => {
    const checkbox = event.target;
    if (!(checkbox instanceof HTMLInputElement) || checkbox.type !== "checkbox" || checkbox.name !== "ids") return;
    setSelectedIds((current) => checkbox.checked
      ? [...new Set([...current, checkbox.value])]
      : current.filter((id) => id !== checkbox.value));
  };
  const selectAll = () => setSelectedIds([...new Set(itemIds)]);
  const clearSelection = () => {
    setSelectedIds([]);
  };
  const [state, formAction, pending] = useActionState(async (previous: ActionState, data: FormData) => {
    const next = await action(previous, data);
    if (next.error) toast.error(next.error);
    if (next.success) {
      toast.success(next.success);
      clearSelection();
    }
    return next;
  }, {});
  const submit = (operation: "PUBLISHED" | "DRAFT" | "TRASH") => {
    if (!operationRef.current) return;
    operationRef.current.value = operation;
    formRef.current?.requestSubmit();
  };
  const count = selectedIds.length;
  const pluralLabel = `${itemLabel}${count === 1 ? "" : "s"}`;
  return (
    <div className="grid gap-4" onChange={updateSelection} ref={containerRef}>
      {count > 0 ? <form action={formAction} ref={formRef}>
        {selectedIds.map((id) => <input key={id} name="ids" type="hidden" value={id} />)}
        <input name="operation" ref={operationRef} type="hidden" />
        <div aria-label="Bulk actions" className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary-soft p-3 sm:flex-row sm:items-center sm:justify-between" role="toolbar">
          <p className="text-sm font-semibold text-foreground">{count} {pluralLabel} selected</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={selectAll} type="button" variant="outline">Select all current page</Button>
            <Button onClick={clearSelection} type="button" variant="ghost">Clear selection</Button>
            {!trashOnly ? <ConfirmationDialog confirmLabel={`Publish ${count} ${pluralLabel}`} description={`Publish the last saved version of ${count} selected ${pluralLabel}?`} onConfirm={() => submit("PUBLISHED")} pending={pending} title={`Publish selected ${pluralLabel}?`}><Button type="button" variant="outline">Publish selected</Button></ConfirmationDialog> : null}
            {!trashOnly ? <ConfirmationDialog confirmLabel={`Move ${count} ${pluralLabel} to draft`} description={`Move ${count} selected ${pluralLabel} to draft?`} onConfirm={() => submit("DRAFT")} pending={pending} title={`Move selected ${pluralLabel} to draft?`}><Button type="button" variant="outline">Move to draft</Button></ConfirmationDialog> : null}
            <ConfirmationDialog confirmLabel={`Move ${count} ${pluralLabel} to Trash`} description={`The selected ${pluralLabel} will be hidden and can be restored from Settings > Trash for 30 days.`} onConfirm={() => submit("TRASH")} pending={pending} title={`Move selected ${pluralLabel} to Trash?`}><Button type="button" variant="destructive">Delete selected</Button></ConfirmationDialog>
          </div>
        </div>
      </form> : null}
      <ActionNotice state={state} />
      {children}
    </div>
  );
}

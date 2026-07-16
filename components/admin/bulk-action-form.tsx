"use client";

import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";

import { PendingButton } from "@/components/shared/pending-button";
import { ActionNotice, fieldClass } from "@/components/phase3/admin-ui";
import type { ActionState, FormAction } from "@/components/phase3/action-form";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";

export function BulkActionForm({ action, children }: { action: FormAction; children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(async (previous: ActionState, data: FormData) => {
    const next = await action(previous, data);
    if (next.error) toast.error(next.error);
    if (next.success) toast.success(next.success);
    return next;
  }, {});
  const [selection, setSelection] = useState({ count: 0, status: "PUBLISHED" });
  const formRef = useRef<HTMLFormElement>(null);
  const refreshSelection = () => {
    if (!formRef.current) return;
    const form = new FormData(formRef.current);
    setSelection({ count: form.getAll("ids").length, status: String(form.get("status")) });
  };
  const verb = selection.status === "ARCHIVED" ? "Archive" : "Change status for";
  return (
    <form
      action={formAction}
      className="grid gap-4"
      onChange={refreshSelection}
      ref={formRef}
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Select cards below, then apply a lifecycle change.</p>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="bulk-status">Bulk status</label>
          <select className={`${fieldClass} min-w-32`} defaultValue="PUBLISHED" id="bulk-status" name="status">
            <option value="PUBLISHED">Publish</option>
            <option value="DRAFT">Move to draft</option>
            <option value="ARCHIVED">Archive</option>
          </select>
          <ConfirmationDialog confirmLabel={`Apply to ${selection.count} item${selection.count === 1 ? "" : "s"}`} description={`${verb} ${selection.count} selected item${selection.count === 1 ? "" : "s"}?`} onConfirm={() => formRef.current?.requestSubmit()} pending={pending} title="Confirm bulk action">
            <PendingButton disabled={!selection.count} pending={pending} pendingLabel="Applying" type="button" variant="outline">Apply</PendingButton>
          </ConfirmationDialog>
        </div>
      </div>
      <ActionNotice state={state} />
      {children}
    </form>
  );
}

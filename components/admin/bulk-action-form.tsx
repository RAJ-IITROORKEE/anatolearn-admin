"use client";

import { useActionState } from "react";

import { PendingButton } from "@/components/shared/pending-button";
import { ActionNotice, fieldClass } from "@/components/phase3/admin-ui";
import type { FormAction } from "@/components/phase3/action-form";

export function BulkActionForm({ action, children }: { action: FormAction; children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className="grid gap-4"
      onSubmit={(event) => {
        const form = new FormData(event.currentTarget);
        const status = String(form.get("status"));
        const count = form.getAll("ids").length;
        if (!count || !window.confirm(`${status === "ARCHIVED" ? "Archive" : "Change status for"} ${count} selected item${count === 1 ? "" : "s"}?`)) event.preventDefault();
      }}
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
          <PendingButton pending={pending} pendingLabel="Applying" variant="outline">Apply</PendingButton>
        </div>
      </div>
      <ActionNotice state={state} />
      {children}
    </form>
  );
}

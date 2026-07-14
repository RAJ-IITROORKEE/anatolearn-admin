"use client";

import { useActionState, useRef, useState } from "react";
import { PendingButton } from "@/components/shared/pending-button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { UnsavedNavigationGuard } from "@/components/notifications/unsaved-navigation-guard";
import { ActionNotice } from "./admin-ui";

export type ActionState = { error?: string; success?: string };
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({ action, children, guardUnsavedChanges, label = "Save changes", pendingLabel = "Saving" }: { action: FormAction; children: React.ReactNode; guardUnsavedChanges?: string; label?: string; pendingLabel?: string }) {
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next.success) setDirty(false);
    return next;
  }, {});
  return <>{guardUnsavedChanges ? <UnsavedNavigationGuard dirty={dirty} subject={guardUnsavedChanges} /> : null}<form action={formAction} className="grid gap-5" onChange={() => setDirty(true)} onClick={(event) => { if ((event.target as Element).closest("[data-form-dirty]")) setDirty(true); }}><ActionNotice state={state} />{children}<div className="flex justify-end border-t border-border pt-5"><PendingButton pending={pending} pendingLabel={pendingLabel}>{label}</PendingButton></div></form></>;
}

export function InlineAction({ action, children, confirmMessage, pendingLabel = "Working" }: { action: FormAction; children: React.ReactNode; confirmMessage?: string; pendingLabel?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  return <form action={formAction} ref={formRef}><ActionNotice state={state} />{confirmMessage ? <ConfirmationDialog confirmLabel="Confirm" description={confirmMessage} onConfirm={() => formRef.current?.requestSubmit()} pending={pending} title="Confirm action"><PendingButton pending={pending} pendingLabel={pendingLabel} size="sm" type="button" variant="outline">{children}</PendingButton></ConfirmationDialog> : <PendingButton pending={pending} pendingLabel={pendingLabel} size="sm" variant="outline">{children}</PendingButton>}</form>;
}

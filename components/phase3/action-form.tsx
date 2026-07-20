"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PendingButton } from "@/components/shared/pending-button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { UnsavedNavigationGuard } from "@/components/notifications/unsaved-navigation-guard";
import { ActionNotice } from "./admin-ui";

export type ActionState = { error?: string; success?: string; redirectTo?: string; navigationMode?: "push" | "replace" };
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({ action, children, guardUnsavedChanges, label = "Save changes", pendingLabel = "Saving", stickyActions = false }: { action: FormAction; children: React.ReactNode; guardUnsavedChanges?: string; label?: string; pendingLabel?: string; stickyActions?: boolean }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next.error) toast.error(next.error);
    if (next.success) {
      setDirty(false);
      toast.success(next.success);
      if (next.redirectTo) {
        if (next.navigationMode === "replace") router.replace(next.redirectTo);
        else router.push(next.redirectTo);
      }
    }
    return next;
  }, {});
  return <>{guardUnsavedChanges ? <UnsavedNavigationGuard dirty={dirty} subject={guardUnsavedChanges} /> : null}<form action={formAction} className="grid gap-5" onChange={() => setDirty(true)} onClick={(event) => { if ((event.target as Element).closest("[data-form-dirty]")) setDirty(true); }}><ActionNotice state={state} />{children}<div className={stickyActions ? "sticky bottom-0 z-20 -mx-4 flex justify-end border-t border-border bg-surface/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6" : "flex justify-end border-t border-border pt-5"}><PendingButton pending={pending} pendingLabel={pendingLabel}>{label}</PendingButton></div></form></>;
}

export function InlineAction({ action, ariaLabel, children, confirmLabel = "Confirm", confirmMessage, confirmTitle = "Confirm action", destructive = false, pendingLabel = "Working" }: { action: FormAction; ariaLabel?: string; children: React.ReactNode; confirmLabel?: string; confirmMessage?: string; confirmTitle?: string; destructive?: boolean; pendingLabel?: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next.error) toast.error(next.error);
    if (next.success) toast.success(next.success);
    if (next.redirectTo) {
      if (next.navigationMode === "replace") router.replace(next.redirectTo);
      else router.push(next.redirectTo);
    }
    return next;
  }, {});
  const formRef = useRef<HTMLFormElement>(null);
  return <form action={formAction} ref={formRef}><ActionNotice state={state} />{confirmMessage ? <ConfirmationDialog confirmLabel={confirmLabel} description={confirmMessage} onConfirm={() => formRef.current?.requestSubmit()} pending={pending} title={confirmTitle}><PendingButton aria-label={ariaLabel} pending={pending} pendingLabel={pendingLabel} size="sm" type="button" variant={destructive ? "destructive" : "outline"}>{children}</PendingButton></ConfirmationDialog> : <PendingButton aria-label={ariaLabel} pending={pending} pendingLabel={pendingLabel} size="sm" variant={destructive ? "destructive" : "outline"}>{children}</PendingButton>}</form>;
}

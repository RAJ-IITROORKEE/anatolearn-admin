"use client";

import { useActionState } from "react";
import { PendingButton } from "@/components/shared/pending-button";
import { ActionNotice } from "./admin-ui";

export type ActionState = { error?: string; success?: string };
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({ action, children, label = "Save changes", pendingLabel = "Saving" }: { action: FormAction; children: React.ReactNode; label?: string; pendingLabel?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="grid gap-5"><ActionNotice state={state} />{children}<div className="flex justify-end border-t border-border pt-5"><PendingButton pending={pending} pendingLabel={pendingLabel}>{label}</PendingButton></div></form>;
}

export function InlineAction({ action, children, confirmMessage, pendingLabel = "Working" }: { action: FormAction; children: React.ReactNode; confirmMessage?: string; pendingLabel?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} onSubmit={(event) => { if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault(); }}><ActionNotice state={state} /><PendingButton pending={pending} pendingLabel={pendingLabel} size="sm" variant="outline">{children}</PendingButton></form>;
}

"use client";

import { useActionState } from "react";

import { ActionNotice } from "@/components/phase3/admin-ui";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Button } from "@/components/ui/button";

export type NotificationActionState = { error?: string; success?: string };

export function CampaignAction({ action, children, confirmLabel, description, disabled, title }: {
  action: (state: NotificationActionState) => Promise<NotificationActionState>;
  children: React.ReactNode;
  confirmLabel: string;
  description: string;
  disabled?: boolean;
  title: string;
}) {
  const [state, run, pending] = useActionState(action, {});
  return <div className="grid gap-2">
    <ConfirmationDialog confirmLabel={confirmLabel} description={description} onConfirm={() => run()} pending={pending} title={title}>
      <Button disabled={disabled || pending} type="button" variant="outline">{pending ? "Working..." : children}</Button>
    </ConfirmationDialog>
    <ActionNotice state={state} />
  </div>;
}

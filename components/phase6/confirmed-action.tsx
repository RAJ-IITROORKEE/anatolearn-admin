"use client";

import { useActionState, type ReactNode } from "react";

import { ActionNotice } from "@/components/phase3/admin-ui";
import type { ActionState } from "@/components/phase3/action-form";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Button } from "@/components/ui/button";

type ConfirmedActionProps = {
  action: (state: ActionState) => Promise<ActionState>;
  children: ReactNode;
  confirmLabel: string;
  description: string;
  title: string;
  destructive?: boolean;
};

export function ConfirmedAction({ action, children, confirmLabel, description, title, destructive }: ConfirmedActionProps) {
  const [state, runAction, pending] = useActionState(action, {});
  return <div className="grid gap-2">
    <ActionNotice state={state} />
    <ConfirmationDialog confirmLabel={confirmLabel} description={description} onConfirm={() => runAction()} pending={pending} title={title}>
      <Button size="sm" variant={destructive ? "destructive" : "outline"}>{children}</Button>
    </ConfirmationDialog>
  </div>;
}

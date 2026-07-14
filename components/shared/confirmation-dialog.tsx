"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ConfirmationDialogProps = {
  children: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
};

export function ConfirmationDialog({
  children,
  confirmLabel,
  description,
  onConfirm,
  pending,
  title,
}: ConfirmationDialogProps) {
  const descriptionId = useId();
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px] data-[state=closed]:opacity-0" />
        <Dialog.Content
          aria-describedby={descriptionId}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl focus:outline-none"
          role="alertdialog"
        >
          <Dialog.Title className="pr-10 text-xl font-bold text-foreground">{title}</Dialog.Title>
          <Dialog.Description id={descriptionId} className="mt-2 text-sm leading-6 text-muted">
            {description}
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button aria-label="Close confirmation" className="absolute right-4 top-4" size="icon" variant="ghost">
              <X aria-hidden="true" className="size-5" />
            </Button>
          </Dialog.Close>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Dialog.Close asChild><Button autoFocus variant="outline">Cancel</Button></Dialog.Close>
            <Dialog.Close asChild>
              <Button disabled={pending} onClick={onConfirm} variant="destructive">
                {pending ? "Working..." : confirmLabel}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

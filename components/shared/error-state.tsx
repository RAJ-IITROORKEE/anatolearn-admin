"use client";

import { CircleAlert, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ErrorState({ description, onRetry, title = "Something went wrong" }: { description: string; onRetry?: () => void; title?: string }) {
  return (
    <section className="rounded-2xl border border-destructive/20 bg-destructive-soft p-6" role="alert">
      <div className="flex gap-4">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div>
          <h2 className="font-bold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-body">{description}</p>
          {onRetry && <Button className="mt-4" onClick={onRetry} size="sm" variant="outline"><RotateCcw aria-hidden="true" className="size-4" />Retry</Button>}
        </div>
      </div>
    </section>
  );
}

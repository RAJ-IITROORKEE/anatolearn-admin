import { HeartPulse } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-sm">
        <HeartPulse aria-hidden="true" className="size-5" strokeWidth={2.25} />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block text-base font-bold tracking-tight text-foreground">AnatoLearn</span>
          <span className="block text-xs font-medium text-muted">Admin workspace</span>
        </span>
      )}
    </div>
  );
}

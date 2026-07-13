import type { LucideIcon } from "lucide-react";

export function MetricCard({ detail, icon: Icon, label, value }: { detail?: string; icon?: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-muted">{label}</p>
        {Icon && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon aria-hidden="true" className="size-4" /></span>}
      </div>
      <div className="mt-3 text-2xl font-bold tabular-nums text-foreground">{value}</div>
      {detail && <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>}
    </article>
  );
}

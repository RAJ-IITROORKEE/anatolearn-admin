import type { ProgressMetric as ProgressMetricValue } from "@/features/progress/domain";

export function ProgressMetric({ label, metric }: { label: string; metric: ProgressMetricValue }) {
  if (metric.denominator === 0) {
    return (
      <div className="min-w-0 rounded-xl border border-border bg-subtle p-3">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p className="mt-1 text-sm font-bold text-body">No data</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-xl border border-border bg-subtle p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p className="font-bold tabular-nums text-foreground">{metric.percentage}%</p>
      </div>
      <div aria-label={`${label}: ${metric.percentage}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={metric.percentage} className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, metric.percentage))}%` }} />
      </div>
      <p className="mt-2 text-xs tabular-nums text-muted">{metric.numerator} of {metric.denominator}</p>
    </div>
  );
}

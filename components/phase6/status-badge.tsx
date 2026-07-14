import { cn } from "@/lib/utils";

export function Phase6StatusBadge({ status }: { status: string }) {
  const tone = status === "ACTIVE" || status === "RESOLVED"
    ? "bg-success-soft text-success"
    : status === "NEW" ? "bg-primary-soft text-primary"
      : status === "REVIEWED" ? "bg-warning-soft text-warning" : "bg-slate-100 text-slate-600";
  const label = status.replaceAll("_", " ").toLowerCase().replace(/^./, (value) => value.toUpperCase());
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", tone)}>{label}</span>;
}

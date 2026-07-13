import Link from "next/link";
import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const fieldClass = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
export const labelClass = "grid gap-2 text-sm font-semibold text-body";
export const panelClass = "rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6";

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "PUBLISHED" || status === "ACTIVE" ? "bg-success-soft text-success" : status === "ARCHIVED" || status === "INACTIVE" ? "bg-slate-100 text-slate-600" : "bg-primary-soft text-primary";
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", tone)}>{status.replaceAll("_", " ").toLowerCase().replace(/^./, (value) => value.toUpperCase())}</span>;
}

export function FilterBar({ children, defaultValue, placeholder = "Search" }: { children?: React.ReactNode; defaultValue?: string; placeholder?: string }) {
  return <form className="mb-5 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[minmax(220px,1fr)_auto_auto]" method="get">
    <label className="relative"><span className="sr-only">Search</span><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" /><input className={cn(fieldClass, "pl-9")} defaultValue={defaultValue} name="q" placeholder={placeholder} /></label>
    {children}
    <button className={buttonVariants({ variant: "outline" })} type="submit">Apply filters</button>
  </form>;
}

export function ResourceCards({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3">{children}</div>;
}

export function ResourceCard({ actions, children, href, title }: { actions?: React.ReactNode; children: React.ReactNode; href: string; title: string }) {
  return <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-primary/30 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><Link className="font-bold text-foreground hover:text-primary" href={href}>{title}</Link><div className="mt-2 text-sm text-muted">{children}</div></div>{actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}</div></article>;
}

export function ActionNotice({ state }: { state: { error?: string; success?: string } }) {
  if (!state.error && !state.success) return null;
  return <p className={cn("rounded-xl border p-3 text-sm font-medium", state.error ? "border-destructive/20 bg-destructive-soft text-destructive" : "border-success/20 bg-success-soft text-success")} role="status">{state.error ?? state.success}</p>;
}

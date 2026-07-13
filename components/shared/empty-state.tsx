import { Inbox, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: { href: string; label: string };
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ action, actionHref, actionLabel, description, icon: Icon = Inbox, title }: EmptyStateProps) {
  const resolvedAction = action ?? (actionHref && actionLabel ? { href: actionHref, label: actionLabel } : undefined);
  return (
    <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {resolvedAction && (
        <Link className={buttonVariants({ className: "mt-6" })} href={resolvedAction.href}>
          {resolvedAction.label}
        </Link>
      )}
    </section>
  );
}

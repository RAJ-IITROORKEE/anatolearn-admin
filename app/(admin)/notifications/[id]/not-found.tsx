import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotificationNotFound() {
  return <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm"><h1 className="text-2xl font-bold text-foreground">Notification campaign not found</h1><p className="mt-2 text-sm text-muted">The campaign does not exist or the identifier is invalid.</p><Link className={`${buttonVariants({ variant: "outline" })} mt-5`} href="/notifications">Back to notifications</Link></div>;
}

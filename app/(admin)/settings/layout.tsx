import Link from "next/link";
import { Settings } from "lucide-react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
    <aside className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2 px-3 pb-3 text-sm font-bold text-foreground"><Settings aria-hidden className="size-4 text-primary" />Settings</div>
      <nav aria-label="Settings" className="grid gap-1">
        <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href="/settings/profile">Profile</Link>
        <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href="/settings/security">Security</Link>
        <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href="/settings/trash">Trash</Link>
      </nav>
    </aside>
    <section className="min-w-0">{children}</section>
  </div>;
}

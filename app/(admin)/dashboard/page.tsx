import type { Metadata } from "next";
import { Activity, ArrowRight, DatabaseZap, LayoutDashboard } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { StatusAlert } from "@/components/shared/status-alert";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader description="A calm overview of learning content, assessments, and community activity." eyebrow="Overview" title="Dashboard" />
      <StatusAlert>Live dashboard metrics will appear after the data layer is connected. No demonstration values are shown.</StatusAlert>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
          <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary"><LayoutDashboard aria-hidden="true" className="size-5" /></span>
          <h2 className="mt-5 text-lg font-bold">Workspace foundation</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Responsive navigation, semantic design tokens, accessible state patterns, and testing foundations are ready for feature work.</p>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
          <span className="grid size-11 place-items-center rounded-xl bg-success-soft text-success"><DatabaseZap aria-hidden="true" className="size-5" /></span>
          <h2 className="mt-5 text-lg font-bold">Next: secure data access</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Supabase, Prisma, migrations, and server-enforced admin authentication are scheduled for Phase 2.</p>
          <Link className={buttonVariants({ className: "mt-5", variant: "outline", size: "sm" })} href="/login">Preview auth layout<ArrowRight aria-hidden="true" className="size-4" /></Link>
        </section>
      </div>
      <section className="mt-6 rounded-2xl border border-dashed border-border bg-subtle p-6 text-center sm:p-10">
        <Activity aria-hidden="true" className="mx-auto size-6 text-muted" />
        <h2 className="mt-3 font-bold">Activity will appear here</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Recent registrations, feedback, and content changes require the real application database. This area intentionally remains data-free.</p>
      </section>
    </>
  );
}

import {
  Activity,
  BookOpenText,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Layers3,
  LibraryBig,
  MessageSquareText,
  ShieldQuestion,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { AttemptsTrendChart } from "@/components/dashboard/attempts-trend-chart";
import type { AdminDashboardDto } from "@/features/admin-dashboard/dto";
import type { DashboardMetric } from "@/features/admin-dashboard/domain";
import { cn } from "@/lib/utils";

const panelClass = "rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6";
const focusLinkClass = "rounded-md font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function percent(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 10_000) / 100;
}

function boundedPercentage(value: number) {
  return Math.min(100, Math.max(0, value));
}

function ProgressTrack({ label, tone, value }: { label: string; tone: "primary" | "quiz" | "test" | "success"; value: number }) {
  const tones = { primary: "bg-primary", quiz: "bg-quiz", test: "bg-test", success: "bg-success" };
  return (
    <div aria-label={label} aria-valuemax={100} aria-valuemin={0} aria-valuenow={value} className="h-2.5 overflow-hidden rounded-full bg-subtle" role="progressbar">
      <div className={cn("dashboard-bar-fill h-full rounded-full", tones[tone])} style={{ width: `${boundedPercentage(value)}%` }} />
    </div>
  );
}

function SectionHeading({ description, id, title }: { description: string; id?: string; title: string }) {
  return <div><h2 className="text-lg font-bold text-foreground sm:text-xl" id={id}>{title}</h2><p className="mt-1 text-sm leading-6 text-muted">{description}</p></div>;
}

function AccuracyRow({ label, metric, tone }: { label: string; metric: DashboardMetric; tone: "quiz" | "test" }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div><p className="font-semibold text-foreground">{label}</p><p className="mt-1 text-xs tabular-nums text-muted">{metric.numerator} / {metric.denominator} ({metric.percentage}%)</p></div>
        <strong className={cn("text-xl tabular-nums", tone === "quiz" ? "text-quiz" : "text-test")}>{metric.percentage}%</strong>
      </div>
      <div className="mt-2"><ProgressTrack label={`${label} weighted accuracy`} tone={tone} value={metric.percentage} /></div>
    </div>
  );
}

function AllTimeOverview({ data }: { data: AdminDashboardDto }) {
  const learnerRatio = percent(data.counts.activeUsers, data.counts.totalUsers);
  const submittedAttempts = data.counts.completedQuizzes + data.counts.completedTests;
  const quizShare = percent(data.counts.completedQuizzes, submittedAttempts);
  const testShare = submittedAttempts === 0 ? 0 : 100 - quizShare;

  return (
    <section aria-labelledby="all-time-overview">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div><p className="text-xs font-semibold text-primary">Operational pulse</p><h2 className="mt-1 text-xl font-bold text-foreground sm:text-2xl" id="all-time-overview">All-time overview</h2></div>
        <p className="text-xs text-muted">Database-backed totals</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className={panelClass}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm font-semibold text-body">Active learners</p><p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">{data.counts.activeUsers.toLocaleString()}</p></div>
            <span className="grid size-10 place-items-center rounded-xl bg-success-soft text-success"><Users aria-hidden="true" className="size-5" /></span>
          </div>
          <div className="mt-4"><ProgressTrack label="Active learner ratio" tone="success" value={learnerRatio} /></div>
          <p className="mt-2 text-xs tabular-nums text-muted">{learnerRatio}% of {data.counts.totalUsers.toLocaleString()} learner accounts</p>
        </article>

        <section aria-label="All-time submitted attempts" className={panelClass}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm font-semibold text-body">Submitted attempts</p><p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">{submittedAttempts.toLocaleString()}</p></div>
            <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Activity aria-hidden="true" className="size-5" /></span>
          </div>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
            <div className="dashboard-bar-fill bg-quiz" style={{ width: `${quizShare}%` }} />
            <div className="dashboard-bar-fill bg-test" style={{ width: `${testShare}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold tabular-nums">
            <span className="text-quiz">{data.counts.completedQuizzes.toLocaleString()} quizzes</span>
            <span className="text-test">{data.counts.completedTests.toLocaleString()} tests</span>
          </div>
        </section>

        <article className={panelClass}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-body">Weighted accuracy</p>
            <span className="grid size-10 place-items-center rounded-xl bg-quiz-soft text-quiz"><CheckCircle2 aria-hidden="true" className="size-5" /></span>
          </div>
          <div className="mt-4 space-y-4"><AccuracyRow label="Quiz" metric={data.accuracy.quiz} tone="quiz" /><AccuracyRow label="Test" metric={data.accuracy.test} tone="test" /></div>
        </article>

        <article className={panelClass}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm font-semibold text-body">Feedback to review</p><p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">{data.counts.newFeedback.toLocaleString()}</p></div>
            <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><MessageSquareText aria-hidden="true" className="size-5" /></span>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">New, non-trashed learner feedback awaiting admin review.</p>
          <Link className={cn(focusLinkClass, "mt-3 inline-flex text-sm")} href="/feedback">Review feedback</Link>
        </article>
      </div>
    </section>
  );
}

type InventoryItem = { detail: string; icon: LucideIcon; label: string; value: number };

function ContentInventory({ data }: { data: AdminDashboardDto }) {
  const items: InventoryItem[] = [
    { detail: "Non-archived", icon: Boxes, label: "Organ systems", value: data.counts.organSystems },
    { detail: "Non-archived", icon: Layers3, label: "Topics", value: data.counts.topics },
    { detail: "Eligible and published", icon: BookOpenText, label: "Lessons", value: data.counts.publishedLessons },
    { detail: "Non-archived", icon: LibraryBig, label: "Flashcards", value: data.counts.flashcards },
    { detail: `${data.counts.quizQuestions.toLocaleString()} quiz / ${data.counts.testQuestions.toLocaleString()} test`, icon: ShieldQuestion, label: "Questions", value: data.counts.questions },
  ];
  return (
    <section aria-labelledby="content-inventory" className={panelClass}>
      <div className="flex flex-wrap items-end justify-between gap-3"><SectionHeading description="Current curriculum volume from all time, separated from the selected trend range." id="content-inventory" title="Content inventory" /><span className="rounded-full bg-subtle px-3 py-1 text-xs font-semibold text-muted">All time</span></div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(({ detail, icon: Icon, label, value }) => <div className="rounded-xl border border-border bg-subtle p-4" key={label}><div className="flex items-center justify-between gap-3"><dt className="text-sm font-semibold text-body">{label}</dt><Icon aria-hidden="true" className="size-4 text-primary" /></div><dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value.toLocaleString()}</dd><p className="mt-1 text-xs text-muted">{detail}</p></div>)}
      </dl>
    </section>
  );
}

function ReadinessBar({ label, metric, systemName, tone }: { label: string; metric: DashboardMetric; systemName: string; tone: "primary" | "quiz" | "test" | "success" }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(3rem,1fr)_auto] items-center gap-2 sm:grid-cols-[5.5rem_minmax(5rem,1fr)_auto] sm:gap-3">
      <span className="text-xs font-semibold text-body">{label}</span>
      <ProgressTrack label={`${systemName} ${label.toLowerCase()} readiness`} tone={tone} value={metric.percentage} />
      <span className="min-w-24 text-right text-xs tabular-nums text-muted">{metric.numerator}/{metric.denominator} · {metric.percentage}%</span>
    </div>
  );
}

function Completeness({ data }: { data: AdminDashboardDto }) {
  return (
    <section aria-labelledby="content-readiness" className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading description="Each bar shows eligible topics out of all non-archived topics in that system." id="content-readiness" title="Content readiness by organ system" />
        <span className="max-w-sm rounded-xl bg-success-soft px-3 py-2 text-xs leading-5 text-success">Ready requires a published active system and topic, plus an eligible lesson, flashcard, quiz question, and test question.</span>
      </div>
      {data.contentCompleteness.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-subtle p-6 text-center"><Boxes aria-hidden="true" className="mx-auto size-6 text-muted" /><p className="mt-3 font-bold">No organ systems available</p><p className="mt-1 text-sm text-muted">Add non-archived organ systems and topics to measure readiness.</p></div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {data.contentCompleteness.map((system) => <article aria-label={`${system.name} content readiness`} className="rounded-xl border border-border bg-subtle p-4 sm:p-5" key={system.id}>
            <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-bold text-foreground">{system.name}</h3><span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold tabular-nums text-success">{system.completeTopics.percentage}% ready</span></div>
            <div className="space-y-3">
              <ReadinessBar label="Ready" metric={system.completeTopics} systemName={system.name} tone="success" />
              <ReadinessBar label="Lessons" metric={system.lessons} systemName={system.name} tone="primary" />
              <ReadinessBar label="Flashcards" metric={system.flashcards} systemName={system.name} tone="success" />
              <ReadinessBar label="Quiz" metric={system.quizQuestions} systemName={system.name} tone="quiz" />
              <ReadinessBar label="Test" metric={system.testQuestions} systemName={system.name} tone="test" />
            </div>
          </article>)}
        </div>
      )}
    </section>
  );
}

function EmptyActivity({ title }: { title: string }) {
  return <div className="mt-5 rounded-xl border border-dashed border-border bg-subtle p-6 text-center"><Activity aria-hidden="true" className="mx-auto size-5 text-muted" /><p className="mt-2 text-sm font-semibold text-body">{title}</p></div>;
}

function ActivityFooter({ href, label }: { href: string; label: string }) {
  return <div className="mt-auto border-t border-border pt-4"><Link className={cn(focusLinkClass, "inline-flex text-sm")} href={href}>{label}</Link></div>;
}

function RecentActivity({ data }: { data: AdminDashboardDto }) {
  const registrations = data.recentRegistrations.slice(0, 5);
  const feedback = data.recentFeedback.slice(0, 5);
  const audit = data.recentAudit.slice(0, 5);
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <section aria-labelledby="recent-learners" className={cn(panelClass, "flex min-h-full flex-col")}>
        <SectionHeading description="Five newest learner accounts." id="recent-learners" title="Recent learners" />
        {registrations.length === 0 ? <EmptyActivity title="No recent learners" /> : <ul className="my-5 divide-y divide-border">{registrations.map((user) => <li className="flex gap-3 py-3 first:pt-0 last:pb-0" key={user.id}><span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><UserRound aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><Link className={cn(focusLinkClass, "truncate")} href={`/users/${encodeURIComponent(user.id)}`}>{user.fullName}</Link><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", user.isActive ? "bg-success-soft text-success" : "bg-subtle text-muted")}>{user.isActive ? "Active" : "Inactive"}</span></div><p className="mt-1 truncate text-xs text-muted">{user.email}</p><p className="mt-1 text-xs tabular-nums text-muted">Joined {formatDateTime(user.createdAt)}</p></div></li>)}</ul>}
        <ActivityFooter href="/users" label="Show all learners" />
      </section>

      <section aria-labelledby="recent-feedback" className={cn(panelClass, "flex min-h-full flex-col")}>
        <SectionHeading description="Five latest learner reports and requests." id="recent-feedback" title="Recent feedback" />
        {feedback.length === 0 ? <EmptyActivity title="No recent feedback" /> : <ul className="my-5 divide-y divide-border">{feedback.map((item) => <li className="flex gap-3 py-3 first:pt-0 last:pb-0" key={item.id}><span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><MessageSquareText aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><Link className={cn(focusLinkClass, "truncate")} href={`/feedback/${encodeURIComponent(item.id)}`}>{item.subject}</Link><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", item.status === "NEW" ? "bg-primary-soft text-primary" : item.status === "RESOLVED" ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>{humanize(item.status)}</span></div><p className="mt-1 text-xs text-muted">{humanize(item.type)} · {item.user?.fullName ?? "Anonymous learner"}</p><p className="mt-1 text-xs tabular-nums text-muted">{formatDateTime(item.createdAt)}</p></div></li>)}</ul>}
        <ActivityFooter href="/feedback" label="Show all feedback" />
      </section>

      <section aria-labelledby="recent-admin-activity" className={cn(panelClass, "flex min-h-full flex-col")}>
        <SectionHeading description="Five latest recorded administrative changes." id="recent-admin-activity" title="Recent admin activity" />
        {audit.length === 0 ? <EmptyActivity title="No recent admin activity" /> : <ul className="my-5 divide-y divide-border">{audit.map((entry) => {
          const href = `/audit-logs?entityType=${encodeURIComponent(entry.entityType)}&entityId=${encodeURIComponent(entry.entityId)}`;
          return <li className="flex gap-3 py-3 first:pt-0 last:pb-0" key={entry.id}><span className="grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-body"><ClipboardCheck aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><Link className={focusLinkClass} href={href}>{humanize(entry.action)} {humanize(entry.entityType)}</Link><p className="mt-1 text-xs text-muted">{entry.actor?.fullName ?? "System"}</p><p className="mt-1 text-xs tabular-nums text-muted">{formatDateTime(entry.createdAt)}</p></div></li>;
        })}</ul>}
        <ActivityFooter href="/audit-logs" label="Show all recent activities" />
      </section>
    </div>
  );
}

export function AdminDashboard({ data }: { data: AdminDashboardDto }) {
  return (
    <>
      <PageHeader
        action={<nav aria-label="Dashboard date range" className="flex rounded-xl border border-border bg-surface p-1">{([7, 30, 90] as const).map((days) => <Link aria-current={data.range.days === days ? "page" : undefined} className={cn("inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", data.range.days === days ? "bg-primary text-white" : "text-body hover:bg-subtle")} href={`/dashboard?days=${days}`} key={days}>{days} days</Link>)}</nav>}
        description="Real learning activity, assessment performance, curriculum readiness, and community signals."
        eyebrow="Overview"
        title="Dashboard"
      />
      <div className="-mt-4 mb-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><p>Updated {formatDateTime(data.generatedAt)}</p><p>Only the attempts trend changes with the selected date range. All other metrics are all time.</p></div>

      <div className="space-y-6">
        <AllTimeOverview data={data} />
        <div className="grid gap-6"><AttemptsTrendChart data={data.attemptsTrend} days={data.range.days} key={data.range.days} /><ContentInventory data={data} /></div>
        <Completeness data={data} />
        <RecentActivity data={data} />
      </div>
    </>
  );
}

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
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import type { AdminDashboardDto } from "@/features/admin-dashboard/dto";
import type { DashboardMetric } from "@/features/admin-dashboard/domain";
import { cn } from "@/lib/utils";

const panelClass = "rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6";
const focusLinkClass = "rounded-md font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type MetricCardProps = {
  accent: "primary" | "quiz" | "test" | "success";
  detail: string;
  icon: LucideIcon;
  label: string;
  value: number;
};

function MetricCard({ accent, detail, icon: Icon, label, value }: MetricCardProps) {
  const accents = {
    primary: "border-t-primary bg-primary-soft text-primary",
    quiz: "border-t-quiz bg-quiz-soft text-quiz",
    test: "border-t-test bg-test-soft text-test",
    success: "border-t-success bg-success-soft text-success",
  };

  return (
    <article className="rounded-2xl border border-t-2 border-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]" data-testid="dashboard-metric">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-body">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">{value.toLocaleString()}</p>
        </div>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl border-t-2", accents[accent])}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">{detail}</p>
    </article>
  );
}

function SectionHeading({ description, title }: { description: string; title: string }) {
  return <div><h2 className="text-lg font-bold text-foreground sm:text-xl">{title}</h2><p className="mt-1 text-sm leading-6 text-muted">{description}</p></div>;
}

function AttemptsTrend({ data }: { data: AdminDashboardDto }) {
  const quizTotal = data.attemptsTrend.reduce((total, day) => total + day.quizAttempts, 0);
  const testTotal = data.attemptsTrend.reduce((total, day) => total + day.testAttempts, 0);
  const hasAttempts = quizTotal + testTotal > 0;
  const max = Math.max(1, ...data.attemptsTrend.flatMap((day) => [day.quizAttempts, day.testAttempts]));
  const width = 720;
  const height = 220;
  const points = (key: "quizAttempts" | "testAttempts") => data.attemptsTrend.map((day, index) => {
    const x = data.attemptsTrend.length === 1 ? width / 2 : (index / Math.max(1, data.attemptsTrend.length - 1)) * width;
    const y = height - (day[key] / max) * (height - 24) - 12;
    return `${x},${y}`;
  }).join(" ");
  const summary = hasAttempts
    ? `${quizTotal} quiz attempts and ${testTotal} test attempts across ${data.attemptsTrend.length} days.`
    : "No attempts recorded in this range.";

  return (
    <section className={cn(panelClass, "xl:col-span-2")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeading description="Submitted quiz and test attempts by UTC completion date." title="Attempts trend" />
        <div className="flex gap-4 text-xs font-semibold">
          <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-quiz" />Quiz, solid line</span>
          <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-test" />Test, dashed line</span>
        </div>
      </div>
      <p className="mt-4 rounded-xl bg-subtle px-4 py-3 text-sm font-semibold text-body" id="attempts-summary">{summary}</p>
      {hasAttempts && (
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-subtle p-3" aria-hidden="true">
          <svg className="h-auto w-full" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
            {[0, 0.5, 1].map((position) => <line className="stroke-border" key={position} strokeWidth="1" x1="0" x2={width} y1={12 + position * (height - 24)} y2={12 + position * (height - 24)} />)}
            <polyline className="fill-none stroke-quiz" data-testid="quiz-trend-line" points={points("quizAttempts")} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" vectorEffect="non-scaling-stroke" />
            <polyline className="fill-none stroke-test" data-testid="test-trend-line" points={points("testAttempts")} strokeDasharray="10 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      )}
      <div className="mt-5 max-h-72 overflow-auto rounded-xl border border-border">
        <table aria-describedby="attempts-summary" aria-label="Attempts trend data" className="w-full min-w-96 text-left text-sm tabular-nums">
          <thead className="sticky top-0 bg-subtle text-xs font-semibold text-muted"><tr><th className="px-4 py-3">Date (UTC)</th><th className="px-4 py-3">Quiz</th><th className="px-4 py-3">Test</th></tr></thead>
          <tbody>{data.attemptsTrend.map((day) => <tr className="border-t border-border" key={day.date}><th className="px-4 py-3 font-medium text-body">{formatDay(day.date)}</th><td className="px-4 py-3 text-quiz">{day.quizAttempts}</td><td className="px-4 py-3 text-test">{day.testAttempts}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function AccuracyBar({ label, metric, tone }: { label: string; metric: DashboardMetric; tone: "quiz" | "test" }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div><p className="font-semibold text-foreground">{label}</p><p className="mt-1 text-sm tabular-nums text-muted">{metric.numerator} / {metric.denominator} ({metric.percentage}%)</p></div>
        <strong className={cn("text-xl tabular-nums", tone === "quiz" ? "text-quiz" : "text-test")}>{metric.percentage}%</strong>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label={`${label} weighted accuracy`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metric.percentage}>
        <div className={cn("h-full rounded-full", tone === "quiz" ? "bg-quiz" : "bg-test")} style={{ width: `${Math.min(100, Math.max(0, metric.percentage))}%` }} />
      </div>
    </div>
  );
}

function Accuracy({ data }: { data: AdminDashboardDto }) {
  return (
    <section className={panelClass}>
      <SectionHeading description="Correct answers divided by all submitted questions, including unanswered questions." title="Weighted accuracy" />
      <div className="mt-6 space-y-6"><AccuracyBar label="Quiz" metric={data.accuracy.quiz} tone="quiz" /><AccuracyBar label="Test" metric={data.accuracy.test} tone="test" /></div>
    </section>
  );
}

function Completeness({ data }: { data: AdminDashboardDto }) {
  return (
    <section className={cn(panelClass, "mt-6")}>
      <SectionHeading description="A topic is complete when its published, active system and published topic have an eligible lesson, flashcard, quiz question, and test question." title="Content readiness by organ system" />
      {data.contentCompleteness.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-subtle p-6 text-center"><Boxes aria-hidden="true" className="mx-auto size-6 text-muted" /><p className="mt-3 font-bold">No organ systems available</p><p className="mt-1 text-sm text-muted">Add non-archived organ systems and topics to measure readiness.</p></div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {data.contentCompleteness.map((system) => <article className="rounded-xl border border-border bg-subtle p-4" key={system.id}>
              <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-foreground">{system.name}</h3><span className="text-sm font-semibold tabular-nums text-success">{system.completeTopics.percentage}%</span></div>
              <p className="mt-1 text-xs tabular-nums text-muted">{system.completeTopics.numerator} of {system.completeTopics.denominator} non-archived topics complete</p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label={`${system.name} complete topics`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={system.completeTopics.percentage}><div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, Math.max(0, system.completeTopics.percentage))}%` }} /></div>
            </article>)}
          </div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-border">
            <table aria-label="Organ system content readiness data" className="w-full min-w-[760px] text-left text-sm tabular-nums">
              <thead className="bg-subtle text-xs font-semibold text-muted"><tr><th className="px-4 py-3">Organ system</th><th className="px-4 py-3">Complete</th><th className="px-4 py-3">Lessons</th><th className="px-4 py-3">Flashcards</th><th className="px-4 py-3">Quiz</th><th className="px-4 py-3">Test</th></tr></thead>
              <tbody>{data.contentCompleteness.map((system) => <tr className="border-t border-border" key={system.id}><th className="px-4 py-3 font-semibold text-foreground">{system.name}</th>{[system.completeTopics, system.lessons, system.flashcards, system.quizQuestions, system.testQuestions].map((metric, index) => <td className="px-4 py-3 text-body" key={index}>{metric.numerator} / {metric.denominator} ({metric.percentage}%)</td>)}</tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function EmptyActivity({ title }: { title: string }) {
  return <div className="mt-4 rounded-xl border border-dashed border-border bg-subtle p-5 text-center"><Activity aria-hidden="true" className="mx-auto size-5 text-muted" /><p className="mt-2 text-sm font-semibold text-body">{title}</p></div>;
}

function RecentActivity({ data }: { data: AdminDashboardDto }) {
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-3">
      <section className={panelClass}>
        <div className="flex items-start justify-between gap-3"><SectionHeading description="Newest learner accounts." title="Recent learners" /><Link className={focusLinkClass} href="/users">View all</Link></div>
        {data.recentRegistrations.length === 0 ? <EmptyActivity title="No recent learners" /> : <ul className="mt-4 divide-y divide-border">{data.recentRegistrations.map((user) => <li className="py-3 first:pt-0 last:pb-0" key={user.id}><Link className={focusLinkClass} href={`/users/${encodeURIComponent(user.id)}`}>{user.fullName}</Link><p className="mt-1 break-all text-xs text-muted">{user.email}</p><p className="mt-1 text-xs text-muted">{user.isActive ? "Active" : "Inactive"} · Joined {formatDateTime(user.createdAt)}</p></li>)}</ul>}
      </section>
      <section className={panelClass}>
        <div className="flex items-start justify-between gap-3"><SectionHeading description="Latest learner reports and requests." title="Recent feedback" /><Link className={focusLinkClass} href="/feedback">View all</Link></div>
        {data.recentFeedback.length === 0 ? <EmptyActivity title="No recent feedback" /> : <ul className="mt-4 divide-y divide-border">{data.recentFeedback.map((feedback) => <li className="py-3 first:pt-0 last:pb-0" key={feedback.id}><Link className={focusLinkClass} href="/feedback">{feedback.subject}</Link><p className="mt-1 text-xs text-muted">{humanize(feedback.type)} · {humanize(feedback.status)}</p><p className="mt-1 text-xs text-muted">{feedback.user?.fullName ?? "Anonymous learner"} · {formatDateTime(feedback.createdAt)}</p></li>)}</ul>}
      </section>
      <section className={panelClass}>
        <div className="flex items-start justify-between gap-3"><SectionHeading description="Latest recorded administrative changes." title="Recent admin activity" /><Link className={focusLinkClass} href="/audit-logs">View all</Link></div>
        {data.recentAudit.length === 0 ? <EmptyActivity title="No recent admin activity" /> : <ul className="mt-4 divide-y divide-border">{data.recentAudit.map((entry) => <li className="py-3 first:pt-0 last:pb-0" key={entry.id}><Link className={focusLinkClass} href="/audit-logs">{humanize(entry.action)} {humanize(entry.entityType)}</Link><p className="mt-1 text-xs text-muted">{entry.actor?.fullName ?? "System"} · {formatDateTime(entry.createdAt)}</p></li>)}</ul>}
      </section>
    </div>
  );
}

export function AdminDashboard({ data }: { data: AdminDashboardDto }) {
  const submittedAttempts = data.counts.completedQuizzes + data.counts.completedTests;
  const metrics: MetricCardProps[] = [
    { accent: "primary", detail: "All learner profiles", icon: Users, label: "Learners", value: data.counts.totalUsers },
    { accent: "success", detail: "Learners currently able to sign in", icon: CheckCircle2, label: "Active learners", value: data.counts.activeUsers },
    { accent: "primary", detail: "Non-archived curriculum systems", icon: Boxes, label: "Organ systems", value: data.counts.organSystems },
    { accent: "primary", detail: "Non-archived curriculum topics", icon: Layers3, label: "Topics", value: data.counts.topics },
    { accent: "success", detail: "Eligible published lessons", icon: BookOpenText, label: "Published lessons", value: data.counts.publishedLessons },
    { accent: "success", detail: "Non-archived study cards", icon: LibraryBig, label: "Flashcards", value: data.counts.flashcards },
    { accent: "quiz", detail: "Non-archived quiz questions", icon: ShieldQuestion, label: "Quiz questions", value: data.counts.quizQuestions },
    { accent: "test", detail: "Non-archived test questions", icon: ClipboardCheck, label: "Test questions", value: data.counts.testQuestions },
    { accent: "primary", detail: `${data.counts.completedQuizzes.toLocaleString()} quizzes · ${data.counts.completedTests.toLocaleString()} tests`, icon: Activity, label: "Submitted attempts", value: submittedAttempts },
    { accent: "primary", detail: "Feedback awaiting review", icon: MessageSquareText, label: "New feedback", value: data.counts.newFeedback },
  ];

  return (
    <>
      <PageHeader
        action={<nav aria-label="Dashboard date range" className="flex rounded-xl border border-border bg-surface p-1">{([7, 30, 90] as const).map((days) => <Link aria-current={data.range.days === days ? "page" : undefined} className={cn("inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", data.range.days === days ? "bg-primary text-white" : "text-body hover:bg-subtle")} href={`/dashboard?days=${days}`} key={days}>{days} days</Link>)}</nav>}
        description="Real learning content, assessment performance, and community activity from the application database."
        eyebrow="Overview"
        title="Dashboard"
      />
      <p className="-mt-4 mb-6 text-xs text-muted">Updated {formatDateTime(data.generatedAt)}</p>
      <section aria-label="Dashboard metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{metrics.map((metric) => <MetricCard {...metric} key={metric.label} />)}</section>
      <div className="mt-6 grid gap-6 xl:grid-cols-3"><AttemptsTrend data={data} /><Accuracy data={data} /></div>
      <Completeness data={data} />
      <RecentActivity data={data} />
    </>
  );
}

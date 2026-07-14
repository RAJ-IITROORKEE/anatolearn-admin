import { Activity, CalendarDays, ClipboardCheck, Smartphone, Target } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { AssessmentTypeBadge, AttemptStatusBadge, type AssessmentType, type AttemptStatus } from "@/components/assessments/badges";
import { formatDateTime } from "@/components/assessments/format";
import { MetricCard } from "@/components/assessments/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmedAction } from "@/components/phase6/confirmed-action";
import { changeUserActivityAction } from "@/app/(admin)/phase6-actions";
import { ProgressCard, type ProgressSystem } from "./progress-card";

type RecentAttempt = {
  id: string; assessmentType: AssessmentType; status: AttemptStatus;
  scorePercentage: number; correctCount: number; totalQuestionCount: number;
  completedAt: Date | null; organSystemName: string | null;
};
type RankedTopic = { topicId: string; topicTitle: string; correctCount: number; sampleCount: number; accuracyPercentage: number };
export type UserProgressData = {
  profile: { fullName: string; email: string; isActive: boolean; createdAt: Date; lastLoginAt: Date | null };
  attempts: { total: number; quiz: number; test: number; autoSubmitted: number };
  accuracy: { numerator: number; denominator: number; percentage: number };
  recentAttempts: RecentAttempt[];
  organSystems: ProgressSystem[];
  strengths: RankedTopic[];
  weaknesses: RankedTopic[];
};
type ManagementData = { userId: string; devices: { total: number; active: number; inactive: number }; activity: { attempts: number; submittedAttempts: number; feedback: number; lastAttemptAt: Date | null } };

function Ranking({ items, title }: { items: RankedTopic[]; title: string }) {
  return <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"><h3 className="font-bold text-foreground">{title}</h3><ol className="mt-3 grid gap-2">{items.map((item) => <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-subtle px-3 py-2 text-sm" key={item.topicId}><span className="min-w-0 break-words font-semibold text-body">{item.topicTitle}</span><span className="tabular-nums text-muted">{item.accuracyPercentage}% · {item.sampleCount} answers</span></li>)}</ol></section>;
}

export function UserProgress({ data, management }: { data: UserProgressData; management: ManagementData }) {
  const hasRankings = data.strengths.length > 0 || data.weaknesses.length > 0;
  return (
    <>
      <PageHeader action={<ConfirmedAction action={changeUserActivityAction.bind(null, management.userId, !data.profile.isActive)} confirmLabel={`${data.profile.isActive ? "Deactivate" : "Activate"} user`} description={data.profile.isActive ? "Access and active device tokens will be disabled. Learning history is preserved." : "Access will be restored. Device tokens remain inactive until registered again."} destructive={data.profile.isActive} title={`${data.profile.isActive ? "Deactivate" : "Activate"} ${data.profile.fullName}?`}>{data.profile.isActive ? "Deactivate" : "Activate"}</ConfirmedAction>} description="Account access, learning activity, and weighted assessment performance." eyebrow="User profile" title={data.profile.fullName} />
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6" aria-labelledby="profile-summary">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="text-lg font-bold text-foreground" id="profile-summary">Profile summary</h2><p className="mt-1 break-all text-sm text-muted">{data.profile.email}</p></div>
          <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${data.profile.isActive ? "bg-success-soft text-success" : "bg-slate-100 text-slate-600"}`}>{data.profile.isActive ? "Active account" : "Inactive account"}</span>
        </div>
        <dl className="mt-5 grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="font-semibold text-muted">Joined</dt><dd className="mt-1 tabular-nums text-body">{formatDateTime(data.profile.createdAt)}</dd></div>
          <div><dt className="font-semibold text-muted">Last login</dt><dd className="mt-1 tabular-nums text-body">{formatDateTime(data.profile.lastLoginAt)}</dd></div>
          <div><dt className="font-semibold text-muted">Registered devices</dt><dd className="mt-1 tabular-nums text-body">{management.devices.total} total · {management.devices.active} active · {management.devices.inactive} inactive</dd></div>
          <div><dt className="font-semibold text-muted">Last attempt</dt><dd className="mt-1 tabular-nums text-body">{formatDateTime(management.activity.lastAttemptAt)}</dd></div>
        </dl>
      </section>

      <section className="mt-6" aria-labelledby="progress-summary">
        <h2 className="sr-only" id="progress-summary">Progress summary</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={Target} label="Weighted accuracy" value={data.accuracy.denominator ? `${data.accuracy.percentage}%` : "No data"} detail={data.accuracy.denominator ? `${data.accuracy.numerator} correct of ${data.accuracy.denominator} submitted answers` : "No submitted answers yet."} />
          <MetricCard icon={ClipboardCheck} label="Submitted attempts" value={data.attempts.total} detail={`${data.attempts.quiz} quiz · ${data.attempts.test} test`} />
          <MetricCard icon={Activity} label="Auto-submitted" value={data.attempts.autoSubmitted} detail="Included in submitted attempt totals" />
          <MetricCard icon={CalendarDays} label="Recent activity" value={data.recentAttempts.length} detail="Up to 10 latest submitted attempts" />
          <MetricCard icon={Smartphone} label="Feedback submitted" value={management.activity.feedback} detail={`${management.activity.attempts} total attempts`} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="recent-attempts">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-foreground" id="recent-attempts">Recent attempts</h2><Link className="text-sm font-semibold text-primary hover:underline" href={`/attempts?q=${encodeURIComponent(data.profile.email)}`}>View all attempts</Link></div>
        {data.recentAttempts.length ? <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">{data.recentAttempts.map((attempt) => <Link className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={`/attempts/${attempt.id}`} key={attempt.id}>
          <div className="flex flex-wrap gap-2"><AssessmentTypeBadge type={attempt.assessmentType} /><AttemptStatusBadge status={attempt.status} /></div>
          <p className="mt-3 break-words font-bold text-foreground">{attempt.organSystemName ?? "Organ system unavailable"}</p>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm"><span className="tabular-nums text-body">{attempt.scorePercentage}% · {attempt.correctCount} of {attempt.totalQuestionCount} correct</span><span className="text-muted">{formatDateTime(attempt.completedAt)}</span></div>
        </Link>)}</div> : <div className="mt-4"><EmptyState description="This user has no completed or auto-submitted attempts yet." title="No submitted attempts" /></div>}
      </section>

      <section className="mt-8" aria-labelledby="topic-insights">
        <h2 className="text-xl font-bold text-foreground" id="topic-insights">Topic insights</h2>
        {hasRankings ? <div className="mt-4 grid gap-4 lg:grid-cols-2">{data.strengths.length > 0 && <Ranking items={data.strengths} title="Strengths" />}{data.weaknesses.length > 0 && <Ranking items={data.weaknesses} title="Needs review" />}</div> : <p className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-5 text-sm leading-6 text-muted">Not enough assessment data yet. A topic needs at least five submitted answers before it appears here.</p>}
      </section>

      <section className="mt-8" aria-labelledby="system-progress">
        <h2 className="text-xl font-bold text-foreground" id="system-progress">Progress by organ system</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Completion and accuracy are calculated from currently published learning content and submitted answer history.</p>
        {data.organSystems.length ? <div className="mt-4 grid gap-4">{data.organSystems.map((system) => <ProgressCard key={system.id} system={system} />)}</div> : <div className="mt-4"><EmptyState description="No published organ systems are available for progress reporting." title="No progress areas available" /></div>}
      </section>
    </>
  );
}

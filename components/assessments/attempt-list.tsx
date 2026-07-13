import { ArrowRight, Clock3 } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { AssessmentTypeBadge, AttemptStatusBadge, type AssessmentType, type AttemptStatus } from "./badges";
import { formatDateTime, formatDuration } from "./format";

export type AttemptListItem = {
  id: string;
  user: { id: string; fullName: string; email: string; isActive: boolean };
  assessmentType: AssessmentType;
  status: AttemptStatus;
  organSystemId: string;
  topicIds: string[];
  totalQuestionCount: number;
  startedAt: Date;
  completedAt: Date | null;
  scorePercentage?: number;
  correctCount?: number;
  durationSeconds?: number | null;
};

function topicSummary(topicIds: string[], topicLabels: Map<string, string>) {
  const labels = [...new Set(topicIds.map((id) => topicLabels.get(id)).filter((label): label is string => Boolean(label)))];
  if (!labels.length) return topicIds.length === 1 ? "1 topic" : `${topicIds.length} topics`;
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

function Result({ attempt }: { attempt: AttemptListItem }) {
  const submitted = attempt.status === "COMPLETED" || attempt.status === "AUTO_SUBMITTED";
  if (!submitted) return <span className="text-sm text-muted">Result pending</span>;
  return (
    <div className="tabular-nums">
      <p className="font-bold text-foreground">{attempt.scorePercentage}%</p>
      <p className="mt-1 text-xs text-muted">{attempt.correctCount} of {attempt.totalQuestionCount} correct</p>
    </div>
  );
}

function Timing({ attempt }: { attempt: AttemptListItem }) {
  return (
    <div className="text-sm">
      <p className="text-body">{formatDateTime(attempt.startedAt)}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><Clock3 aria-hidden="true" className="size-3.5" />{attempt.completedAt ? `Completed ${formatDateTime(attempt.completedAt)}` : "Not completed"}</p>
      {(attempt.status === "COMPLETED" || attempt.status === "AUTO_SUBMITTED") && <p className="mt-1 text-xs tabular-nums text-muted">Duration {formatDuration(attempt.durationSeconds)}</p>}
    </div>
  );
}

export function AttemptList({ attempts, systemLabels, topicLabels }: { attempts: AttemptListItem[]; systemLabels: Map<string, string>; topicLabels: Map<string, string> }) {
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-separate border-spacing-y-2 text-left">
          <caption className="sr-only">Assessment attempts</caption>
          <thead><tr className="text-xs font-semibold text-muted"><th className="px-4 pb-1">Learner</th><th className="px-4 pb-1">Assessment</th><th className="px-4 pb-1">Result</th><th className="px-4 pb-1">Timing</th><th className="px-4 pb-1"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {attempts.map((attempt) => <tr className="group rounded-2xl bg-surface shadow-sm" key={attempt.id}>
              <td className="rounded-l-2xl border-y border-l border-border px-4 py-4 align-top">
                <Link className="font-bold text-foreground hover:text-primary" href={`/users/${attempt.user.id}`}>{attempt.user.fullName}</Link>
                <p className="mt-1 max-w-56 break-all text-xs text-muted">{attempt.user.email}</p>
              </td>
              <td className="border-y border-border px-4 py-4 align-top">
                <div className="flex flex-wrap gap-2"><AssessmentTypeBadge type={attempt.assessmentType} /><AttemptStatusBadge status={attempt.status} /></div>
                <p className="mt-2 text-sm font-semibold text-body">{systemLabels.get(attempt.organSystemId) ?? "Organ system unavailable"}</p>
                <p className="mt-1 max-w-64 text-xs text-muted">{topicSummary(attempt.topicIds, topicLabels)}</p>
              </td>
              <td className="border-y border-border px-4 py-4 align-top"><Result attempt={attempt} /></td>
              <td className="border-y border-border px-4 py-4 align-top"><Timing attempt={attempt} /></td>
              <td className="rounded-r-2xl border-y border-r border-border px-4 py-4 text-right align-middle">
                <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={`/attempts/${attempt.id}`}>View detail<ArrowRight aria-hidden="true" className="size-4" /></Link>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {attempts.map((attempt) => <article className={cn("rounded-2xl border bg-surface p-4 shadow-sm", attempt.assessmentType === "QUIZ" ? "border-quiz/20" : "border-test/20")} key={attempt.id}>
          <div className="flex flex-wrap items-center gap-2"><AssessmentTypeBadge type={attempt.assessmentType} /><AttemptStatusBadge status={attempt.status} /></div>
          <Link className="mt-3 block text-base font-bold text-foreground hover:text-primary" href={`/users/${attempt.user.id}`}>{attempt.user.fullName}</Link>
          <p className="mt-1 break-all text-xs text-muted">{attempt.user.email}</p>
          <div className="mt-4 grid gap-3 border-y border-border py-4 sm:grid-cols-2">
            <div><p className="text-xs font-semibold text-muted">Coverage</p><p className="mt-1 text-sm font-semibold text-body">{systemLabels.get(attempt.organSystemId) ?? "Organ system unavailable"}</p><p className="mt-1 text-xs text-muted">{topicSummary(attempt.topicIds, topicLabels)}</p></div>
            <div><p className="text-xs font-semibold text-muted">Result</p><div className="mt-1"><Result attempt={attempt} /></div></div>
            <div className="sm:col-span-2"><p className="text-xs font-semibold text-muted">Timing</p><div className="mt-1"><Timing attempt={attempt} /></div></div>
          </div>
          <div className="mt-3 flex justify-end"><Link className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={`/attempts/${attempt.id}`}>View detail<ArrowRight aria-hidden="true" className="size-4" /></Link></div>
        </article>)}
      </div>
    </>
  );
}

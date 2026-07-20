import { CheckCircle2, CircleX, Clock3, HelpCircle, Percent } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { AnswerBreakdown, type AnswerQuestion, type AttemptMediaReference } from "./answer-breakdown";
import { AssessmentTypeBadge, AttemptStatusBadge, type AssessmentType, type AttemptStatus } from "./badges";
import { formatDateTime, formatDuration } from "./format";
import { MetricCard } from "./metric-card";

export type AttemptDetailData = {
  id: string;
  user: { id: string; fullName: string; email: string; isActive: boolean };
  assessmentType: AssessmentType;
  status: AttemptStatus;
  totalQuestionCount: number;
  startedAt: Date;
  expiresAt: Date | null;
  completedAt: Date | null;
  timeLimitSeconds: number | null;
  retakeSourceId: string | null;
  scorePercentage?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  durationSeconds?: number | null;
  questions: Array<AnswerQuestion & { id: string; organSystemName: string }>;
};

export function AttemptDetail({ attempt, mediaById = new Map() }: { attempt: AttemptDetailData; mediaById?: ReadonlyMap<string, AttemptMediaReference> }) {
  const submitted = attempt.status === "COMPLETED" || attempt.status === "AUTO_SUBMITTED";
   const systemNames = [...new Set(attempt.questions.map((question) => question.organSystemName))];
   const systemName = systemNames.length > 1 ? "Mixed systems" : systemNames[0] ?? "Organ system unavailable";
  const topicNames = [...new Set(attempt.questions.map((question) => question.topicTitle))];

  return (
    <>
      <PageHeader description={`Read-only ${attempt.assessmentType === "QUIZ" ? "quiz" : "test"} history for ${attempt.user.fullName}.`} eyebrow="Assessment attempt" title={`${attempt.user.fullName}'s ${attempt.assessmentType === "QUIZ" ? "quiz" : "test"} attempt`} />

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6" aria-labelledby="attempt-overview">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2"><AssessmentTypeBadge type={attempt.assessmentType} /><AttemptStatusBadge status={attempt.status} /></div>
            <h2 className="mt-4 text-xl font-bold text-foreground" id="attempt-overview">{systemName}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{topicNames.length ? topicNames.join(", ") : "No topic snapshot is available."}</p>
          </div>
          <div className="shrink-0 text-sm">
            <p className="font-semibold text-muted">Learner</p>
            <Link className="mt-1 block font-bold text-primary hover:underline" href={`/users/${attempt.user.id}`}>{attempt.user.fullName}</Link>
            <p className="mt-1 break-all text-muted">{attempt.user.email}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="font-semibold text-muted">Started</dt><dd className="mt-1 tabular-nums text-body">{formatDateTime(attempt.startedAt)}</dd></div>
          <div><dt className="font-semibold text-muted">Completed</dt><dd className="mt-1 tabular-nums text-body">{formatDateTime(attempt.completedAt)}</dd></div>
          <div><dt className="font-semibold text-muted">Time limit</dt><dd className="mt-1 tabular-nums text-body">{attempt.timeLimitSeconds === null ? "Untimed" : formatDuration(attempt.timeLimitSeconds)}</dd></div>
          <div><dt className="font-semibold text-muted">Expires</dt><dd className="mt-1 tabular-nums text-body">{formatDateTime(attempt.expiresAt)}</dd></div>
        </dl>
        {attempt.retakeSourceId && <p className="mt-5 border-t border-border pt-4 text-sm text-muted">Retake lineage: <Link className="font-bold text-primary hover:underline" href={`/attempts/${attempt.retakeSourceId}`}>View previous attempt</Link></p>}
      </section>

      {submitted && <section className="mt-6" aria-labelledby="result-metrics">
        <h2 className="sr-only" id="result-metrics">Result metrics</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={Percent} label="Score" value={`${attempt.scorePercentage}%`} />
          <MetricCard icon={CheckCircle2} label="Correct" value={attempt.correctCount} />
          <MetricCard icon={CircleX} label="Incorrect" value={attempt.incorrectCount} />
          <MetricCard icon={HelpCircle} label="Unanswered" value={attempt.unansweredCount} />
          <MetricCard icon={Clock3} label="Duration" value={formatDuration(attempt.durationSeconds)} />
        </div>
      </section>}

      <section className="mt-8" aria-labelledby="answer-breakdown">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground" id="answer-breakdown">Answer breakdown</h2>
          <p className="mt-1 text-sm leading-6 text-muted">Questions and options are shown in their original snapshot order.</p>
        </div>
        <ol className="grid gap-4">
          {attempt.questions.map((question) => <li key={question.id}><AnswerBreakdown mediaById={mediaById} question={question} status={attempt.status} /></li>)}
        </ol>
      </section>
    </>
  );
}

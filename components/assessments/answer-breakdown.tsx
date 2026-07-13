import { CheckCircle2, Circle, CircleX, MinusCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDuration } from "./format";
import type { AttemptStatus } from "./badges";

type AnswerOption = {
  key: string;
  label: string;
  displayOrder: number;
  optionText: string;
  imageUrl?: string | null;
  mediaId?: string | null;
};

export type AttemptMediaReference = { id: string; signedUrl: string; width: number | null; height: number | null; altText: string };

export type AnswerQuestion = {
  displayOrder: number;
  questionText: string;
  topicTitle: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  conceptTag?: string | null;
  imageUrl?: string | null;
  mediaId?: string | null;
  answeredOptionKey: string | null;
  timeSpentSeconds: number | null;
  options: AnswerOption[];
  correctOptionKey?: string;
  isCorrect?: boolean | null;
  explanation?: string;
};

function SnapshotImage({ alt, legacyUrl, mediaId, mediaById }: { alt: string; legacyUrl?: string | null; mediaId?: string | null; mediaById: ReadonlyMap<string, AttemptMediaReference> }) {
  const managed = mediaId ? mediaById.get(mediaId) : undefined;
  const src = managed?.signedUrl ?? legacyUrl;
  if (!src) return null;
  return <div className="mt-3 flex max-h-96 justify-center overflow-hidden rounded-xl bg-subtle p-2">
    {/* Snapshot records do not retain source alt text, so the attempt context supplies the accessible label. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt={alt} className="h-auto max-h-92 w-auto max-w-full object-contain" height={managed?.height ?? undefined} src={src} width={managed?.width ?? undefined} />
  </div>;
}

export function AnswerBreakdown({ mediaById = new Map(), question, status }: { mediaById?: ReadonlyMap<string, AttemptMediaReference>; question: AnswerQuestion; status: AttemptStatus }) {
  const submitted = status === "COMPLETED" || status === "AUTO_SUBMITTED";
  const unanswered = question.answeredOptionKey === null;
  const state = !submitted
    ? (unanswered ? "Unanswered" : "Response recorded")
    : unanswered
      ? "Unanswered"
      : question.isCorrect
        ? "Correct"
        : "Incorrect";
  const StateIcon = !submitted ? Circle : unanswered ? MinusCircle : question.isCorrect ? CheckCircle2 : CircleX;

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted">Question {question.displayOrder}</p>
          <h3 className="mt-1 text-base font-bold leading-6 text-foreground sm:text-lg">{question.questionText}</h3>
          <p className="mt-2 text-sm text-muted">
            {question.topicTitle} · {question.difficulty.toLowerCase()}{question.conceptTag ? ` · ${question.conceptTag}` : ""}
          </p>
        </div>
        <span className={cn(
          "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
          submitted && question.isCorrect ? "bg-success-soft text-success" : submitted && !unanswered ? "bg-destructive-soft text-destructive" : "bg-slate-100 text-slate-600",
        )}>
          <StateIcon aria-hidden="true" className="size-3.5" />{state}
        </span>
      </div>

      <SnapshotImage alt={`Question ${question.displayOrder} image`} legacyUrl={question.imageUrl} mediaById={mediaById} mediaId={question.mediaId} />

      <ol className="mt-5 grid gap-2" aria-label={`Options for question ${question.displayOrder}`}>
        {question.options.map((option) => {
          const selected = option.key === question.answeredOptionKey;
          const correct = submitted && option.key === question.correctOptionKey;
          return (
            <li className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm", correct ? "border-success/30 bg-success-soft" : selected ? "border-primary/30 bg-primary-soft" : "bg-subtle")} key={option.key}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full border bg-surface font-bold text-body">{option.label}</span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="leading-6 text-body">{option.optionText}</p>
                <SnapshotImage alt={`Option ${option.label} image`} legacyUrl={option.imageUrl} mediaById={mediaById} mediaId={option.mediaId} />
                {(selected || correct) && <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
                  {selected && <span className="text-primary">Selected answer</span>}
                  {correct && <span className="text-success">Correct answer</span>}
                </p>}
              </div>
            </li>
          );
        })}
      </ol>

      {submitted && <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_auto]">
        <div>
          <h4 className="text-sm font-bold text-foreground">Explanation</h4>
          <p className="mt-1 text-sm leading-6 text-body">{question.explanation || "No explanation was recorded in the snapshot."}</p>
        </div>
        <p className="text-sm text-muted">Time spent <strong className="tabular-nums text-foreground">{formatDuration(question.timeSpentSeconds)}</strong></p>
      </div>}
    </article>
  );
}

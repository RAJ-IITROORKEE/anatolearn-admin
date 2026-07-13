import { cn } from "@/lib/utils";

export type AssessmentType = "QUIZ" | "TEST";
export type AttemptStatus = "IN_PROGRESS" | "COMPLETED" | "AUTO_SUBMITTED" | "ABANDONED";

const badgeClass = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold";

export function AssessmentTypeBadge({ type }: { type: AssessmentType }) {
  return (
    <span className={cn(badgeClass, type === "QUIZ" ? "bg-quiz-soft text-quiz" : "bg-test-soft text-test")}>
      {type === "QUIZ" ? "Quiz" : "Test"}
    </span>
  );
}

const statusStyles: Record<AttemptStatus, string> = {
  IN_PROGRESS: "bg-primary-soft text-primary",
  COMPLETED: "bg-success-soft text-success",
  AUTO_SUBMITTED: "bg-warning-soft text-warning",
  ABANDONED: "bg-slate-100 text-slate-600",
};

const statusLabels: Record<AttemptStatus, string> = {
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  AUTO_SUBMITTED: "Auto-submitted",
  ABANDONED: "Abandoned",
};

export function AttemptStatusBadge({ status }: { status: AttemptStatus }) {
  return <span className={cn(badgeClass, statusStyles[status])}>{statusLabels[status]}</span>;
}

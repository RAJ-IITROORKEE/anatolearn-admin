import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { InlineAction } from "@/components/phase3/action-form";
import { StatusBadge } from "@/components/phase3/admin-ui";
import { listAdmin } from "@/components/phase3/data";
import { QuestionForm } from "@/components/questions/question-form";
import { getQuestion } from "@/features/questions/service";
import { changeQuestionActivityAction, changeQuestionStatusAction, duplicateQuestionAction, updateQuestionAction } from "../../phase4-actions";

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item;
  try { item = await getQuestion(id); } catch { notFound(); }
  const topics = await listAdmin("topic", { page: 1, pageSize: 100, sortBy: "title", sortOrder: "asc" });
  const quiz = item.assessmentType === "QUIZ";
  return <><PageHeader action={<div className="flex flex-wrap gap-2"><span className={quiz ? "rounded-full bg-quiz-soft px-2.5 py-1 text-xs font-bold text-quiz" : "rounded-full bg-test-soft px-2.5 py-1 text-xs font-bold text-test"}>{quiz ? "Quiz" : "Test"}</span><StatusBadge status={item.status} /><StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />{item.status === "DRAFT" && <InlineAction action={changeQuestionStatusAction.bind(null, id, "PUBLISHED")}>Publish</InlineAction>}{item.status === "PUBLISHED" && <InlineAction action={changeQuestionStatusAction.bind(null, id, "DRAFT")}>Move to draft</InlineAction>}{item.status !== "ARCHIVED" && <InlineAction action={changeQuestionActivityAction.bind(null, id, !item.isActive)}>{item.isActive ? "Deactivate" : "Activate"}</InlineAction>}<InlineAction action={duplicateQuestionAction.bind(null, id)}>Duplicate</InlineAction>{item.status !== "ARCHIVED" && <InlineAction action={changeQuestionStatusAction.bind(null, id, "ARCHIVED")} confirmMessage="Archive this question? This cannot be undone.">Archive</InlineAction>}</div>} description="Edit atomic answer options, preview the learner view, and manage lifecycle and activity." eyebrow={quiz ? "Quiz assessment" : "Test assessment"} title={item.questionText} /><QuestionForm action={updateQuestionAction.bind(null, id)} assessmentType={item.assessmentType} item={item} topics={topics.items.map((topic) => ({ id: topic.id, label: topic.title }))} /></>;
}

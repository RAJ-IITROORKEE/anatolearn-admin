import { PageHeader } from "@/components/app-shell/page-header";
import { listAdmin } from "@/components/phase3/data";
import { QuestionForm } from "@/components/questions/question-form";
import { createQuestionAction } from "../../../phase4-actions";
export default async function NewQuizQuestionPage() { const topics = await listAdmin("topic", { page: 1, pageSize: 100, sortBy: "title", sortOrder: "asc" }); return <><PageHeader description="Build an untimed quiz question with one correct answer and a learner explanation." eyebrow="Quiz assessment" title="Add quiz question" /><QuestionForm action={createQuestionAction} assessmentType="QUIZ" topics={topics.items.map((topic) => ({ id: topic.id, label: topic.title }))} /></>; }

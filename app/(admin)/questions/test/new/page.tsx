import { PageHeader } from "@/components/app-shell/page-header";
import { listAdmin } from "@/components/phase3/data";
import { QuestionForm } from "@/components/questions/question-form";
import { createQuestionAction } from "../../../phase4-actions";
export default async function NewTestQuestionPage() { const topics = await listAdmin("topic", { page: 1, pageSize: 100, sortBy: "title", sortOrder: "asc" }); return <><PageHeader description="Build a timed test question with one correct answer and a learner explanation." eyebrow="Test assessment" title="Add test question" /><QuestionForm action={createQuestionAction} assessmentType="TEST" topics={topics.items.map((topic) => ({ id: topic.id, label: topic.title }))} /></>; }

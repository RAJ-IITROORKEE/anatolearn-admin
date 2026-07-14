import type { Metadata } from "next";
import { QuestionListPage } from "@/components/questions/question-list-page";
export const metadata: Metadata = { title: "Quiz questions" };
export default function QuizQuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <QuestionListPage assessmentType="QUIZ" searchParams={searchParams} />; }

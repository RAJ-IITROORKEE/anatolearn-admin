import type { Metadata } from "next";
import { QuestionListPage } from "@/components/questions/question-list-page";
export const metadata: Metadata = { title: "Test questions" };
export default function TestQuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <QuestionListPage assessmentType="TEST" searchParams={searchParams} />; }

import { QuestionListPage } from "@/components/questions/question-list-page";
export default function TestQuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <QuestionListPage assessmentType="TEST" searchParams={searchParams} />; }

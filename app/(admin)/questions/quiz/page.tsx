import { QuestionListPage } from "@/components/questions/question-list-page";
export default function QuizQuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <QuestionListPage assessmentType="QUIZ" searchParams={searchParams} />; }

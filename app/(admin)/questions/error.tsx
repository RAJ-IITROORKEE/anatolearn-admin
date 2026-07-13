"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function QuestionsError({ reset }: { error: Error; reset: () => void }) { return <ErrorState description="Question data could not be loaded." onRetry={reset} title="Unable to load questions" />; }

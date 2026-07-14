"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function FeedbackError({ reset }: { error: Error; reset: () => void }) { return <ErrorState description="Feedback could not be loaded." onRetry={reset} title="Unable to load feedback" />; }

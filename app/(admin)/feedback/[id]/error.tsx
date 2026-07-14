"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function FeedbackDetailError({ reset }: { error: Error; reset: () => void }) { return <ErrorState description="This feedback item could not be loaded." onRetry={reset} title="Unable to load feedback detail" />; }

"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function AttemptsError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState description="Assessment attempt data could not be loaded." onRetry={reset} title="Unable to load attempts" />;
}

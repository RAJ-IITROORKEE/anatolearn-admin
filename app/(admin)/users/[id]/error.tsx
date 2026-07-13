"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function UserProgressError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState description="This user's progress could not be loaded." onRetry={reset} title="Unable to load user progress" />;
}

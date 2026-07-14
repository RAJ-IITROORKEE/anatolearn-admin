"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function UserProgressError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState description="This user profile could not be loaded." onRetry={reset} title="Unable to load user profile" />;
}

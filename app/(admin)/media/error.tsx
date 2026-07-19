"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function MediaError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState description="Media assets could not be loaded." onRetry={reset} title="Unable to load media library" />;
}

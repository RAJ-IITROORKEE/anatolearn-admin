"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState description="The dashboard could not be loaded. Try the request again." onRetry={reset} title="Dashboard unavailable" />;
}

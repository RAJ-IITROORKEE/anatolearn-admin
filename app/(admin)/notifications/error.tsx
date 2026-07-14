"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function NotificationsError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState description="Notification campaigns or provider evidence could not be loaded." onRetry={reset} title="Unable to load notifications" />;
}

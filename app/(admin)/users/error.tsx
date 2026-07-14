"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function UsersError({ reset }: { error: Error; reset: () => void }) { return <ErrorState description="User accounts could not be loaded." onRetry={reset} title="Unable to load users" />; }

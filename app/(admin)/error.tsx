"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function AdminError({ reset }: { error: Error; reset: () => void }) { return <ErrorState description="The requested admin data could not be loaded." onRetry={reset} title="Something went wrong" />; }

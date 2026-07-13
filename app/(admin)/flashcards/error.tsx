"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function FlashcardsError({ reset }: { error: Error; reset: () => void }) { return <ErrorState description="Flashcard data could not be loaded." onRetry={reset} title="Unable to load flashcards" />; }

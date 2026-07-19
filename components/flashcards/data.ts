import "server-only";

import type { Difficulty, PublishStatus } from "@prisma/client";
import { getAdminFlashcard, listAdminFlashcards } from "@/features/flashcards/service";
import type { FlashcardListInput } from "@/features/flashcards/schemas";

export type AdminFlashcard = {
  id: string;
  topicId: string;
  topicTitle: string | null;
  frontText: string;
  backText: string;
  frontImageUrl: string | null;
  frontMediaId: string | null;
  backImageUrl: string | null;
  backMediaId: string | null;
  difficulty: Difficulty;
  notes: string | null;
  displayOrder: number;
  status: PublishStatus;
  createdAt: Date;
  updatedAt: Date;
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

export const listFlashcards = (input: FlashcardListInput) => listAdminFlashcards(input) as Promise<{ items: AdminFlashcard[]; pagination: Pagination }>;
export const getFlashcard = (id: string) => getAdminFlashcard(id) as Promise<AdminFlashcard>;

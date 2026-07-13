import { PageHeader } from "@/components/app-shell/page-header";
import { listAdmin } from "@/components/phase3/data";
import { FlashcardForm } from "@/components/flashcards/flashcard-form";
import { createFlashcardAction } from "../../phase4-actions";

export default async function NewFlashcardPage() {
  const topics = await listAdmin("topic", { page: 1, pageSize: 100, sortBy: "title", sortOrder: "asc" });
  return <><PageHeader description="Create a draft study card, review both sides, then publish when its topic is eligible." eyebrow="Flashcards" title="Add flashcard" /><FlashcardForm action={createFlashcardAction} topics={topics.items.map((topic) => ({ id: topic.id, label: topic.title }))} /></>;
}

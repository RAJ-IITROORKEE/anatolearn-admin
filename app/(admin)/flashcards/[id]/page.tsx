import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { getFlashcard } from "@/components/flashcards/data";
import { FlashcardForm } from "@/components/flashcards/flashcard-form";
import { InlineAction } from "@/components/phase3/action-form";
import { StatusBadge } from "@/components/phase3/admin-ui";
import { listAdmin } from "@/components/phase3/data";
import { changeFlashcardStatusAction, trashFlashcardAction, updateFlashcardAction } from "../../phase4-actions";

export default async function FlashcardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item;
  try { item = await getFlashcard(id); } catch { notFound(); }
  const topics = await listAdmin("topic", { page: 1, pageSize: 100, sortBy: "title", sortOrder: "asc" });
  return <><PageHeader action={<div className="flex flex-wrap gap-2"><StatusBadge status={item.status} />{item.status === "DRAFT" && <InlineAction action={changeFlashcardStatusAction.bind(null, id, "PUBLISHED")}>Publish</InlineAction>}{item.status === "PUBLISHED" && <InlineAction action={changeFlashcardStatusAction.bind(null, id, "DRAFT")}>Move to draft</InlineAction>}{item.status !== "ARCHIVED" && <InlineAction action={trashFlashcardAction.bind(null, id)} confirmMessage="This hides the flashcard from normal views. It can be restored from Settings > Trash for 30 days. Continue?">Delete</InlineAction>}</div>} description="Edit both sides, preview the learner experience, and control publication." eyebrow="Flashcards" title={item.frontText} /><FlashcardForm action={updateFlashcardAction.bind(null, id)} item={item} topics={topics.items.map((topic) => ({ id: topic.id, label: topic.title }))} /></>;
}

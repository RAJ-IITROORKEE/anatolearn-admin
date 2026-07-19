import { notFound } from "next/navigation";
import { z } from "zod";

import { PageHeader } from "@/components/app-shell/page-header";
import { InlineAction } from "@/components/phase3/action-form";
import { StatusBadge } from "@/components/phase3/admin-ui";
import { getAdmin, listAdmin } from "@/components/phase3/data";
import { LessonForm } from "@/components/phase3/resource-forms";
import { ContentError } from "@/features/content/domain";
import { getAdminMediaMap } from "@/features/media/service";
import { changeResourceStatus, trashResourceAction, updateResource } from "../../phase3-actions";

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  let item;
  try {
    item = await getAdmin("contentLesson", id);
  } catch (error) {
    if (error instanceof ContentError && error.code === "NOT_FOUND" && error.status === 404) notFound();
    throw error;
  }
  const topics = await listAdmin("topic", { page: 1, pageSize: 100, sortBy: "title", sortOrder: "asc" });
  const imageIds = item.contentBlocks.flatMap((block) => block.type === "image" ? [block.mediaId] : []);
  const media = await getAdminMediaMap(imageIds);
  const existingMedia = Object.fromEntries(media.entries());

  return <>
    <PageHeader action={<div className="flex flex-wrap gap-2"><StatusBadge status={item.status} />{item.status === "DRAFT" && <InlineAction action={changeResourceStatus.bind(null, "contentLesson", id, "PUBLISHED")}>Publish</InlineAction>}{item.status !== "ARCHIVED" && <InlineAction action={trashResourceAction.bind(null, "content-lesson", id)} confirmMessage="This hides the lesson from normal views. It can be restored from Settings > Trash for 30 days. Continue?">Delete</InlineAction>}</div>} description="Edit validated blocks and control the lesson publication lifecycle." eyebrow="Content review" title={item.title} />
    <LessonForm action={updateResource.bind(null, "contentLesson", id)} existingMedia={existingMedia} item={item} topics={topics.items.map((topic) => ({ id: topic.id, label: topic.title }))} />
  </>;
}

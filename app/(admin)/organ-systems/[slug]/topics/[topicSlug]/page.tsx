import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { InlineAction } from "@/components/phase3/action-form";
import { StatusBadge } from "@/components/phase3/admin-ui";
import { getAdminTopicBySlugs, listAdmin } from "@/components/phase3/data";
import { TopicForm } from "@/components/phase3/resource-forms";
import { ContentError } from "@/features/content/domain";
import { getAdminMediaMap } from "@/features/media/service";
import { changeResourceStatus, trashResourceAction, updateResource } from "../../../../phase3-actions";

export default async function CanonicalTopicPage({ params }: { params: Promise<{ slug: string; topicSlug: string }> }) {
  const { slug, topicSlug } = await params;
  let item;
  try {
    item = await getAdminTopicBySlugs(slug, topicSlug);
  } catch (error) {
    if (error instanceof ContentError && error.code === "NOT_FOUND" && error.status === 404) notFound();
    throw error;
  }
  const systems = await listAdmin("organSystem", { page: 1, pageSize: 100, sortBy: "name", sortOrder: "asc" });
  const media = await getAdminMediaMap(item.coverMediaId ? [item.coverMediaId] : []);
  const coverMedia = item.coverMediaId ? media.get(item.coverMediaId) : undefined;

  return <>
    <PageHeader action={<div className="flex flex-wrap gap-2"><StatusBadge status={item.status} />{item.status === "DRAFT" && <InlineAction action={changeResourceStatus.bind(null, "topic", item.id, "PUBLISHED")}>Publish</InlineAction>}{item.status !== "ARCHIVED" && <InlineAction action={trashResourceAction.bind(null, "topic", item.id)} confirmMessage="This hides the topic and its content from normal views. It can be restored from Settings > Trash for 30 days. Continue?">Delete</InlineAction>}</div>} description="Edit the topic and its place in the anatomy curriculum." eyebrow="Topics" title={item.title} />
    <TopicForm action={updateResource.bind(null, "topic", item.id)} coverMedia={coverMedia} item={item} systems={systems.items.map((system) => ({ id: system.id, label: system.name }))} />
  </>;
}
